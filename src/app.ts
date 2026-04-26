import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import * as Sentry from "@sentry/node";
import { getAllowedOrigins } from "./config/env";
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

import { upload } from "./middlewares/upload.middleware";
import { authenticateToken } from "./middlewares/auth.middleware";
import { fallthroughErrorHandler } from "./middlewares/error.middleware";

export const app = express();

// ── 1. Security headers ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// ── 2. Compression ───────────────────────────────────────────────────────────
app.use(compression());

// ── 3. CORS — must be before everything else ─────────────────────────────────
app.use((req, res, next) => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.length > 0) {
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
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

// ── 6. Domain routes ──────────────────────────────────────────────────────────
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
app.use('/api/complaints', complaintRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/app-settings', settingsRoutes);

// ── 7. Misc endpoints ─────────────────────────────────────────────────────────
import { AuthController } from "./modules/auth/auth.controller";
app.get("/api/me", authenticateToken, AuthController.me);
app.post("/api/upload", authenticateToken, upload.single("file"), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = (req.file as any).location ?? `/uploads/${req.file.filename}`;
  res.json({ url });
});

// ── 8. Debug/test routes (dev only) ──────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.get("/api/debug-sentry", (_req, _res) => {
    throw new Error("Sentry test — intentional error from /api/debug-sentry");
  });
  logger.info("Debug route /api/debug-sentry enabled (dev only)");
}

// ── 9. Sentry error handler — must be BEFORE any other error middleware ───────
Sentry.setupExpressErrorHandler(app);

// ── 10. Global fallthrough error handler ──────────────────────────────────────
app.use(fallthroughErrorHandler);
