import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

/**
 * Auth routes integration tests — Day 2.7 / Session 91 / Phase 2.
 *
 * Covers POST /api/auth/login (happy path + 3 rejection branches),
 * GET /api/auth/me (with + without token), and POST /api/auth/refresh
 * (Day 2.5 deleted_pending carve-out).
 *
 * Pattern: mount a minimal Express app via makeTestApp() with the
 * authRoutes router. Module-level mocks (hoisted via vi.mock) stub
 * bcrypt, prisma, redis, env, logger, Sentry, and the rate-limiter
 * middleware so the test exercises the controller + service + middleware
 * COMPOSITION without external dependencies. This is fine-grained
 * integration — closer to E2E than the existing pure-unit auth.middleware
 * tests, but still fully mocked (Rule F).
 *
 * NOT tested here (Day 5 territory):
 *   - Refresh-token rotation (current /refresh just renews same JWT)
 *   - Logout blacklist invalidation
 *   - Family-reuse detection
 *
 * Day 5 will add a NEW test file (e.g., refresh-rotation.integration.test.ts)
 * covering the new behavior with the same scaffolding.
 */

const { TEST_JWT_SECRET } = vi.hoisted(() => ({
  TEST_JWT_SECRET: "test-jwt-secret-32-chars-long-padding",
}));

// ── Module-level mocks (hoisted by vi.mock) ────────────────────────────────
vi.mock("../../config/env", () => ({
  env: {
    JWT_SECRET: TEST_JWT_SECRET,
    NODE_ENV: "test",
    BCRYPT_ROUNDS: 4,
    DATABASE_URL: "postgresql://test",
    REDIS_URL: "redis://localhost:6379",
    GEMINI_API_KEY: "test-key",
  },
  getAllowedOrigins: () => ["http://localhost"],
  isNgrokOrigin: () => false,
}));

vi.mock("../../config/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    teamMember: { findUnique: vi.fn() },
  },
}));

vi.mock("../../config/redis", () => ({
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

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
}));

// Mock the rate-limiter to be a pass-through — testing rate-limit behavior
// is a SEPARATE test (security.integration.test.ts uses its own MemoryStore
// limiter to verify 429 + Retry-After).
vi.mock("../../middlewares/rate-limiter.middleware", () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  uploadLimiter: (_req: any, _res: any, next: any) => next(),
  generalLimiter: (_req: any, _res: any, next: any) => next(),
  messageLimiter: (_req: any, _res: any, next: any) => next(),
}));

// Mock bcrypt — tests control compare() return per-case
vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("$2b$04$mockedhashforpasswordtests0123456789012345678901234"),
  },
}));

// ── Imports AFTER mocks (modules now see mocked deps) ──────────────────────
import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma";
import { authRoutes } from "./auth.routes";
import { makeTestApp } from "../../test-helpers/app-factory";
import {
  makeTestUser,
  makeDeletedPendingUser,
  makeBlockedUser,
} from "../../test-helpers/fixtures";
import { signTestJWT } from "../../test-helpers/jwt-helpers";

const app = makeTestApp({ routes: { "/api/auth": authRoutes } });

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Test 1] valid credentials → 200 + token in response body + dk_token cookie set", async () => {
    const user = makeTestUser({ role: "customer" });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: "9876543210", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.id).toBe(user.id);
    // Password must NOT leak in response
    expect(res.body.user.password).toBeUndefined();
    // Set-Cookie header carries dk_token for the cookie auth path
    const setCookie = res.headers["set-cookie"];
    expect(Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie)).toContain("dk_token=");
  });

  it("[Test 2] wrong password → 401 with generic 'Invalid credentials' (Day 3.5 info-leak fix preserved)", async () => {
    const user = makeTestUser();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValue(null);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: "9876543210", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
    // No specific reason leaks (not "blocked", not "deleted") — security property
    expect(res.body.status).toBeUndefined();
  });

  it("[Test 3] blocked user with correct password → 401 status='blocked' (UnavailableUserError → unavailableError shape)", async () => {
    const user = makeBlockedUser();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: "9876543210", password: "correct-password" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Account blocked");
    expect(res.body.status).toBe("blocked");
  });

  it("[Test 4] deleted_pending user with correct password → 401 status='deleted_pending' (login still rejects; carve-out is /refresh only)", async () => {
    const user = makeDeletedPendingUser();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: "9876543210", password: "correct-password" });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("deleted_pending");
    expect(res.body.error).toMatch(/restore/i);
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Test 5] valid token → 200 with user payload (password stripped)", async () => {
    const user = makeTestUser();
    // /me calls prisma.user.findUnique to look up the full user by id from JWT
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);

    const token = signTestJWT({ userId: user.id, role: user.role });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [`dk_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.password).toBeUndefined();
  });

  it("[Test 6] no token → 401 'Access denied' (auth middleware short-circuit)", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Access denied");
  });
});

describe("POST /api/auth/refresh (Day 2.5 carve-out preserved)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Test 7] deleted_pending user → 200 + new token (preserves Day 2.5 carve-out: grace-period users must be able to refresh to reach /restore)", async () => {
    const user = makeDeletedPendingUser();
    // authenticateAllowDeleted calls user-status which queries prisma; the
    // refresh handler then calls AuthService.issueTokenForUser which also
    // queries prisma. Both lookups return the same deleted_pending user.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);

    const token = signTestJWT({ userId: user.id, role: user.role });

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`dk_token=${token}`])
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(typeof res.body.token).toBe("string");
    // NOTE: We intentionally do NOT assert that the new token differs from
    // the input — JWT `iat` is in seconds, and within the same second both
    // tokens carry identical payload+secret → identical signature. That's
    // a Day 2.5 implementation detail; Day 5 will introduce true rotation
    // (refresh tokens with a `jti` UUID per issue) and that test belongs
    // with the new behavior, not this carve-out test.
  });
});
