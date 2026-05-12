import path from "path";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import * as Sentry from "@sentry/node";
import { env, getAllowedOrigins, isNgrokOrigin } from "./config/env";
import { logger } from "./lib/logger";

import { authRoutes } from './modules/auth/auth.routes';
import { userRoutes } from './modules/users/user.routes';
import { storeRoutes, productRouter, pincodeRouter } from './modules/stores/store.routes';
import { postRoutes, interactionsRouter, storePostsDeleteRouter } from './modules/posts/post.routes';
import { searchRoutes } from './modules/search/search.routes';
import { messageRoutes } from './modules/messages/message.routes';
import { teamRoutes } from './modules/team/team.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { kycRoutes } from './modules/kyc/kyc.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { complaintRoutes, reportRoutes, reviewRoutes, settingsRoutes } from './modules/misc/misc.routes';
import { aiRoutes } from './modules/ai/ai.routes';
import { askNearbyRoutes } from './modules/ask-nearby/ask-nearby.routes';
import { landingPublicRoutes, landingAdminRoutes } from './modules/landing/landing.routes';
import pushRoutes from './modules/push/push.routes';
import { accountRoutes } from './modules/account/account.routes';

import { upload, getUploadedFileUrl } from "./middlewares/upload.middleware";
import { authenticateToken } from "./middlewares/auth.middleware";
import { fallthroughErrorHandler } from "./middlewares/error.middleware";
import { generalLimiter, uploadLimiter } from "./middlewares/rate-limiter.middleware";

export const app = express();
app.set('trust proxy', 1);

// ── 1. Security headers ──────────────────────────────────────────────────────
if (env.NODE_ENV === 'production') {
  // Production: full helmet protection (CSP still off — handled by Nginx)
  app.use(helmet({ contentSecurityPolicy: false }));
} else {
  // Dev: relaxed for iframe previews, local testing
  app.use(helmet({ 
    contentSecurityPolicy: false, 
    crossOriginResourcePolicy: false, 
    xFrameOptions: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false
  }));
}

// ── 2. Compression ───────────────────────────────────────────────────────────
app.use(compression());

// ── 3. CORS — must be before everything else ─────────────────────────────────
// Capacitor origins are always allowed regardless of ALLOWED_ORIGINS env var:
//   capacitor://localhost — iOS native WKWebView
//   http://localhost      — Android native WebView (androidScheme: 'http')
//   https://localhost     — Android native WebView (androidScheme: 'https' — our current config)
const CAPACITOR_ORIGINS = ['capacitor://localhost', 'http://localhost', 'https://localhost'];

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowedOrigins = getAllowedOrigins();

  if (
    isNgrokOrigin(origin) ||
    CAPACITOR_ORIGINS.includes(origin) ||
    (origin && allowedOrigins.includes(origin))
  ) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.length > 0) {
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, ngrok-skip-browser-warning');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// ── 4. Pino HTTP request logger ───────────────────────────────────────────────
// Comes after CORS/security headers; never logs request bodies (no password leaks)
app.use(
  pinoHttp({
    logger,
    // Skip health/upload spam in logs
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    serializers: {
      req(req) {
        return { method: req.method, url: req.url, id: req.id };
      },
    },
  })
);

// ── 5. Body parsers ───────────────────────────────────────────────────────────
//
// Two-tier body-size policy (Day 3 / Session 89 / Subtask 3.2):
//   - AI routes that accept base64 (image/audio) get a 10MB JSON parser
//     mounted BEFORE the global parser. Express middleware skips re-parsing
//     once req.body is set, so these requests are parsed exactly once at the
//     higher limit. Frontend compresses images to 1200px @ 0.80 quality
//     (~130-670KB base64 typical); 10MB is generous headroom.
//   - All other routes use the global 1MB parser. Tight enough to close the
//     DoS vector the previous 50MB setting created (unauthenticated POSTs
//     would accept arbitrary 50MB payloads); generous enough for typical
//     JSON CRUD payloads (<<100KB).
//
// Nginx fronts production at client_max_body_size 20M — these Express limits
// are defense-in-depth, and they govern non-Cloudflare environments (dev,
// future deploys, anyone bypassing the proxy).
//
// 413 responses are caught and converted to JSON by the dedicated handler
// at the end of this file (before the Sentry error middleware).

// AI base64 routes — must be registered BEFORE the global 1MB parser
app.use('/api/ai/analyze-image', express.json({ limit: '10mb' }));
app.use('/api/ai/transcribe-voice', express.json({ limit: '10mb' }));

// Global default
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// ── 6. Health check (before rate limiter — no auth needed) ───────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// ── 7. Global rate limiter — all /api routes ─────────────────────────────────
app.use('/api', generalLimiter);

// ── 7b. Default cache control for /api ───────────────────────────────────────
// Dynamic data by default. Route handlers that want short-lived caching call
// res.set('Cache-Control', 'public, max-age=N') — that overrides this default
// because Express applies the LAST setHeader call before the response flushes.
//
// Why this exists: messages, conversations, notifications, and feed responses
// were getting 304-revalidated by browsers using stale cached bodies. A new
// message in DB wasn't visible until hard-refresh.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ── 7c. Sentry user context — attach authed user to all subsequent error reports ─
app.use((req, _res, next) => {
  const user = (req as any).user;
  if (user?.userId) {
    Sentry.setUser({ id: user.userId, role: user.role });
  }
  next();
});

// ── 7. Domain routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/me/interactions', interactionsRouter);
app.use('/api/stores', storePostsDeleteRouter);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRouter);
app.use('/api/pincode', pincodeRouter);
app.use('/api/posts', postRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ask-nearby', askNearbyRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/account', accountRoutes);
app.use('/api', landingPublicRoutes);
app.use('/api/admin', landingAdminRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/app-settings', settingsRoutes);

// ── 8. Misc endpoints ─────────────────────────────────────────────────────────
// NOTE: /api/auth/me is the correct endpoint (auth.routes.ts, uses authenticateAny for both app + admin cookies)
app.post("/api/upload", authenticateToken, uploadLimiter, upload.single("file"), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = getUploadedFileUrl(req.file);
  return res.json({ url });
});

// ── 9. Static landing page — served before Vite middleware so it bypasses the SPA ─
app.get('/landing', (_req, res) => {
  return res.sendFile(path.resolve(process.cwd(), 'public', 'landing.html'));
});

// ── 9b. Admin panel — static files + SPA fallback ────────────────────────────
const adminDistPath = path.resolve(process.cwd(), 'admin-panel', 'dist');
app.use('/admin-panel', express.static(adminDistPath));
app.get('/admin-panel/*splat', (_req, res) => {
  return res.sendFile(path.join(adminDistPath, 'index.html'));
});

// ── 10. Debug/test routes (dev only) ──────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug-sentry", (_req, _res) => {
    throw new Error("Sentry test — intentional error from /api/debug-sentry");
  });
  logger.info("Debug route /api/debug-sentry enabled (dev only)");
}

// ── 11b. Payload-too-large handler (Day 3 / Session 89 / Subtask 3.2) ─────────
// body-parser throws PayloadTooLargeError with type='entity.too.large' and
// status=413 when a request body exceeds the configured limit. Without this
// handler, the error falls through to fallthroughErrorHandler which returns
// plain text "Internal Server Error\n" — a Rule A violation (API routes must
// return JSON) and a 500 misclassification of what's really a 413.
//
// This handler MUST be registered before Sentry.setupExpressErrorHandler so
// it can short-circuit the 413 case as a user-facing response, not as an
// alertable error. Other errors fall through via `next(err)` and reach Sentry.
//
// Rule B: logger.warn with structured context — never silent.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413)) {
    logger.warn(
      { type: err.type, limit: err.limit, length: err.length, message: err.message },
      'Payload too large rejected at body-parser',
    );
    return res.status(413).json({
      error: 'Payload too large',
      code: 'PAYLOAD_TOO_LARGE',
      limit: err.limit,
    });
  }
  return next(err);
});

// ── 12. Sentry error handler — must be BEFORE any other error middleware ──────
Sentry.setupExpressErrorHandler(app);

// ── 13. Global fallthrough error handler ─────────────────────────────────────
app.use(fallthroughErrorHandler);
