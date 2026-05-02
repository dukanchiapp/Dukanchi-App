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

import { upload } from "./middlewares/upload.middleware";
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
app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  const allowedOrigins = getAllowedOrigins();

  if (isNgrokOrigin(origin) || (origin && allowedOrigins.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.length > 0) {
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, ngrok-skip-browser-warning');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// ── 6. Health check (before rate limiter — no auth needed) ───────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// ── 7. Global rate limiter — all /api routes ─────────────────────────────────
app.use('/api', generalLimiter);

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
app.use('/api/conversations', messageRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ask-nearby', askNearbyRoutes);
app.use('/api/push', pushRoutes);
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
  const url = (req.file as any).location ?? `/uploads/${req.file.filename}`;
  res.json({ url });
});

// ── 9. Static landing page — served before Vite middleware so it bypasses the SPA ─
app.get('/landing', (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public', 'landing.html'));
});

// ── 10. Health check ─────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// ── 11. Debug/test routes (dev only) ──────────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug-sentry", (_req, _res) => {
    throw new Error("Sentry test — intentional error from /api/debug-sentry");
  });
  logger.info("Debug route /api/debug-sentry enabled (dev only)");
}

// ── 12. Sentry error handler — must be BEFORE any other error middleware ──────
Sentry.setupExpressErrorHandler(app);

// ── 13. Global fallthrough error handler ─────────────────────────────────────
app.use(fallthroughErrorHandler);
