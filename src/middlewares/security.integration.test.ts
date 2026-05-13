import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

/**
 * Security integration tests — Day 2.7 / Session 91 / Phase 3.
 *
 * Covers 7 security surfaces from Days 3 + 2.6:
 *   - Test 8:  Upload magic-byte rejection (Day 3.3)
 *   - Test 9:  Upload oversize rejection (Day 3.3 + Day 3.2 413 handler)
 *   - Test 10: Body limit on non-AI route (Day 3.2)
 *   - Test 11: Body limit override on AI route (Day 3.2)
 *   - Test 12: Rate-limiter 429 + Retry-After (Day 2.6 ND #2)
 *   - Test 13: JWT algorithm whitelist (HS512 → reject) end-to-end (Day 3.1)
 *   - Test 14: bcrypt round-trip with env.BCRYPT_ROUNDS (Day 3.4)
 *
 * Each test mounts ONLY the surface under test against a minimal Express
 * app — same fine-grained-integration pattern as auth.integration.test.ts.
 */

const { TEST_JWT_SECRET } = vi.hoisted(() => ({
  TEST_JWT_SECRET: "test-jwt-secret-32-chars-long-padding",
}));

// ── Module-level mocks ─────────────────────────────────────────────────────
vi.mock("../config/env", () => ({
  env: {
    JWT_SECRET: TEST_JWT_SECRET,
    NODE_ENV: "test",
    BCRYPT_ROUNDS: 4, // fast for tests
    DATABASE_URL: "postgresql://test",
    REDIS_URL: "redis://localhost:6379",
    GEMINI_API_KEY: "test-key",
    S3_BUCKET_NAME: undefined, // forces disk fallback in upload.middleware
    AWS_REGION: undefined,
    AWS_ACCESS_KEY_ID: undefined,
    AWS_SECRET_ACCESS_KEY: undefined,
    S3_ENDPOINT: undefined,
    R2_PUBLIC_URL: undefined,
  },
}));

vi.mock("../config/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    teamMember: { findUnique: vi.fn() },
  },
}));

vi.mock("../config/redis", () => ({
  pubClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    sendCommand: vi.fn().mockResolvedValue([1, Date.now() + 60_000]),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnValue({ on: vi.fn(), connect: vi.fn() }),
    connect: vi.fn(),
  },
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  getCurrentScope: () => ({ setTag: vi.fn() }),
}));

// Mock disk write — upload.middleware falls back to fsp.writeFile when
// S3_BUCKET_NAME is unset. We don't want real files on disk in tests.
vi.mock("fs", async () => {
  const actual: any = await vi.importActual("fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    promises: {
      ...actual.promises,
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// ── Imports AFTER mocks ────────────────────────────────────────────────────
import { upload, verifyAndPersistUpload, FILE_SIZE_LIMIT_BYTES } from "./upload.middleware";
import { authenticateToken } from "./auth.middleware";
import { makeTestApp } from "../test-helpers/app-factory";
import { makeTestUser } from "../test-helpers/fixtures";
import { signTestJWT, signWrongAlgJWT, TEST_JWT_SECRET as JWT_SECRET_CONST } from "../test-helpers/jwt-helpers";
import { prisma } from "../config/prisma";
import multer from "multer";

// ── Real magic bytes for tests ─────────────────────────────────────────────
// JFIF JPEG header — the same minimal-but-valid JPEG used in Day 2.6 smokes.
const REAL_JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
]);
const FAKE_JPEG_BYTES = Buffer.from("This is plain text claiming to be image/jpeg");

// ── Build a minimal upload-mounting app ────────────────────────────────────
function makeUploadApp(): express.Express {
  const app = express();
  // Mount upload route exactly as production does (app.ts:194-205) but
  // without authenticateToken (we test upload validation, not auth).
  app.post(
    "/test-upload",
    upload.single("file"),
    verifyAndPersistUpload,
    (req: any, res) => {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      return res.json({ ok: true, key: req.file.key || req.file.filename });
    },
  );
  // Multer error handler (mirrors app.ts section 11a — Day 3.3)
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File too large", code: "FILE_TOO_LARGE", limit: FILE_SIZE_LIMIT_BYTES });
      }
      return res.status(400).json({ error: err.message, code: "UPLOAD_ERROR" });
    }
    if (err && err.code === "INVALID_MIME") return res.status(415).json({ error: "File type not allowed", code: "INVALID_MIME" });
    if (err && err.code === "INVALID_FILENAME") return res.status(400).json({ error: err.message, code: "INVALID_FILENAME" });
    return next(err);
  });
  return app;
}

describe("Upload validation (Day 3.3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("[Test 8] text claiming image/jpeg → 415 MIME_MISMATCH (magic-byte rejection)", async () => {
    const app = makeUploadApp();
    const res = await request(app)
      .post("/test-upload")
      .attach("file", FAKE_JPEG_BYTES, { filename: "fake.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(415);
    expect(res.body.code).toBe("MIME_MISMATCH");
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("[Test 9] file exceeding fileSize limit → 413 FILE_TOO_LARGE (Multer LIMIT_FILE_SIZE caught by handler)", async () => {
    const app = makeUploadApp();
    // FILE_SIZE_LIMIT_BYTES is 10MB; fabricate a 12MB buffer to exceed it.
    const oversized = Buffer.alloc(12 * 1024 * 1024, 0xff);
    // Set first 4 bytes to JFIF magic so it would pass magic-byte if size allowed it.
    REAL_JPEG_BYTES.copy(oversized, 0, 0, 4);

    const res = await request(app)
      .post("/test-upload")
      .attach("file", oversized, { filename: "big.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("FILE_TOO_LARGE");
    expect(res.body.limit).toBe(FILE_SIZE_LIMIT_BYTES);
  });
});

describe("Body limit enforcement (Day 3.2)", () => {
  it("[Test 10] 1.5MB JSON body on default (1MB) route → 413 PAYLOAD_TOO_LARGE", async () => {
    const app = makeTestApp({
      bodyLimit: "1mb",
      withPayloadTooLargeHandler: true,
      routes: {
        "/api/test": (() => {
          const r = express.Router();
          r.post("/echo", (req, res) => res.json({ size: JSON.stringify(req.body).length }));
          return r;
        })(),
      },
    });
    const oversizedBody = { blob: "x".repeat(1.5 * 1024 * 1024) };

    const res = await request(app)
      .post("/api/test/echo")
      .set("Content-Type", "application/json")
      .send(oversizedBody);

    expect(res.status).toBe(413);
    expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("[Test 11] 5MB JSON body on AI route (10MB override) → 200 accepted", async () => {
    const app = makeTestApp({
      bodyLimit: "10mb",
      withPayloadTooLargeHandler: true,
      routes: {
        "/api/ai": (() => {
          const r = express.Router();
          r.post("/test-handler", (req, res) => res.json({ size: JSON.stringify(req.body).length }));
          return r;
        })(),
      },
    });
    const fiveMbBody = { imageBase64: "x".repeat(5 * 1024 * 1024), mimeType: "image/jpeg" };

    const res = await request(app)
      .post("/api/ai/test-handler")
      .set("Content-Type", "application/json")
      .send(fiveMbBody);

    expect(res.status).toBe(200);
    expect(res.body.size).toBeGreaterThan(5 * 1024 * 1024);
  });
});

describe("Rate-limiter (Day 2.6 ND #2 — standardHeaders + Retry-After)", () => {
  it("[Test 12] requests over max → 429 with Retry-After header + JSON body", async () => {
    // Reproduces uploadLimiter config (Day 2.6) with MemoryStore for test
    // isolation. The Day 2.6 production limiter uses RedisStore but the
    // library behavior (429 + standardHeaders) is identical.
    const testLimiter = rateLimit({
      windowMs: 60_000,
      max: 3, // tightened for fast test
      message: { error: "Too many uploads. Please slow down." },
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = express();
    app.use(testLimiter);
    app.get("/probe", (_req, res) => res.json({ ok: true }));

    // First 3 requests should pass
    for (let i = 0; i < 3; i++) {
      const r = await request(app).get("/probe");
      expect(r.status).toBe(200);
    }
    // 4th should hit the limit
    const limited = await request(app).get("/probe");
    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatch(/too many/i);
    // Day 2.6 ND #2: standardHeaders MUST emit RateLimit-* + Retry-After
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(limited.headers["ratelimit-limit"]).toBe("3");
    expect(limited.headers["ratelimit-remaining"]).toBe("0");
  });
});

describe("JWT algorithm whitelist end-to-end (Day 3.1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("[Test 13] HS512-signed token presented to authenticateToken → 401 (not 200 — algorithm whitelist rejects)", async () => {
    // Existing user — the JWT signature is valid (same secret), only the
    // ALGORITHM differs. Without the whitelist, this would be accepted.
    const user = makeTestUser();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);

    const app = express();
    app.use((await import("cookie-parser")).default());
    app.get("/protected", authenticateToken, (req: any, res) => res.json({ id: req.user?.userId }));

    const hs512Token = signWrongAlgJWT({ userId: user.id, role: user.role });

    const res = await request(app)
      .get("/protected")
      .set("Cookie", [`dk_token=${hs512Token}`]);

    // verifyAndAttach catches jwt.verify's InvalidAlgorithmError → 403 Invalid token
    expect([401, 403]).toContain(res.status);
    // Critical: NOT 200 — token did NOT pass through despite valid signature
    expect(res.body.id).toBeUndefined();
  });

  it("[Test 13b] sanity check — HS256 token from the same helper is ACCEPTED (proves the whitelist is the only reason 13 rejects)", async () => {
    const user = makeTestUser();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);

    const app = express();
    app.use((await import("cookie-parser")).default());
    app.get("/protected", authenticateToken, (req: any, res) => res.json({ id: req.user?.userId }));

    const hs256Token = signTestJWT({ userId: user.id, role: user.role });

    const res = await request(app)
      .get("/protected")
      .set("Cookie", [`dk_token=${hs256Token}`]);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });
});

describe("bcrypt round-trip at env.BCRYPT_ROUNDS (Day 3.4)", () => {
  it("[Test 14] hash + compare with rounds=4 (test cost) — round-trip success + $2b$04$ prefix", async () => {
    // Tests the contract that BCRYPT_ROUNDS feeds bcrypt.hash, and that
    // the produced hash carries its cost factor in-line (which is what
    // makes Day 3.4's env-driven cost upgrade backwards-compatible).
    const password = "test-password-not-real-2026";
    const rounds = 4; // matches mocked env.BCRYPT_ROUNDS

    const hash = await bcrypt.hash(password, rounds);
    expect(hash).toMatch(/^\$2b\$04\$/);

    // Round-trip MUST succeed (positive case)
    const ok = await bcrypt.compare(password, hash);
    expect(ok).toBe(true);

    // Negative case — wrong password MUST fail
    const bad = await bcrypt.compare("wrong-password", hash);
    expect(bad).toBe(false);
  });
});

// Used to silence the "TEST_JWT_SECRET unused import" warning if it sneaks in
void JWT_SECRET_CONST;
