import express from "express";
import { createServer as createViteServer } from "vite";
import { PrismaClient } from "@prisma/client";
import { createServer } from "http";
import { Server } from "socket.io";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import * as xlsx from "xlsx";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import compression from "compression";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this";
if (JWT_SECRET === "your-super-secret-jwt-key-change-this") {
  console.warn("WARNING: Using default JWT_SECRET. Please set JWT_SECRET in .env for production.");
}

// Prisma with connection pooling sized for high concurrency
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const app = express();
const httpServer = createServer(app);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS },
});

// Setup Redis & Socket.io adapter
const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log("Redis adapter attached to Socket.IO");
}).catch(err => console.error("Redis connection error:", err));

// Setup BullMQ for background jobs (using IORedis connection)
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });
const notificationQueue = new Queue('Notifications', { connection });

// Worker that processes heavy jobs in the background
const notificationWorker = new Worker('Notifications', async job => {
  if (job.name === 'publishPostNotifications') {
    const { postId, storeId, storeName } = job.data;
    const storeWithFollowers = await prisma.store.findUnique({
      where: { id: storeId },
      include: { followers: true }
    });
    if (storeWithFollowers && storeWithFollowers.followers.length > 0) {
      // Chunk createMany in batches of 1000 to avoid DB statement size limits at scale
      const allFollowers = storeWithFollowers.followers;
      const CHUNK = 1000;
      for (let i = 0; i < allFollowers.length; i += CHUNK) {
        const chunk = allFollowers.slice(i, i + CHUNK);
        await prisma.notification.createMany({
          data: chunk.map(f => ({
            userId: f.userId,
            type: 'NEW_POST',
            content: `${storeName} just published a new post!`,
            referenceId: postId
          }))
        });
      }

      // Emit only to currently-connected users (socket rooms exist only if user is online)
      const newNotifs = await prisma.notification.findMany({
        where: { referenceId: postId, type: 'NEW_POST' }
      });
      for (const notif of newNotifs) {
        io.to(notif.userId).emit('newNotification', notif);
      }
    }
  }

  if (job.name === 'autoReply') {
    const { senderId, receiverId, storeName, senderName, storePhone, storeAddress } = job.data;
    const autoReplyText = `Hi! Thanks for reaching out. Please wait while our team connects with you.`;
    try {
      const autoReply = await prisma.message.create({
        data: { senderId: receiverId, receiverId: senderId, message: autoReplyText }
      });
      io.to(senderId).emit("newMessage", autoReply);
      io.to(receiverId).emit("newMessage", autoReply);
    } catch (e) {
      console.error("Auto-reply job failed:", e);
    }
  }
}, { connection });

// Redis-backed cache for blocked user status (TTL 60s) — avoids a DB hit on every request
const BLOCKED_TTL = 60;
const isUserBlocked = async (userId: string): Promise<boolean> => {
  const key = `blocked:${userId}`;
  try {
    const cached = await pubClient.get(key);
    if (cached !== null) return cached === '1';
  } catch {}
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { isBlocked: true } });
  const blocked = row?.isBlocked ?? false;
  try { await pubClient.set(key, blocked ? '1' : '0', { EX: BLOCKED_TTL }); } catch {}
  return blocked;
};

// Redis-backed cache for team member existence (TTL 120s) — avoids a DB hit per request
const TEAM_MEMBER_TTL = 120;
const teamMemberExists = async (teamMemberId: string): Promise<boolean> => {
  const key = `team:${teamMemberId}`;
  try {
    const cached = await pubClient.get(key);
    if (cached !== null) return cached === '1';
  } catch {}
  const member = await prisma.teamMember.findUnique({ where: { id: teamMemberId }, select: { id: true } });
  const exists = !!member;
  try { await pubClient.set(key, exists ? '1' : '0', { EX: TEAM_MEMBER_TTL }); } catch {}
  return exists;
};

// Gzip/brotli all responses — especially large JSON feeds
app.use(compression());

// CORS - must be before everything else
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Rate Limiting — Redis-backed so limits survive restarts and work across multiple instances
const makeRedisStore = (prefix: string) => new RedisStore({
  sendCommand: (...args: string[]) => pubClient.sendCommand(args),
  prefix,
});

const authLimiter = rateLimit({
  store: makeRedisStore('rl:auth:'),
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  store: makeRedisStore('rl:upload:'),
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many uploads. Please slow down." },
});

const messageLimiter = rateLimit({
  store: makeRedisStore('rl:message:'),
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "You're sending messages too quickly. Please slow down." },
});

// Global API limiter — applied to all /api/* routes
const generalLimiter = rateLimit({
  store: makeRedisStore('rl:general:'),
  windowMs: 60 * 1000,
  max: 300,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Setup uploads directory with S3 option
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

let upload;
if (process.env.S3_BUCKET_NAME) {
  const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    }
  });
  upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: process.env.S3_BUCKET_NAME,
      metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
      },
      key: function (req, file, cb) {
        cb(null, Date.now().toString() + "-" + file.originalname);
      }
    })
  });
} else {
  upload = multer({
    dest: uploadDir,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images (JPEG, PNG, WebP, GIF) and Excel files are allowed.'));
      }
    }
  });
}

app.use("/uploads", express.static(uploadDir)); // Serve upload images

// API Routes
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await pubClient.ping();
    res.json({ status: "ok", db: "ok", redis: "ok" });
  } catch (err: any) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

// Users
app.post("/api/users", authLimiter, async (req, res) => {
  try {
    const { name, phone, password, role, location } = req.body;

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return res.status(400).json({ error: "This phone number already exists" });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({ 
      data: { name, phone, password: hashedPassword, role, location } 
    });
    
    // Auto-login user upon creation
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    // Don't send password back to client
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: "Phone and password are required" });
    }

    // Check Team Member login first
    const teamMember = await prisma.teamMember.findUnique({ 
      where: { phone },
      include: { store: { include: { owner: true } } }
    });
    if (teamMember) {
      const validPassword = await bcrypt.compare(password, teamMember.passwordHash);
      if (!validPassword) return res.status(401).json({ error: "Invalid credentials" });

      // Generate JWT portraying as the store owner, but with a teamMemberId flag
      const token = jwt.sign({ userId: teamMember.store.ownerId, role: teamMember.store.owner.role, teamMemberId: teamMember.id }, JWT_SECRET, { expiresIn: '7d' });
      const { password: _, ...userWithoutPassword } = teamMember.store.owner;
      return res.json({ user: userWithoutPassword, token, isTeamMember: true });
    }

    // Normal User login path
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: "Your account has been blocked. Please contact support." });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // Don't send password back to client
    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// Google login temporarily disabled
// app.post("/api/google-login", ...) — removed until re-enabled

// Chat Permissions Helper
const canChat = (roleA: string, roleB: string): boolean => {
  // Allow chat between any users
  return true;
};

// Middleware for protected routes
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access denied" });

  jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
    if (err || !user || !user.userId) return res.status(403).json({ error: "Invalid token" });

    // Check team member revocation via Redis cache
    if (user.teamMemberId) {
      if (!(await teamMemberExists(user.teamMemberId))) return res.status(403).json({ error: "Access revoked" });
    }

    (req as any).user = user;

    // Blocked check via Redis cache — single cache lookup instead of a DB query per request
    if (await isUserBlocked(user.userId)) return res.status(403).json({ error: "Account blocked" });

    next();
  });
};

app.get("/api/users/:userId/store", async (req, res) => {
  const { userId } = req.params;
  const store = await prisma.store.findFirst({
    where: { ownerId: userId },
    include: {
      _count: {
        select: { posts: true, products: true, followers: true }
      }
    }
  });
  res.json(store);
});

// User lookup (for chat headers etc.)
// --- Admin Routes ---
const requireAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

const ADMIN_STATS_KEY = 'admin:stats';
const ADMIN_STATS_TTL = 60;

// Enhanced stats — cached in Redis for 60s to avoid 5 COUNT(*) queries per dashboard load
app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const cached = await pubClient.get(ADMIN_STATS_KEY);
    if (cached) return res.json(JSON.parse(cached as string));

    const [usersCount, storesCount, postsCount, reviewsCount, reportsCount] = await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.post.count(),
      prisma.review.count(),
      prisma.report.count(),
    ]);

    const [recentUsers, recentReports] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, role: true, phone: true, createdAt: true, kycStoreName: true, stores: { select: { storeName: true } } },
      }),
      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          reportedByUser: { select: { name: true } },
          reportedUser: { select: { name: true } },
          reportedStore: { select: { storeName: true } },
        },
      }),
    ]);

    const result = { users: usersCount, stores: storesCount, posts: postsCount, reviews: reviewsCount, reports: reportsCount, recentUsers, recentReports };
    await pubClient.set(ADMIN_STATS_KEY, JSON.stringify(result), { EX: ADMIN_STATS_TTL });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin stats" });
  }
});

// List all users
app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search, role, page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }];
    if (role && role !== "all") where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, phone: true, email: true, role: true, location: true, createdAt: true, isBlocked: true, kycStoreName: true, stores: { select: { id: true, storeName: true, logoUrl: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Admin: Reset user password
app.post("/api/admin/reset-password", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

const PROTECTED_ADMIN_ID = '5cbf1a3d-e8e7-4b64-836a-58475bbbb7d9';

// Update user (role or blocked status)
app.put("/api/admin/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === PROTECTED_ADMIN_ID) {
      return res.status(403).json({ error: "This admin account cannot be modified" });
    }
    const { role, isBlocked } = req.body;
    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, name: true, role: true, isBlocked: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Bulk update users (block/unblock)
app.post("/api/admin/users/bulk-update", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userIds, isBlocked } = req.body;
    if (!Array.isArray(userIds)) return res.status(400).json({ error: "userIds must be an array" });

    const currentUserId = (req as any).user.userId;

    // Filter out current user and protected admin if trying to block
    const safeUserIds = (isBlocked === true)
      ? userIds.filter((id: string) => id !== currentUserId && id !== PROTECTED_ADMIN_ID)
      : userIds.filter((id: string) => id !== PROTECTED_ADMIN_ID);
    
    if (safeUserIds.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    await prisma.user.updateMany({
      where: { id: { in: safeUserIds } },
      data: { isBlocked: !!isBlocked }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({ error: "Failed to perform bulk update" });
  }
});

// Delete user
app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === PROTECTED_ADMIN_ID) {
    return res.status(403).json({ error: "This admin account cannot be deleted" });
  }
  try {
    await prisma.$transaction([
      // Delete user's dependent records
      prisma.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } }),
      prisma.follow.deleteMany({ where: { userId: id } }),
      prisma.review.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.savedItem.deleteMany({ where: { userId: id } }),
      prisma.searchHistory.deleteMany({ where: { userId: id } }),
      prisma.savedLocation.deleteMany({ where: { userId: id } }),
      prisma.like.deleteMany({ where: { userId: id } }),
      prisma.report.deleteMany({ where: { OR: [{ reportedByUserId: id }, { reportedUserId: id }] } }),
      
      // Handle stores owned by the user
      // Note: We need to delete store dependents first. 
      // Since prisma transaction doesn't easily support nested deletes of related models 
      // without cascading in schema, we do it step by step for all stores of this user.
    ]);

    // Delete all stores and their dependents for this user
    const userStores = await prisma.store.findMany({ where: { ownerId: id } });
    for (const store of userStores) {
      // Delete likes on posts of this store first
      const storePosts = await prisma.post.findMany({ where: { storeId: store.id } });
      const postIds = storePosts.map(p => p.id);
      
      const storeProducts = await prisma.product.findMany({ where: { storeId: store.id } });
      const productIds = storeProducts.map(p => p.id);
      
      await prisma.$transaction([
        prisma.like.deleteMany({ where: { postId: { in: postIds } } }),
        prisma.post.deleteMany({ where: { storeId: store.id } }),
        prisma.review.deleteMany({ where: { OR: [{ storeId: store.id }, { productId: { in: productIds } }] } }),
        prisma.product.deleteMany({ where: { storeId: store.id } }),
        prisma.follow.deleteMany({ where: { storeId: store.id } }),
        prisma.teamMember.deleteMany({ where: { storeId: store.id } }),
        prisma.report.deleteMany({ where: { reportedStoreId: store.id } }),
        prisma.store.delete({ where: { id: store.id } }),
      ]);
    }

    // Finally delete the user
    await prisma.user.delete({ where: { id } });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user and its dependencies" });
  }
});

// List all stores
app.get("/api/admin/stores", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) where.OR = [{ storeName: { contains: search, mode: "insensitive" } }, { category: { contains: search, mode: "insensitive" } }];

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { name: true, phone: true, role: true, isBlocked: true } },
          _count: { select: { followers: true, posts: true, products: true } },
        },
      }),
      prisma.store.count({ where }),
    ]);

    res.json({ stores, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stores" });
  }
});

// Delete store
app.delete("/api/admin/stores/:id", authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const storePosts = await prisma.post.findMany({ where: { storeId: id } });
    const postIds = storePosts.map(p => p.id);

    const storeProducts = await prisma.product.findMany({ where: { storeId: id } });
    const productIds = storeProducts.map(p => p.id);

    await prisma.$transaction([
      prisma.like.deleteMany({ where: { postId: { in: postIds } } }),
      prisma.post.deleteMany({ where: { storeId: id } }),
      prisma.review.deleteMany({ where: { OR: [{ storeId: id }, { productId: { in: productIds } }] } }),
      prisma.product.deleteMany({ where: { storeId: id } }),
      prisma.follow.deleteMany({ where: { storeId: id } }),
      prisma.teamMember.deleteMany({ where: { storeId: id } }),
      prisma.report.deleteMany({ where: { reportedStoreId: id } }),
      prisma.store.delete({ where: { id } }),
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete store error:", error);
    res.status(500).json({ error: "Failed to delete store and its dependencies" });
  }
});

// Admin: List all stores with team member counts
app.get("/api/admin/store-members", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search } = req.query as any;
    const where: any = {};
    if (search) {
      where.OR = [
        { storeName: { contains: search, mode: 'insensitive' } },
        { owner: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const stores = await prisma.store.findMany({
      where,
      select: {
        id: true,
        storeName: true,
        category: true,
        logoUrl: true,
        createdAt: true,
        owner: { select: { id: true, name: true, phone: true, role: true, email: true } },
        _count: { select: { teamMembers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch store members" });
  }
});

// Admin: Get store details + owner + all team members
app.get("/api/admin/store-members/:storeId", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { storeId } = req.params;
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        storeName: true,
        category: true,
        logoUrl: true,
        address: true,
        phone: true,
        createdAt: true,
        owner: { select: { id: true, name: true, phone: true, role: true, email: true, createdAt: true } },
        teamMembers: {
          select: { id: true, name: true, phone: true, role: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!store) return res.status(404).json({ error: "Store not found" });
    res.json(store);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch store details" });
  }
});

// Admin: Delete a team member
app.delete("/api/admin/team/:memberId", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member) return res.status(404).json({ error: "Team member not found" });
    await prisma.teamMember.delete({ where: { id: memberId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete team member" });
  }
});

// List all reports
app.get("/api/admin/reports", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          reportedByUser: { select: { id: true, name: true, phone: true } },
          reportedUser: { select: { id: true, name: true, phone: true } },
          reportedStore: { select: { id: true, storeName: true } },
        },
      }),
      prisma.report.count(),
    ]);

    res.json({ reports, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// Delete report
app.delete("/api/admin/reports/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.report.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// Admin: List conversations — paginated, most recent message per pair only
app.get("/api/admin/chats", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch the most recent N*2 messages as a reasonable proxy for conversation pairs
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: "desc" },
      take: parseInt(limit) * 10, // oversample to account for duplicates per pair
      skip,
      include: {
        sender:   { select: { id: true, name: true, role: true, stores: { select: { storeName: true }, take: 1 } } },
        receiver: { select: { id: true, name: true, role: true, stores: { select: { storeName: true }, take: 1 } } },
      },
    });

    const conversationPairs = new Map<string, any>();
    for (const msg of messages) {
      const ids = [msg.senderId, msg.receiverId].sort();
      const key = ids.join("_");
      if (!conversationPairs.has(key)) {
        conversationPairs.set(key, {
          id: key,
          user1: msg.senderId === ids[0] ? msg.sender : msg.receiver,
          user2: msg.senderId === ids[1] ? msg.sender : msg.receiver,
          lastMessage: msg.message,
          timestamp: msg.createdAt,
          count: 1,
        });
      } else {
        conversationPairs.get(key).count++;
      }
    }

    const pairs = Array.from(conversationPairs.values()).slice(0, parseInt(limit));
    res.json(pairs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin chats" });
  }
});

// Admin: Get history for a conversation pair
app.get("/api/admin/chats/history", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { u1, u2 } = req.query as any;
    if (!u1 || !u2) return res.status(400).json({ error: "Both user IDs are required" });

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: u1, receiverId: u2 },
          { senderId: u2, receiverId: u1 },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, role: true, kycStoreName: true, stores: { select: { storeName: true } } } },
        receiver: { select: { id: true, name: true, role: true, kycStoreName: true, stores: { select: { storeName: true } } } },
      },
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
});

// --- App Settings Endpoints ---
// Public: Get app settings (for main app)
app.get("/api/app-settings", async (req, res) => {
  try {
    let settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      settings = await prisma.appSettings.create({ data: { id: "singleton" } });
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch app settings" });
  }
});

// Admin: Get app settings
app.get("/api/admin/settings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    let settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      settings = await prisma.appSettings.create({ data: { id: "singleton" } });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// Admin: Update app settings
app.put("/api/admin/settings", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { appName, logoUrl, primaryColor, accentColor, carouselImages } = req.body;
    const updateData: any = {};
    if (appName !== undefined) updateData.appName = appName;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor;
    if (accentColor !== undefined) updateData.accentColor = accentColor;
    if (carouselImages !== undefined) updateData.carouselImages = carouselImages;

    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: updateData,
      create: { id: "singleton", ...updateData },
    });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// Admin: Upload settings image (logo or carousel)
app.post("/api/admin/settings/upload", authenticateToken, requireAdmin, upload.single("image"), async (req: any, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    // If using S3, file.location will contain the URL; else use local path
    const imageUrl = file.location || `/uploads/${file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// --- Complaint Endpoints ---
// User: Submit a complaint
app.post("/api/complaints", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { issueType, description } = req.body;

    if (!issueType || !description) {
      return res.status(400).json({ error: "Issue type and description are required" });
    }

    const complaint = await prisma.complaint.create({
      data: { userId, issueType, description },
    });
    res.json(complaint);
  } catch (error) {
    console.error("Failed to create complaint:", error);
    res.status(500).json({ error: "Failed to submit complaint" });
  }
});

// Admin: List all complaints
app.get("/api/admin/complaints", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (status && status !== "all") where.status = status;

    const [complaints, total, openCount] = await Promise.all([
      prisma.complaint.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, phone: true, role: true } },
        },
      }),
      prisma.complaint.count({ where }),
      prisma.complaint.count({ where: { status: "open" } }),
    ]);

    res.json({ complaints, total, openCount, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// Admin: Update complaint status
app.put("/api/admin/complaints/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const updateData: any = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const complaint = await prisma.complaint.update({
      where: { id: req.params.id },
      data: updateData,
    });
    res.json(complaint);
  } catch (error) {
    res.status(500).json({ error: "Failed to update complaint" });
  }
});

// Admin: Delete complaint
app.delete("/api/admin/complaints/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await prisma.complaint.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete complaint" });
  }
});

// --- Admin Post Management ---
// Admin: List all posts
app.get("/api/admin/posts", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { search, page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = {};
    if (search) {
      where.OR = [
        { caption: { contains: search, mode: "insensitive" } },
        { store: { storeName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: "desc" },
        include: {
          store: { select: { id: true, storeName: true, owner: { select: { name: true, role: true } } } },
          _count: { select: { likes: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    res.json({ posts, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Admin: Delete a post
app.delete("/api/admin/posts/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Delete related records first
    await prisma.like.deleteMany({ where: { postId: id } });
    await prisma.savedItem.deleteMany({ where: { type: 'post', referenceId: id } });
    await prisma.post.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Admin delete post error:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// --- Search History ---
// Save search query
app.post("/api/search-history", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { query } = req.body;
    if (!query || !query.trim()) return res.status(400).json({ error: "Query is required" });

    // Avoid duplicate recent entries
    const recent = await prisma.searchHistory.findFirst({
      where: { userId, query: query.trim() },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!recent || (Date.now() - new Date(recent.createdAt).getTime()) > 60000) {
      await prisma.searchHistory.create({
        data: { userId, query: query.trim() },
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to save search history" });
  }
});

// Delete search history
app.delete("/api/search-history", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    await prisma.searchHistory.deleteMany({ where: { userId } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear search history" });
  }
});

// --- KYC Endpoints ---
// User: Submit KYC documents
app.post("/api/kyc/submit", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const { documentUrl, selfieUrl, storeName, storePhoto } = req.body;

    if (!documentUrl || !selfieUrl) {
      return res.status(400).json({ error: "Both document and selfie are required" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        kycDocumentUrl: documentUrl,
        kycSelfieUrl: selfieUrl,
        kycStatus: "pending",
        kycStoreName: storeName || null,
        kycStorePhoto: storePhoto || null,
        kycSubmittedAt: new Date(),
        kycNotes: null,
      },
      select: { id: true, kycStatus: true, kycSubmittedAt: true },
    });

    await pubClient.del(ADMIN_STATS_KEY);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit KYC" });
  }
});

// User: Check KYC status
app.get("/api/kyc/status", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, kycNotes: true, kycSubmittedAt: true, kycReviewedAt: true, kycStoreName: true, kycStorePhoto: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch KYC status" });
  }
});

// Admin: List KYC submissions
app.get("/api/admin/kyc", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { role: { not: "customer" }, kycStatus: { not: "none" } };
    if (status && status !== "all") where.kycStatus = status;

    const [users, total, pendingCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: [{ kycStatus: "asc" }, { kycSubmittedAt: "desc" }],
        select: {
          id: true, name: true, phone: true, role: true,
          kycStatus: true, kycDocumentUrl: true, kycSelfieUrl: true, kycStoreName: true, kycStorePhoto: true,
          kycNotes: true, kycSubmittedAt: true, kycReviewedAt: true,
        },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { kycStatus: "pending" } }),
    ]);

    res.json({ users, total, pendingCount, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch KYC submissions" });
  }
});

// Admin: Approve or Reject KYC
app.put("/api/admin/kyc/:userId", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body; // status: "approved" or "rejected"
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: {
        kycStatus: status,
        kycNotes: notes || null,
        kycReviewedAt: new Date(),
      },
      select: { id: true, name: true, kycStatus: true },
    });

    await pubClient.del(ADMIN_STATS_KEY);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update KYC status" });
  }
});

app.get("/api/users/:id", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, role: true, email: true }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});
// Update User Profile
app.put("/api/users/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const reqUser = (req as any).user;
    if (reqUser.userId !== id && reqUser.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to update this user" });
    }
    const { name, phone, email } = req.body;
    const user = await prisma.user.update({
      where: { id },
      data: { name, phone, email }
    });
    await pubClient.del(ADMIN_STATS_KEY);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to update user profile" });
  }
});
// Customer: followed stores
app.get("/api/users/:id/following", authenticateToken, async (req, res) => {
  try {
    const follows = await prisma.follow.findMany({
      where: { userId: req.params.id },
      include: {
        store: {
          select: { id: true, storeName: true, category: true, address: true, averageRating: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(follows.map(f => f.store));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch followed stores" });
  }
});

// Customer: saved items
app.get("/api/users/:id/saved", authenticateToken, async (req, res) => {
  try {
    const saved = await prisma.savedItem.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    // For post-type saved items, fetch associated posts
    const postIds = saved.filter(s => s.type === 'post').map(s => s.referenceId);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: { store: true }
    });
    res.json({ saved, posts });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch saved items" });
  }
});

// Customer: reviews by user
app.get("/api/users/:id/reviews", authenticateToken, async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { userId: req.params.id },
      include: {
        store: { select: { id: true, storeName: true } },
        product: { select: { id: true, productName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Customer: search history
app.get("/api/users/:id/search-history", authenticateToken, async (req, res) => {
  try {
    const history = await prisma.searchHistory.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch search history" });
  }
});

// Customer: saved locations
app.get("/api/users/:id/locations", authenticateToken, async (req, res) => {
  try {
    const locations = await prisma.savedLocation.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch saved locations" });
  }
});

// Stores
app.post("/api/stores", authenticateToken, async (req, res) => {
  try {
    // KYC gate: non-customer users must be KYC approved to create a store
    const currentUser = await prisma.user.findUnique({ where: { id: (req as any).user.userId }, select: { role: true, kycStatus: true } });
    if (currentUser && currentUser.role !== "customer" && currentUser.role !== "admin" && currentUser.kycStatus !== "approved") {
      return res.status(403).json({ error: "KYC verification required", kycStatus: currentUser.kycStatus });
    }

    const { ownerId, storeName, category, description, address, phone, 
            latitude, longitude, openingTime, closingTime, workingDays, 
            gstNumber, phoneVisible, logoUrl, postalCode, is24Hours } = req.body;
    
    // Validate unique store phone (allow same as owner's signup phone)
    if (phone) {
      const actualOwnerId = ownerId || (req as any).user.userId;
      const owner = await prisma.user.findUnique({ where: { id: actualOwnerId } });
      const normalizedPhone = phone.replace(/[\s\-()\+]/g, '');
      const ownerPhone = owner?.phone?.replace(/[\s\-()\+]/g, '') || '';
      if (normalizedPhone !== ownerPhone && normalizedPhone !== ownerPhone.replace(/^91/, '')) {
        const existingStore = await prisma.store.findFirst({ where: { phone } });
        if (existingStore) {
          return res.status(400).json({ error: "This phone number is already used by another store" });
        }
      }
    }

    const store = await prisma.store.create({ 
      data: {
        ownerId: ownerId || (req as any).user.userId,
        storeName: storeName || 'My Store',
        category: category || 'General',
        description: description || '',
        address: address || '',
        phone: phone || '',
        latitude: parseFloat(latitude) || 0,
        longitude: parseFloat(longitude) || 0,
        openingTime: openingTime || null,
        closingTime: closingTime || null,
        workingDays: workingDays || null,
        gstNumber: gstNumber || null,
        phoneVisible: phoneVisible !== undefined ? phoneVisible : true,
        logoUrl: logoUrl || null,
        postalCode: postalCode ? parseInt(postalCode) : null,
        city: req.body.city || null,
        state: req.body.state || null,
        is24Hours: is24Hours || false,
      }
    });
    res.json(store);
  } catch (error) {
    console.error("Failed to create store:", error);
    res.status(500).json({ error: "Failed to create store" });
  }
});

app.put("/api/stores/:id", authenticateToken, async (req, res) => {
  try {
    const existingStore = await prisma.store.findUnique({ where: { id: req.params.id } });
    if (!existingStore) return res.status(404).json({ error: "Store not found" });

    // Validate unique store phone if phone is being updated
    if (req.body.phone && req.body.phone !== existingStore.phone) {
      const owner = await prisma.user.findUnique({ where: { id: existingStore.ownerId } });
      const normalizedPhone = req.body.phone.replace(/[\s\-()\+]/g, '');
      const ownerPhone = owner?.phone?.replace(/[\s\-()\+]/g, '') || '';
      if (normalizedPhone !== ownerPhone && normalizedPhone !== ownerPhone.replace(/^91/, '')) {
        const otherStore = await prisma.store.findFirst({ where: { phone: req.body.phone, NOT: { id: req.params.id } } });
        if (otherStore) {
          return res.status(400).json({ error: "This phone number is already used by another store" });
        }
      }
    }

    // Parse postalCode to int if provided
    const updateData = { ...req.body };
    if (updateData.postalCode !== undefined) {
      updateData.postalCode = updateData.postalCode ? parseInt(updateData.postalCode) : null;
    }

    const store = await prisma.store.update({
      where: { id: req.params.id },
      data: updateData
    });
    await pubClient.del(ADMIN_STATS_KEY);
    res.json(store);
  } catch (error) {
    console.error("Failed to update store:", error);
    res.status(500).json({ error: "Failed to update store" });
  }
});

app.get("/api/stores", async (req, res) => {
  try {
    const { page = "1", limit = "20", category } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: any = { owner: { isBlocked: false } };
    if (category) where.category = category;
    const [stores, total] = await Promise.all([
      prisma.store.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.store.count({ where }),
    ]);
    res.json({ stores, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: "Failed to fetch stores" });
  }
});

// Pincode → City/State lookup (India Post API)
app.get("/api/pincode/:code", async (req, res) => {
  try {
    const code = req.params.code;
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Invalid pincode" });
    const response = await fetch(`https://api.postalpincode.in/pincode/${code}`);
    const data = await response.json();
    if (data?.[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      // Gather unique districts and states from all post offices
      const districts = [...new Set(data[0].PostOffice.map((p: any) => p.District))];
      const states = [...new Set(data[0].PostOffice.map((p: any) => p.State))];
      res.json({ 
        city: po.District, 
        state: po.State,
        allCities: districts,
        allStates: states,
        postOffices: data[0].PostOffice.map((p: any) => p.Name)
      });
    } else {
      res.status(404).json({ error: "Pincode not found" });
    }
  } catch (error) {
    console.error("Pincode lookup error:", error);
    res.status(500).json({ error: "Failed to look up pincode" });
  }
});

app.get("/api/stores/:id", async (req, res) => {
  const { userId } = req.query;
  const store = await prisma.store.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { role: true, isBlocked: true } },
      _count: {
        select: { posts: true, products: true, followers: true }
      },
      followers: userId ? {
        where: { userId: String(userId) }
      } : false
    }
  });
  if (!store || store.owner?.isBlocked) return res.status(404).json({ error: "Store not found" });
  // Short public cache — store profiles are read-heavy, change infrequently
  res.set('Cache-Control', 'public, max-age=30');
  res.json(store);
});

app.post("/api/stores/:id/follow", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    const storeId = req.params.id;

    const existingFollow = await prisma.follow.findUnique({
      where: {
        userId_storeId: { userId, storeId }
      }
    });

    if (existingFollow) {
      await prisma.follow.delete({
        where: { id: existingFollow.id }
      });
      res.json({ following: false });
    } else {
      await prisma.follow.create({
        data: { userId, storeId }
      });
      res.json({ following: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle follow" });
  }
});

app.get("/api/stores/:id/posts", async (req, res) => {
  try {
    const { page = "1", limit = "30" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const blockedFilter = { storeId: req.params.id, store: { owner: { isBlocked: false } } };
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: blockedFilter,
        include: {
          product: { select: { id: true, productName: true, price: true, category: true } },
          _count: { select: { likes: true } },
        },
        orderBy: [{ isOpeningPost: 'desc' }, { isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: parseInt(limit),
      }),
      prisma.post.count({ where: blockedFilter }),
    ]);
    res.json({ posts, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Products
app.post("/api/products", authenticateToken, async (req, res) => {
  try {
    const product = await prisma.product.create({ data: req.body });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.get("/api/products", async (req, res) => {
  const { search, category, storeId } = req.query;
  const where: any = { store: { owner: { isBlocked: false } } };

  if (search) {
    where.OR = [
      { productName: { contains: String(search), mode: 'insensitive' } },
      { description: { contains: String(search), mode: 'insensitive' } },
      { brand: { contains: String(search), mode: 'insensitive' } },
    ];
  }

  if (category) {
    where.category = String(category);
  }

  if (storeId) {
    where.storeId = String(storeId);
  }

  const { page = "1", limit = "20" } = req.query as any;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take: parseInt(limit), include: { store: { select: { id: true, storeName: true, logoUrl: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.product.count({ where }),
  ]);
  res.json({ products, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
});

// Mixed Search Endpoint — all filtering pushed to the database, never loads full tables
app.get("/api/search", authenticateToken, async (req, res) => {
  const userRole = (req as any).user.role;
  const { q } = req.query;
  if (!q || String(q).trim().length < 2) return res.json({ products: [], stores: [] });

  const searchStr = String(q).trim();

  // Cache search results per role+query for 60s
  const searchCacheKey = `search:${userRole}:${searchStr.toLowerCase()}`;
  try {
    const cached = await pubClient.get(searchCacheKey);
    if (cached) return res.json(JSON.parse(cached));
  } catch {}

  let allowedRoles: string[] = [];
  if (userRole === 'customer') allowedRoles = ['retailer'];
  else if (userRole === 'retailer') allowedRoles = ['retailer', 'supplier', 'manufacturer', 'brand'];
  else if (['supplier', 'manufacturer', 'brand'].includes(userRole)) allowedRoles = ['retailer'];
  else if (userRole === 'admin') allowedRoles = ['customer', 'retailer', 'supplier', 'manufacturer', 'brand', 'admin'];

  try {
    const [products, stores] = await Promise.all([
      prisma.product.findMany({
        where: {
          store: { owner: { role: { in: allowedRoles } } },
          OR: [
            { productName: { contains: searchStr, mode: 'insensitive' } },
            { brand: { contains: searchStr, mode: 'insensitive' } },
            { category: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true, productName: true, brand: true, category: true, price: true,
          storeId: true, store: { select: { id: true, storeName: true, logoUrl: true } },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.store.findMany({
        where: {
          owner: { role: { in: allowedRoles } },
          OR: [
            { storeName: { contains: searchStr, mode: 'insensitive' } },
            { category: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } },
            { address: { contains: searchStr, mode: 'insensitive' } },
            { city: { contains: searchStr, mode: 'insensitive' } },
            { state: { contains: searchStr, mode: 'insensitive' } },
            { manualProductText: { contains: searchStr, mode: 'insensitive' } },
          ],
        },
        include: {
          owner: { select: { role: true } },
        },
        take: 20,
        orderBy: { averageRating: 'desc' },
      }),
    ]);

    const result = { products, stores };
    pubClient.set(searchCacheKey, JSON.stringify(result), { EX: 60 }).catch(() => {});
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to perform search" });
  }
});

// AI-powered search — Gemini reformulates the query into structured keywords + optional category
app.get("/api/search/ai", authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q || String(q).trim().length < 2) return res.json({ products: [], stores: [], query: '' });

  const userRole = (req as any).user.role;
  let allowedRoles: string[] = [];
  if (userRole === 'customer') allowedRoles = ['retailer'];
  else if (userRole === 'retailer') allowedRoles = ['retailer', 'supplier', 'manufacturer', 'brand'];
  else if (['supplier', 'manufacturer', 'brand'].includes(userRole)) allowedRoles = ['retailer'];
  else if (userRole === 'admin') allowedRoles = ['customer', 'retailer', 'supplier', 'manufacturer', 'brand', 'admin'];

  let searchStr = String(q).trim();

  // Use Gemini to extract a clean search query from natural language
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Extract the core search keywords from this shopping query. Return ONLY a JSON object with keys "keywords" (string, 2-5 words max) and "category" (one of: Electronics, Fashion, Grocery, Food, Beauty, Sports, Health, General, Jewellery, Vehicles, Education, Services, Furniture, Pharmacy, or empty string if unclear). No explanation.\n\nQuery: "${String(q).trim()}"`
              }]
            }],
            generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
          })
        }
      );
      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.keywords) searchStr = parsed.keywords;
        }
      }
    } catch (e) {
      // Fall back to original query on any Gemini error
    }
  }

  try {
    const [products, stores] = await Promise.all([
      prisma.product.findMany({
        where: {
          store: { owner: { role: { in: allowedRoles } } },
          OR: [
            { productName: { contains: searchStr, mode: 'insensitive' } },
            { brand: { contains: searchStr, mode: 'insensitive' } },
            { category: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true, productName: true, brand: true, category: true, price: true,
          storeId: true, store: { select: { id: true, storeName: true, logoUrl: true } },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.store.findMany({
        where: {
          owner: { role: { in: allowedRoles } },
          OR: [
            { storeName: { contains: searchStr, mode: 'insensitive' } },
            { category: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } },
            { address: { contains: searchStr, mode: 'insensitive' } },
            { city: { contains: searchStr, mode: 'insensitive' } },
            { manualProductText: { contains: searchStr, mode: 'insensitive' } },
          ],
        },
        include: { owner: { select: { role: true } } },
        take: 20,
        orderBy: { averageRating: 'desc' },
      }),
    ]);
    res.json({ products, stores, query: searchStr });
  } catch (error) {
    console.error("AI search error:", error);
    res.status(500).json({ error: "Failed to perform search" });
  }
});

// Excel Upload for Products
app.post("/api/products/upload", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { storeId } = req.body;
    
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    const products = data.map((row: any) => ({
      storeId,
      productName: row.productName || row.name,
      brand: row.brand,
      category: row.category,
      price: parseFloat(row.price),
      description: row.description,
      tags: row.tags,
    }));
    
    await prisma.product.createMany({ data: products });
    
    // Clean up file
    fs.unlinkSync(req.file.path);
    
    res.json({ success: true, count: products.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to process Excel file" });
  }
});

// Posts
app.post("/api/posts", authenticateToken, async (req, res) => {
  try {
    const { storeId, caption, imageUrl, productId, price } = req.body;
    
    // Construct Prisma create data
    const postData: any = {
      caption,
      imageUrl,
      isOpeningPost: req.body.isOpeningPost || false,
      store: { connect: { id: storeId } }
    };
    if (productId) {
      postData.product = { connect: { id: productId } };
    }
    if (price !== undefined && price !== null && price !== '') {
      postData.price = parseFloat(price);
    }

    const post = await prisma.post.create({ data: postData });
    
    // Offload notification generation to background queue
    const store = await prisma.store.findUnique({ where: { id: post.storeId } });
    if (store) {
      await notificationQueue.add('publishPostNotifications', {
        postId: post.id,
        storeId: store.id,
        storeName: store.storeName
      });
    }

    res.json(post);
  } catch (error) {
    console.error("Failed to create post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

app.get("/api/posts", authenticateToken, async (req, res) => {
  const userRole = (req as any).user.role;
  const userId = (req as any).user.userId;
  const { feedType, locationRange, lat, lng } = req.query;

  const page = parseInt(String(req.query.page || '1'));
  const limit = Math.min(parseInt(String(req.query.limit || '20')), 50);
  const skip = (page - 1) * limit;

  // Cache discovery feed (no following filter, no location) per role+page — 30s TTL
  const isCacheable = !feedType || (feedType !== 'following' && (!locationRange || locationRange === 'all'));
  if (isCacheable) {
    const cacheKey = `feed:${userRole}:p${page}:l${limit}`;
    try {
      const cached = await pubClient.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    } catch {}
    // Store result after query (set below)
    (res as any)._feedCacheKey = cacheKey;
  }

  let allowedRoles: string[] = [];
  if (userRole === 'customer') allowedRoles = ['retailer'];
  else if (userRole === 'retailer') allowedRoles = ['retailer', 'supplier', 'manufacturer', 'brand'];
  else if (['supplier', 'manufacturer', 'brand'].includes(userRole)) allowedRoles = ['retailer'];
  else if (userRole === 'admin') allowedRoles = ['customer', 'retailer', 'supplier', 'manufacturer', 'brand', 'admin'];

  let storeFilter: any = { owner: { role: { in: allowedRoles }, isBlocked: false } };

  // Bounding-box filter pushed to the DB — avoids loading all posts into memory
  if (locationRange && locationRange !== 'all' && lat && lng) {
    const rangeKm = parseFloat(String(locationRange));
    const userLat = parseFloat(String(lat));
    const userLng = parseFloat(String(lng));
    const latDelta = rangeKm / 111;
    const lngDelta = rangeKm / (111 * Math.cos(userLat * Math.PI / 180));
    storeFilter = {
      ...storeFilter,
      latitude:  { gte: userLat - latDelta,  lte: userLat + latDelta  },
      longitude: { gte: userLng - lngDelta, lte: userLng + lngDelta },
    };
  }

  let whereClause: any = { store: storeFilter };

  if (feedType === 'following') {
    const follows = await prisma.follow.findMany({ where: { userId }, select: { storeId: true } });
    whereClause.storeId = { in: follows.map(f => f.storeId) };
  }

  const [total, posts] = await Promise.all([
    prisma.post.count({ where: whereClause }),
    prisma.post.findMany({
      where: whereClause,
      include: {
        store: { select: { id: true, storeName: true, logoUrl: true, latitude: true, longitude: true, category: true, averageRating: true, hideRatings: true, chatEnabled: true, ownerId: true, owner: { select: { id: true, role: true } } } },
        product: { select: { id: true, productName: true, price: true, category: true } },
        likes: { where: { userId }, select: { id: true } },
        _count: { select: { likes: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  const result = {
    posts: posts.map(p => ({ ...p, isOwnPost: p.store.ownerId === userId })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };

  // Cache cacheable feeds for 30s
  const cacheKey = (res as any)._feedCacheKey;
  if (cacheKey) {
    pubClient.set(cacheKey, JSON.stringify(result), { EX: 30 }).catch(() => {});
  }

  res.json(result);
});

// Interactions
app.get("/api/me/interactions", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    // Capped: power users liking thousands of posts won't OOM the server
    const [likes, saves, follows] = await Promise.all([
      prisma.like.findMany({ where: { userId }, take: 500, orderBy: { createdAt: 'desc' } }),
      prisma.savedItem.findMany({ where: { userId }, take: 500, orderBy: { createdAt: 'desc' } }),
      prisma.follow.findMany({ where: { userId }, take: 500, orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({
      likedPostIds: likes.map(l => l.postId),
      savedPostIds: saves.filter(s => s.type === 'post').map(s => s.referenceId),
      followedStoreIds: follows.map(f => f.storeId)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch interactions" });
  }
});

// Likes
app.post("/api/posts/:id/like", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const postId = req.params.id;

    const existingLike = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
      res.json({ liked: false });
    } else {
      await prisma.like.create({ data: { userId, postId } });
      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// Saves
app.post("/api/posts/:id/save", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const postId = req.params.id;

    const existingSave = await prisma.savedItem.findUnique({
      where: { userId_type_referenceId: { userId, type: 'post', referenceId: postId } }
    });

    if (existingSave) {
      await prisma.savedItem.delete({ where: { id: existingSave.id } });
      res.json({ saved: false });
    } else {
      await prisma.savedItem.create({ data: { userId, type: 'post', referenceId: postId } });
      res.json({ saved: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle save" });
  }
});

// Pin Posts
app.post("/api/posts/:id/pin", authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (!post.isPinned) {
      const pinnedCount = await prisma.post.count({ where: { storeId: post.storeId, isPinned: true } });
      if (pinnedCount >= 3) return res.status(400).json({ error: "Maximum 3 pinned posts allowed" });
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned }
    });
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle pin" });
  }
});
// Edit Post (caption, price, imageUrl)
app.put("/api/posts/:id", authenticateToken, async (req, res) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, include: { store: true } });
    if (!post) return res.status(404).json({ error: "Not found" });
    if (post.store.ownerId !== (req as any).user.userId) return res.status(403).json({ error: "Unauthorized" });

    const { caption, imageUrl, price } = req.body;
    const updated = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        ...(caption !== undefined && { caption }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null }),
      },
      include: { product: { select: { id: true, productName: true, price: true, category: true } }, _count: { select: { likes: true } } }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update post" });
  }
});

// Delete Single Post
app.delete("/api/posts/:id", authenticateToken, async (req, res) => {
  try {
     const post = await prisma.post.findUnique({ where: { id: req.params.id }, include: { store: true } });
     if (!post) return res.status(404).json({ error: "Not found" });
     if (post.store.ownerId !== (req as any).user.userId) return res.status(403).json({ error: "Unauthorized" });

     await prisma.like.deleteMany({ where: { postId: req.params.id } });
     await prisma.savedItem.deleteMany({ where: { type: 'post', referenceId: req.params.id } });
     await prisma.post.delete({ where: { id: req.params.id } });
     res.json({ success: true });
  } catch (error) {
     console.error("Failed to delete post:", error);
     res.status(500).json({ error: "Failed" });
  }
});

// Delete All Store Posts
app.delete("/api/stores/:storeId/posts", authenticateToken, async (req, res) => {
  try {
     const store = await prisma.store.findUnique({ where: { id: req.params.storeId } });
     if (!store || store.ownerId !== (req as any).user.userId) return res.status(403).json({ error: "Unauthorized" });

     // Fetch all post IDs to delete related records
     const posts = await prisma.post.findMany({ where: { storeId: store.id }, select: { id: true } });
     const postIds = posts.map(p => p.id);

     if (postIds.length > 0) {
       await prisma.like.deleteMany({ where: { postId: { in: postIds } } });
       await prisma.savedItem.deleteMany({ where: { type: 'post', referenceId: { in: postIds } } });
       await prisma.post.deleteMany({ where: { storeId: store.id } });
     }
     res.json({ success: true });
  } catch (error) {
     console.error("Failed to delete all store posts:", error);
     res.status(500).json({ error: "Failed" });
  }
});

// Conversations Inbox — single-pass, no N+1 queries
app.get("/api/conversations", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    // Cap at 500 most-recent messages — enough to cover any realistic inbox, avoids OOM
    const allMessages = await prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        sender:   { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
    });

    // Collect unique partner IDs in one pass
    const partnerIds = new Set<string>();
    for (const msg of allMessages) {
      partnerIds.add(msg.senderId === userId ? msg.receiverId : msg.senderId);
    }

    // Batch-fetch all partner stores in a single query (no N+1)
    const partnerStores = await prisma.store.findMany({
      where: { ownerId: { in: Array.from(partnerIds) } },
      select: { ownerId: true, storeName: true, logoUrl: true },
    });
    const storeByOwner = new Map(partnerStores.map(s => [s.ownerId, s]));

    const conversationsMap = new Map<string, any>();
    for (const msg of allMessages) {
      const isSender = msg.senderId === userId;
      const otherUser = isSender ? msg.receiver : msg.sender;
      if (conversationsMap.has(otherUser.id)) continue;

      const store = storeByOwner.get(otherUser.id);
      conversationsMap.set(otherUser.id, {
        id: msg.id,
        userId: otherUser.id,
        storeName: store?.storeName ?? otherUser.name,
        logoUrl: store?.logoUrl ?? null,
        lastMessage: msg.message,
        timestamp: msg.createdAt,
        unread: 0,
      });
    }

    res.json(Array.from(conversationsMap.values()));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Messages
app.get("/api/messages/:userId/:otherUserId", authenticateToken, async (req, res) => {
  const { userId, otherUserId } = req.params;
  const authenticatedUserId = (req as any).user.userId;
  const authenticatedUserRole = (req as any).user.role;

  // Prevent reading other people's messages
  if (authenticatedUserId !== userId && authenticatedUserId !== otherUserId) {
    return res.status(403).json({ error: "Unauthorized access to these messages" });
  }

  // Enforce Chat Permissions
  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!otherUser || !canChat(authenticatedUserRole, otherUser.role)) {
    return res.status(403).json({ error: "Role permissions do not allow chatting with this user" });
  }

  // Cursor-based pagination: default last 100 messages, client can pass ?before=<id> for history
  const { before, limit = "100" } = req.query as any;
  const take = Math.min(parseInt(limit), 100);

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
  });

  const hasMore = messages.length > take;
  if (hasMore) messages.pop();
  messages.reverse(); // ascending order for display

  res.json({ messages, hasMore, nextCursor: hasMore ? messages[0]?.id : null });
});

// Send message via HTTP (reliable fallback)
app.post("/api/messages", authenticateToken, messageLimiter, async (req, res) => {
  try {
    const senderId = (req as any).user.userId;
    const { receiverId, message, imageUrl } = req.body;
    if (!receiverId || (!message && !imageUrl)) return res.status(400).json({ error: "receiverId and message/imageUrl required" });

    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!sender || !receiver) return res.status(404).json({ error: "User not found" });
    if (!canChat(sender.role, receiver.role)) return res.status(403).json({ error: "Chat not permitted between these roles" });

    const savedMessage = await prisma.message.create({
      data: { senderId, receiverId, message: message || '', imageUrl: imageUrl || null }
    });

    // Emit via socket for real-time delivery
    io.to(receiverId).emit("newMessage", savedMessage);
    io.to(senderId).emit("newMessage", savedMessage);

    res.json(savedMessage);
  } catch (error) {
    console.error("Failed to send message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Reviews
app.get("/api/reviews/store/:storeId", async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { storeId: req.params.storeId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.review.count({ where: { storeId: req.params.storeId } }),
    ]);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ reviews, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch store reviews" });
  }
});

app.get("/api/reviews/product/:productId", async (req, res) => {
  try {
    const { page = "1", limit = "20" } = req.query as any;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId: req.params.productId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.review.count({ where: { productId: req.params.productId } }),
    ]);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ reviews, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product reviews" });
  }
});

app.post("/api/reviews", authenticateToken, async (req, res) => {
  try {
    const { rating, comment, storeId, productId } = req.body;
    const userId = (req as any).user.userId;

    if (!storeId && !productId) return res.status(400).json({ error: "Must review either a store or a product" });
    if (storeId && productId) return res.status(400).json({ error: "Cannot review both store and product at once" });

    // Ensure the rating is valid
    const validRating = Math.max(1, Math.min(5, Math.floor(rating) || 5));

    const newReview = await prisma.review.create({
      data: { rating: validRating, comment, storeId, productId, userId }
    });

    // Recalculate Average Rating
    if (storeId) {
      const aggregates = await prisma.review.aggregate({
        where: { storeId },
        _avg: { rating: true },
        _count: { id: true }
      });
      await prisma.store.update({
        where: { id: storeId },
        data: { averageRating: aggregates._avg.rating, reviewCount: aggregates._count.id }
      });
    } else if (productId) {
      const aggregates = await prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { id: true }
      });
      await prisma.product.update({
        where: { id: productId },
        data: { averageRating: aggregates._avg.rating, reviewCount: aggregates._count.id }
      });
    }

    res.json(newReview);
  } catch (error) {
    console.error("Failed to post review:", error);
    res.status(500).json({ error: "Failed to save review" });
  }
});

// Notifications
app.get("/api/notifications", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to 50 most recent
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

app.post("/api/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const notification = await prisma.notification.update({
      where: { id: req.params.id, userId }, // ensure security
      data: { isRead: true }
    });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

app.post("/api/notifications/read-all", authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// Image Uploads — returns S3 URL when configured, local path otherwise
app.post("/api/upload", authenticateToken, upload.single("file"), (req: any, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const url = (req.file as any).location ?? `/uploads/${req.file.filename}`;
  res.json({ url });
});

// Team Management — Full CRUD
// List team members for a store
app.get("/api/team/:storeId", authenticateToken, async (req, res) => {
  try {
    const { storeId } = req.params;
    const userId = (req as any).user.userId;
    const teamMemberId = (req as any).user.teamMemberId;

    // Only owner can view team (not team members)
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== userId || teamMemberId) {
      return res.status(403).json({ error: "Only the owner can manage the team" });
    }

    const members = await prisma.teamMember.findMany({
      where: { storeId },
      select: { id: true, phone: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});

// Add team member
app.post("/api/team", authenticateToken, async (req, res) => {
  try {
    const { phone, password, storeId, name } = req.body;
    const userId = (req as any).user.userId;
    const teamMemberId = (req as any).user.teamMemberId;

    // Only owner can add team members
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== userId || teamMemberId) {
      return res.status(403).json({ error: "Only the owner can add team members" });
    }

    // Validate inputs
    if (!phone || !password) return res.status(400).json({ error: "Phone and password are required" });
    if (password.length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });

    // Enforce 3-member limit
    const memberCount = await prisma.teamMember.count({ where: { storeId } });
    if (memberCount >= 3) return res.status(400).json({ error: "Maximum 3 team members allowed per store" });

    // Check unique phone
    const existing = await prisma.teamMember.findUnique({ where: { phone } });
    if (existing) return res.status(400).json({ error: "A team member with this phone number already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const member = await prisma.teamMember.create({
      data: { phone, passwordHash: hashedPassword, storeId, name: name || 'Team Member', role: 'member' },
      select: { id: true, phone: true, name: true, role: true, createdAt: true }
    });
    res.json(member);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ error: "Phone number already in use" });
    res.status(500).json({ error: "Failed to add team member" });
  }
});

// Remove team member
app.delete("/api/team/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const teamMemberId = (req as any).user.teamMemberId;

    // Only owner can remove members (and not if they're a team member themselves)
    if (teamMemberId) return res.status(403).json({ error: "Team members cannot remove other members" });

    const member = await prisma.teamMember.findUnique({ where: { id }, include: { store: true } });
    if (!member) return res.status(404).json({ error: "Team member not found" });
    if (member.store.ownerId !== userId) return res.status(403).json({ error: "Only the owner can remove team members" });

    await prisma.teamMember.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove team member" });
  }
});

// WebSocket Chat Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return next(new Error('Authentication error: Invalid token'));
    // Attach user information to the socket for later use
    (socket as any).user = decoded;
    next();
  });
});

io.on("connection", (socket) => {
  const userId = (socket as any).user.userId;
  
  // Automatically join the user to a room of their own ID to receive private messages
  socket.join(userId);
  
  socket.on("sendMessage", async (data) => {
    try {
      const { receiverId, message } = data;
      const senderId = userId;
      
      const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
      const sender = await prisma.user.findUnique({ where: { id: senderId } });
      
      if (!receiver || !sender || !canChat(sender.role, receiver.role)) {
        console.error("Chat permission denied for", sender?.role, "to", receiver?.role);
        return; // Silent drop of unauthorized message
      }
      
      const savedMessage = await prisma.message.create({
        data: { senderId, receiverId, message, imageUrl: data.imageUrl || null }
      });
      
      io.to(receiverId).emit("newMessage", savedMessage);
      io.to(senderId).emit("newMessage", savedMessage); // echo back to sender

      // Auto-reply: first message from a customer to a retailer triggers a BullMQ delayed job
      // (BullMQ survives server restarts; setTimeout does not)
      if (receiver?.role === 'retailer' && sender?.role === 'customer') {
        const previousMessages = await prisma.message.count({ where: { senderId, receiverId } });
        if (previousMessages === 1) {
          const store = await prisma.store.findFirst({ where: { ownerId: receiverId } });
          if (store) {
            await notificationQueue.add('autoReply', {
              senderId,
              receiverId,
              storeName: store.storeName,
              senderName: sender.name,
              storePhone: store.phone,
              storeAddress: store.address,
            }, { delay: 1000 });
          }
        }
      }
    } catch (error) {
      console.error("Failed to save message:", error);
    }
  });
  
  socket.on("disconnect", () => {});
});

async function ensureAdminAccount() {
  const ADMIN_PHONE = '8595572765';
  const ADMIN_PASSWORD = '12345678';
  const ADMIN_NAME = 'Mandeep';

  try {
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.user.upsert({
      where: { id: PROTECTED_ADMIN_ID },
      update: { phone: ADMIN_PHONE, name: ADMIN_NAME, role: 'admin', isBlocked: false },
      create: {
        id: PROTECTED_ADMIN_ID,
        phone: ADMIN_PHONE,
        password: hashed,
        name: ADMIN_NAME,
        role: 'admin',
      },
    });
  } catch {
    // If upsert by ID fails (fresh DB), upsert by phone
    try {
      const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
      const existing = await prisma.user.findUnique({ where: { phone: '8595572765' } });
      if (existing) {
        await prisma.user.update({
          where: { phone: '8595572765' },
          data: { role: 'admin', isBlocked: false, name: ADMIN_NAME },
        });
      } else {
        await prisma.user.create({
          data: { id: PROTECTED_ADMIN_ID, phone: ADMIN_PHONE, password: hashed, name: ADMIN_NAME, role: 'admin' },
        });
      }
    } catch {}
  }
}

async function startServer() {
  const PORT = 3000;

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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
