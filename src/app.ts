import path from "path";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import * as Sentry from "@sentry/node";
import multer from "multer";
import { env, getAllowedOrigins, isNgrokOrigin } from "./config/env";
import { prisma } from "./config/prisma";
import { pubClient } from "./config/redis";
import { logger } from "./lib/logger";

import { authRoutes } from './modules/auth/auth.routes';
import { userRoutes } from './modules/users/user.routes';
import { storeRoutes, productRouter, pincodeRouter, geocodeRouter } from './modules/stores/store.routes';
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
import cspReportRoutes from './modules/security/csp-report.routes';

import { upload, getUploadedFileUrl, verifyAndPersistUpload, FILE_SIZE_LIMIT_BYTES } from "./middlewares/upload.middleware";
import { authenticateToken } from "./middlewares/auth.middleware";
import { fallthroughErrorHandler } from "./middlewares/error.middleware";
import { generalLimiter, uploadLimiter } from "./middlewares/rate-limiter.middleware";

export const app = express();
app.set('trust proxy', 1);

// ── 1. Security headers ──────────────────────────────────────────────────────
// CSP applied below in Report-Only mode (monitoring phase). Will flip to
// enforcing after 24-48h of clean violation reports via /api/csp-report.
// Note: legacy comment said "handled by Nginx" — there is no Nginx in front
// of Fly.io post-migration (Express serves directly). Removed in this PR.
//
// Discovery doc: docs/audit/csp-discovery.md (PR #38).
//
// Policy shape (Phase 1):
//   - 'unsafe-inline' required for script-src (4 inline blocks in index.html
//     + landing.html) and style-src (1,160+ React style={{...}} props).
//     Phase 3 of the rollout tightens these progressively.
//   - reportOnly: true — header name becomes Content-Security-Policy-Report-Only.
//     Browsers log violations to /api/csp-report but BLOCK NOTHING.
//   - R2 public bucket host comes from env.R2_PUBLIC_URL; defensive fallback
//     to https://*.r2.dev pattern if unset (should never happen on Fly).
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "https://*.i.posthog.com",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://unpkg.com",
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https://*.i.posthog.com",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
    "https://images.unsplash.com",
    "https://picsum.photos",
    env.R2_PUBLIC_URL || "https://*.r2.dev",
  ],
  fontSrc: [
    "'self'",
    "https://fonts.gstatic.com",
  ],
  connectSrc: [
    "'self'",
    "data:", // Session 110 hotfix — PostsGrid image-upload pipeline fetch()es a data: URI to convert cropped image to a Blob; CSP enforce blocked it. report-only window didn't exercise upload flow → caught at founder CP4 device test.
    "blob:", // Session 110 hotfix — same upload pipeline + native Capacitor image picker returns blob: URLs that are then fetch()-ed before R2 PUT.
    "https://*.i.posthog.com",
    "https://*.ingest.sentry.io",
    "https://*.ingest.us.sentry.io",
    "https://nominatim.openstreetmap.org",
    "https://maps.googleapis.com",
    "https://fonts.googleapis.com", // Maps SDK fetches font CSS via XHR, not <link>
    "https://fonts.gstatic.com", // PR #43 — Workbox SW fetch context (SW fetch → connect-src, NOT font-src)
    "wss://dukanchi.com",
    "wss:", // catch-all for Capacitor / socket.io transport fallback
  ],
  workerSrc: ["'self'", "blob:"],
  mediaSrc: ["'self'", "blob:"],
  frameSrc: ["'none'"],
  frameAncestors: ["'none'"],
  formAction: ["'self'"],
  baseUri: ["'self'"],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: [],
  reportUri: ["/api/csp-report"],
};

if (env.NODE_ENV === 'production') {
  // Production: full helmet protection + CSP Report-Only.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        reportOnly: true,
        directives: cspDirectives,
      },
    }),
  );
} else {
  // Dev: same CSP Report-Only policy (so dev surfaces violations the same
  // way), but relax the unrelated cross-origin headers that broke iframe
  // previews and local tooling before.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        reportOnly: true,
        directives: cspDirectives,
      },
      crossOriginResourcePolicy: false,
      xFrameOptions: false,
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: false,
    }),
  );
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
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, ngrok-skip-browser-warning, X-Refresh-Token');
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
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      // Day 5 / Session 92 / Phase 4 Q6: native clients send the refresh
      // token as X-Refresh-Token when cookies aren't reliable (Capacitor
      // WebView). Same secrecy class as cookies — redact from request logs.
      'req.headers["x-refresh-token"]',
    ],
    serializers: {
      req(req) {
        return { method: req.method, url: req.url, id: req.id };
      },
    },
  })
);

// ── 4b. Request ID propagation — Day 4 / Session 90 / Edits 1+2 ──────────────
// pinoHttp generates req.id per-request (Pino's default UUID v4). Propagate it:
//   (a) to the X-Request-Id response header — visible to clients so a user
//       support ticket can quote the ID and we can trace it across logs.
//   (b) to the Sentry scope as a tag — when an exception is captured anywhere
//       downstream, Sentry's event UI shows the request_id alongside it,
//       making log↔Sentry correlation trivial.
// Must run AFTER pinoHttp (which generates req.id) and BEFORE route handlers.
app.use((req, res, next) => {
  const requestId = (req as any).id;
  if (requestId) {
    res.setHeader('X-Request-Id', String(requestId));
    Sentry.getCurrentScope().setTag('request_id', String(requestId));
  }
  next();
});

// ── 4c. CSP violation report endpoint ─────────────────────────────────────────
// Must mount BEFORE the global /api rate limiter (line below) so CSP reports
// always succeed — Chrome stops reporting for a document on any 4xx/5xx, and
// the general limiter would 429 a noisy page mid-debug. The router uses its
// own per-IP limiter (100/min) and its own body parser for the
// application/csp-report content-type.
app.use('/api', cspReportRoutes);

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
// Real probe vs the previous one-liner: checks DB + Redis with a 2s timeout
// each. Fly's [[http_service.checks]] polls this every 30s; a 503 here is the
// signal that triggers Fly's auto-restart / rollback per fly.toml. Probe
// failures log via pino. Sentry capture is intentionally omitted — during a
// real Neon / Upstash outage this would fire every 30s and drown the Sentry
// project; the operator gets a single ALERT from Fly's healthcheck instead.
app.get('/health', async (_req, res) => {
  let dbStatus = 'unknown';
  let redisStatus = 'unknown';
  let allHealthy = true;

  // DB probe — Prisma SELECT 1, 2s ceiling to keep /health snappy.
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 2000)),
    ]);
    dbStatus = 'up';
  } catch (err) {
    dbStatus = 'down';
    allHealthy = false;
    logger.error({ err }, 'Health check: DB probe failed');
  }

  // Redis probe — node-redis client.ping(), same 2s ceiling.
  try {
    await Promise.race([
      pubClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 2000)),
    ]);
    redisStatus = 'up';
  } catch (err) {
    redisStatus = 'down';
    allHealthy = false;
    logger.error({ err }, 'Health check: Redis probe failed');
  }

  return res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    db: dbStatus,
    redis: redisStatus,
    timestamp: Date.now(),
  });
});

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
app.use('/api/geocode', geocodeRouter);
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
app.post(
  "/api/upload",
  authenticateToken,
  uploadLimiter,
  upload.single("file"),
  verifyAndPersistUpload,
  (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = getUploadedFileUrl(req.file);
    return res.json({ url });
  },
);

// ── 9. Static landing page — served before Vite middleware so it bypasses the SPA ─
app.get('/landing', (_req, res) => {
  return res.sendFile(path.resolve(process.cwd(), 'public', 'landing.html'));
});

// ── 9a. SEO — robots.txt + sitemap.xml (Session 128.11) ──────────────────────
// Express's static dist/ handler already would serve these files (Vite copies
// public/* into dist/ at build time, and express.static runs BEFORE the SPA
// catch-all in server.ts). But we register explicit routes here for two
// reasons:
//   1. Forces deterministic Content-Type (text/plain + application/xml) so
//      crawlers don't choke on a mis-detected MIME.
//   2. Makes the SEO contract explicit + easy to grep — future server-side
//      refactors can't accidentally regress these to the SPA shell.
// Note: explicit routes mounted BEFORE server.ts's app.get('*') catch-all.
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').sendFile(path.resolve(process.cwd(), 'public', 'robots.txt'));
});
app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml').sendFile(path.resolve(process.cwd(), 'public', 'sitemap.xml'));
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

// ── 11a. Multer error handler (Day 3 / Session 89 / Subtask 3.3) ──────────────
// Multer throws MulterError (with `code` like LIMIT_FILE_SIZE) and custom
// fileFilter rejections throw plain Error with `code` we attached
// (INVALID_MIME, INVALID_FILENAME). None of these set `err.status`, so the
// 413 handler below would miss them. Map each to the right HTTP shape.
//
// Rule A: every response is JSON. Rule B: every rejection branch logs via pino.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Day 2.6 Item 3: structured-log correlation fields (req.user is set by
  // authenticateToken / authenticateAdminToken earlier in the chain, before
  // Multer runs, so it's available even though we're in an error handler).
  const userId = (req as any).user?.userId ?? null;
  const route = req.originalUrl;

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      logger.warn(
        { event: 'upload.rejected.size', userId, route, code: err.code, field: err.field },
        "Multer: file size limit exceeded",
      );
      return res.status(413).json({
        error: "File too large",
        code: "FILE_TOO_LARGE",
        limit: FILE_SIZE_LIMIT_BYTES,
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      logger.warn(
        { event: 'upload.rejected.field', userId, route, code: err.code, field: err.field },
        "Multer: unexpected file field",
      );
      return res.status(400).json({ error: "Unexpected file field", code: "UNEXPECTED_FIELD" });
    }
    logger.warn(
      { event: 'upload.rejected.multer_other', userId, route, code: err.code, message: err.message },
      "Multer error (generic)",
    );
    return res.status(400).json({ error: err.message, code: "UPLOAD_ERROR" });
  }
  // Custom errors raised from fileFilter (plain Error + .code we set)
  if (err && err.code === "INVALID_MIME") {
    logger.warn(
      { event: 'upload.rejected.mime_claim', userId, route, code: 'INVALID_MIME', message: err.message },
      "Upload rejected: claimed MIME not in whitelist",
    );
    return res.status(415).json({ error: "File type not allowed", code: "INVALID_MIME" });
  }
  if (err && err.code === "INVALID_FILENAME") {
    logger.warn(
      { event: 'upload.rejected.filename', userId, route, code: 'INVALID_FILENAME', message: err.message },
      "Upload rejected: filename sanitization",
    );
    return res.status(400).json({ error: err.message, code: "INVALID_FILENAME" });
  }
  return next(err);
});

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
