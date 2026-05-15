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

const { TEST_JWT_SECRET, TEST_JWT_REFRESH_SECRET } = vi.hoisted(() => ({
  TEST_JWT_SECRET: "test-jwt-secret-32-chars-long-padding",
  TEST_JWT_REFRESH_SECRET: "test-refresh-secret-32-chars-long-pad",
}));

// ── Module-level mocks (hoisted by vi.mock) ────────────────────────────────
vi.mock("../../config/env", () => ({
  env: {
    JWT_SECRET: TEST_JWT_SECRET,
    // Day 5: refresh-token signing secret — must differ from JWT_SECRET so
    // a leaked access-token secret doesn't also forge refresh tokens.
    JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
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
    // Day 5: refresh-token rotation uses Set operations on rt:family:* and
    // EXPIRE to re-stamp the family-set TTL on each rotation.
    sAdd: vi.fn().mockResolvedValue(1),
    sMembers: vi.fn().mockResolvedValue([]),
    expire: vi.fn().mockResolvedValue(1),
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
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";
import { authRoutes } from "./auth.routes";
import { makeTestApp } from "../../test-helpers/app-factory";
import {
  makeTestUser,
  makeDeletedPendingUser,
  makeBlockedUser,
} from "../../test-helpers/fixtures";
import { signTestJWT } from "../../test-helpers/jwt-helpers";
import { rtActiveKey } from "../../lib/redis-keys";

const app = makeTestApp({ routes: { "/api/auth": authRoutes } });

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[Test 1] valid credentials → 200 + accessToken + refreshToken in response body + both cookies set (Day 5: dual-token issuance)", async () => {
    const user = makeTestUser({ role: "customer" });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: "9876543210", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Day 5: response body now carries BOTH tokens (+ legacy `token` alias
    // for native clients that haven't yet shipped the refresh-aware build).
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.token).toBe(res.body.accessToken);
    expect(res.body.user.id).toBe(user.id);
    // Password must NOT leak in response
    expect(res.body.user.password).toBeUndefined();
    // Set-Cookie header carries BOTH dk_token (access, 15min) AND dk_refresh
    // (refresh, 30d, path=/api/auth) — fixes ND #2 admin-routing bug for
    // customer role too by going through setAuthCookies helper.
    const setCookie = res.headers["set-cookie"];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    expect(cookieStr).toContain("dk_token=");
    expect(cookieStr).toContain("dk_refresh=");
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

  it("[Test 7] deleted_pending user → 200 + rotated token pair (preserves Day 2.5 carve-out under Day 5 rotation flow)", async () => {
    const user = makeDeletedPendingUser();
    // user-status check in the controller queries prisma after refresh
    // verify succeeds. Return deleted_pending so the carve-out branch
    // (status.unavailable + reason === 'deleted_pending' → ALLOW) fires.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);

    // Construct a refresh token that verifyRefreshToken will accept:
    //   - signed with TEST_JWT_REFRESH_SECRET (matches env mock)
    //   - HS256, with the new payload shape (type: 'refresh' + jti + familyId)
    //   - rt:active:{userId}:{jti} must return truthy so verifyRefreshToken
    //     sees the token as "still active" (not yet rotated or revoked)
    const jti = crypto.randomUUID();
    const familyId = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { userId: user.id, role: user.role, jti, familyId, type: "refresh" },
      TEST_JWT_REFRESH_SECRET,
      { algorithm: "HS256", expiresIn: 30 * 24 * 60 * 60 },
    );

    // Per-test override: pubClient.get returns '1' only for the rt:active
    // key for this token; everything else (rt:blacklist, etc.) returns null.
    const activeKey = rtActiveKey(user.id, jti);
    vi.mocked(pubClient.get).mockImplementation(async (key: string) =>
      key === activeKey ? "1" : null,
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`dk_refresh=${refreshToken}`])
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // Day 5: response carries new access + new refresh tokens (rotation).
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    // Rotated refresh token MUST differ from input (new jti) — this is the
    // Day 5 rotation contract, and unlike Day 2.5's renew-same-token, the
    // jti UUID differs even when iat collides at second-resolution.
    expect(res.body.refreshToken).not.toBe(refreshToken);
    // Both cookies re-set
    const setCookie = res.headers["set-cookie"];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    expect(cookieStr).toContain("dk_token=");
    expect(cookieStr).toContain("dk_refresh=");
  });
});
