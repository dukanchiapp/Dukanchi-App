// Load env first — must happen before Sentry init reads process.env.SENTRY_DSN
import { config } from "dotenv";
config();

// ⚠️ Sentry MUST be initialized before any other imports of app code
import { initSentry } from "./src/lib/sentry";
initSentry();

import path from "path";
import express from "express";
import bcrypt from "bcrypt";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { logger } from "./src/lib/logger";

const PROTECTED_ADMIN_ID = '5cbf1a3d-e8e7-4b64-836a-58475bbbb7d9';

async function ensureAdminAccount(prisma: any) {
  const ADMIN_PHONE = process.env.ADMIN_PHONE;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PHONE || !ADMIN_PASSWORD) {
    logger.warn("ADMIN_PHONE or ADMIN_PASSWORD not set in .env — skipping admin account seeding.");
    return;
  }

  const ADMIN_NAME = 'Mandeep';

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: PROTECTED_ADMIN_ID }, { phone: ADMIN_PHONE }] },
    });

    if (existing) {
      const passwordMatches = await bcrypt.compare(ADMIN_PASSWORD, existing.password);
      if (passwordMatches && existing.role === 'admin' && !existing.isBlocked && existing.phone === ADMIN_PHONE) {
        return;
      }
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.user.update({
        where: { id: existing.id },
        data: { phone: ADMIN_PHONE, password: hashed, name: ADMIN_NAME, role: 'admin', isBlocked: false },
      });
    } else {
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.user.create({
        data: { id: PROTECTED_ADMIN_ID, phone: ADMIN_PHONE, password: hashed, name: ADMIN_NAME, role: 'admin' },
      });
    }
  } catch (err) {
    logger.error({ err }, "Failed to ensure admin account");
  }
}

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // ── 1. Connect Redis FIRST before any module that uses it is loaded ──────────
  const { connectRedis } = await import("./src/config/redis");
  await connectRedis();

  // ── 2. Dynamically import app AFTER Redis is connected (rate-limiter is safe) ─
  const { app } = await import("./src/app");
  const { initializeSocket } = await import("./src/config/socket");
  const { prisma } = await import("./src/config/prisma");
  const { refreshVocabulary } = await import("./src/services/fuzzySearch");
  const { startNotificationWorker } = await import("./src/workers/notification.worker");
  const { setupSocketListeners } = await import("./src/config/socket-listeners");

  // ── 3. Setup HTTP server, sockets, workers ────────────────────────────────────
  const httpServer = createServer(app);
  const io = initializeSocket(httpServer);
  setupSocketListeners(io);
  startNotificationWorker();

  // ── 4. Seed admin account ─────────────────────────────────────────────────────
  await ensureAdminAccount(prisma);

  // ── 5. Vite (dev) or static files (prod) ──────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ── 6. Start listening ────────────────────────────────────────────────────────
  httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    refreshVocabulary(prisma)
      .then(() => logger.info("Fuzzy vocabulary loaded"))
      .catch((err: unknown) => logger.error({ err }, "Failed to load fuzzy vocabulary"));
    setInterval(
      () => refreshVocabulary(prisma).catch((err: unknown) => logger.error({ err }, "Fuzzy vocabulary refresh failed")),
      5 * 60 * 1000
    );
  });

  // ── 7. Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    httpServer.close(() => {
      logger.info("HTTP server closed");
    });
    try { await prisma.$disconnect(); logger.info("Prisma disconnected"); } catch {}
    try {
      const { pubClient, subClient } = await import("./src/config/redis");
      await pubClient.quit();
      await subClient.quit();
      logger.info("Redis disconnected");
    } catch {}
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error({ err }, "Fatal: server failed to start");
  process.exit(1);
});
