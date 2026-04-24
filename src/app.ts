import express from "express";
import helmet from "helmet";
import compression from "compression";
import { getAllowedOrigins } from "./config/env";
import * as Sentry from "@sentry/node";

import { authRoutes } from './modules/auth/auth.routes';
import { userRoutes } from './modules/users/user.routes';
import { storeRoutes, productRouter } from './modules/stores/store.routes';
import { postRoutes, interactionsRouter, storePostsDeleteRouter } from './modules/posts/post.routes';
import { searchRoutes } from './modules/search/search.routes';
import { messageRoutes } from './modules/messages/message.routes';
import { teamRoutes } from './modules/team/team.routes';
import { notificationRoutes } from './modules/notifications/notification.routes';
import { kycRoutes } from './modules/kyc/kyc.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { complaintRoutes, reportRoutes, reviewRoutes, settingsRoutes } from './modules/misc/misc.routes';

import { upload } from "./middlewares/upload.middleware";
import { authenticateToken } from "./middlewares/auth.middleware";
import { fallthroughErrorHandler } from "./middlewares/error.middleware";

export const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// Compression
app.use(compression());

// CORS - must be before everything else
app.use((req, res, next) => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// JSON Body Parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/uploads", express.static("uploads"));

// Mount domains
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/me/interactions', interactionsRouter);
app.use('/api/stores', storePostsDeleteRouter); // DELETE /api/stores/:storeId/posts
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRouter);
app.use('/api/posts', postRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/app-settings', settingsRoutes);

// Misc endpoints
app.post("/api/upload", authenticateToken, upload.single("file"), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = (req.file as any).location ?? `/uploads/${req.file.filename}`;
  res.json({ url });
});

// Sentry Debug Route
app.get("/debug-sentry", function mainHandler(req, res) {
  throw new Error("My first Sentry error!");
});

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// Global Error Handler
app.use(fallthroughErrorHandler);
