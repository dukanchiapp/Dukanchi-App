import path from "path";
import express from "express";
import bcrypt from "bcrypt";
import * as Sentry from "@sentry/node";
import { createServer as createViteServer } from "vite";

import { createServer } from "http";
import { app } from "./src/app";
import { initializeSocket } from "./src/config/socket";
import { prisma } from "./src/config/prisma";
import { refreshVocabulary } from "./src/services/fuzzySearch";
import { startNotificationWorker } from "./src/workers/notification.worker";
import { setupSocketListeners } from "./src/config/socket-listeners";

// Setup HTTP Server & Sockets
const httpServer = createServer(app);
const io = initializeSocket(httpServer);
setupSocketListeners(io);

// Start Workers
startNotificationWorker();

const PROTECTED_ADMIN_ID = '5cbf1a3d-e8e7-4b64-836a-58475bbbb7d9';

async function ensureAdminAccount() {
  const ADMIN_PHONE = process.env.ADMIN_PHONE;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PHONE || !ADMIN_PASSWORD) {
    console.warn("WARNING: ADMIN_PHONE or ADMIN_PASSWORD not set in .env — skipping admin account seeding.");
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
    console.error("Failed to ensure admin account:", err);
  }
}

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  await ensureAdminAccount();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on("request", app);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    refreshVocabulary(prisma).then(() => console.log('Fuzzy vocabulary loaded')).catch(() => {});
    setInterval(() => refreshVocabulary(prisma).catch(() => {}), 5 * 60 * 1000);
  });
}

startServer();
