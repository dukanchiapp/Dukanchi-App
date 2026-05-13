import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

/**
 * Refresh-token rotation integration tests — Day 5 / Session 92 / Phase 5.
 *
 * Covers the new Day 5 refresh-token flow end-to-end through the HTTP
 * surface. Builds on the supertest + stateful-Redis pattern established
 * in Day 2.7 (auth.integration.test.ts) and extends it with a small
 * in-memory Redis simulator (Map-backed) so tests can assert on stored
 * state (rt:active, rt:blacklist, rt:family set membership) rather than
 * mock-call invocations.
 *
 * Six tests:
 *   [T1] POST /api/auth/refresh rotates token on first use — old jti
 *        blacklisted, new jti active, both in family set.
 *   [T2] Reuse of blacklisted refresh token → 401 + entire family revoked.
 *   [T3] Refresh with invalid signature → 401, no Redis side effects.
 *   [T4] Refresh with no cookie + no header → 401, no Redis side effects.
 *   [T5] Logout blacklists current refresh jti AND access jti.
 *   [T6] Admin login sets dk_admin_refresh (NOT dk_refresh) — regression
 *        test for Day 5 audit's ND #2 admin cookie routing fix.
 *
 * Not covered here (Day 2.7 file owns it):
 *   - Day 2.5 deleted_pending carve-out — see auth.integration.test.ts T7.
 */

// ── Hoisted state + secrets ────────────────────────────────────────────────
// vi.hoisted lifts these initializations so they're available to the
// vi.mock factory below (which is itself hoisted above all imports).
const {
  TEST_JWT_SECRET,
  TEST_JWT_REFRESH_SECRET,
  stateKv,
  stateSets,
} = vi.hoisted(() => ({
  TEST_JWT_SECRET: "test-jwt-secret-32-chars-long-padding",
  TEST_JWT_REFRESH_SECRET: "test-refresh-secret-32-chars-long-pad",
  stateKv: new Map<string, string>(),
  stateSets: new Map<string, Set<string>>(),
}));

// ── Module-level mocks ─────────────────────────────────────────────────────
vi.mock("../config/env", () => ({
  env: {
    JWT_SECRET: TEST_JWT_SECRET,
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

vi.mock("../config/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    teamMember: { findUnique: vi.fn() },
  },
}));

// Stateful in-memory Redis simulator. Each method writes to / reads from
// the hoisted Maps so tests can inspect state directly via stateKv/stateSets.
// The simulator covers ONLY the commands refreshToken.service + auth.controller
// actually call; anything else returns the spec's sensible default.
vi.mock("../config/redis", () => ({
  pubClient: {
    get: vi.fn(async (key: string) => stateKv.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, _opts?: unknown) => {
      stateKv.set(key, value);
      return "OK";
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const k of keys) {
        if (stateKv.delete(k)) count++;
        if (stateSets.delete(k)) count++;
      }
      return count;
    }),
    expire: vi.fn(async () => 1),
    incr: vi.fn(async () => 1),
    sAdd: vi.fn(async (key: string, ...members: string[]) => {
      const s = stateSets.get(key) ?? new Set<string>();
      for (const m of members) s.add(m);
      stateSets.set(key, s);
      return members.length;
    }),
    sMembers: vi.fn(async (key: string) =>
      Array.from(stateSets.get(key) ?? []),
    ),
    sRem: vi.fn(async (key: string, member: string) => {
      const s = stateSets.get(key);
      if (!s) return 0;
      return s.delete(member) ? 1 : 0;
    }),
    sendCommand: vi.fn(async () => [1, Date.now() + 60_000]),
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
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("../middlewares/rate-limiter.middleware", () => ({
  authLimiter: (_req: any, _res: any, next: any) => next(),
  uploadLimiter: (_req: any, _res: any, next: any) => next(),
  generalLimiter: (_req: any, _res: any, next: any) => next(),
  messageLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn().mockResolvedValue("$2b$04$mockedhashforpasswordtests012345678901234567890"),
  },
}));

// ── Imports after mocks ────────────────────────────────────────────────────
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "../config/prisma";
import { authRoutes } from "../modules/auth/auth.routes";
import { makeTestApp } from "../test-helpers/app-factory";
import { makeTestUser } from "../test-helpers/fixtures";
import {
  rtActiveKey,
  rtBlacklistKey,
  rtFamilyKey,
  accessBlacklistKey,
} from "../lib/redis-keys";

const app = makeTestApp({ routes: { "/api/auth": authRoutes } });

// ── Helpers ────────────────────────────────────────────────────────────────

/** Construct a properly-shaped refresh token + seed state so verify accepts it. */
function seedRefreshToken(
  userId: string,
  role: string,
  opts: { familyId?: string; jti?: string; teamMemberId?: string } = {},
): { token: string; jti: string; familyId: string } {
  const jti = opts.jti ?? crypto.randomUUID();
  const familyId = opts.familyId ?? crypto.randomUUID();
  const payload: Record<string, unknown> = {
    userId,
    role,
    jti,
    familyId,
    type: "refresh",
  };
  if (opts.teamMemberId) payload.teamMemberId = opts.teamMemberId;

  const token = jwt.sign(payload, TEST_JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    expiresIn: 30 * 24 * 60 * 60,
  });

  // Seed Redis state so verifyRefreshToken sees this token as active.
  stateKv.set(rtActiveKey(userId, jti), "1");
  const family = stateSets.get(rtFamilyKey(familyId)) ?? new Set<string>();
  family.add(jti);
  stateSets.set(rtFamilyKey(familyId), family);

  return { token, jti, familyId };
}

/** Construct an access token with known jti (for logout test). */
function makeAccessToken(userId: string, role: string, jti?: string): { token: string; jti: string } {
  const useJti = jti ?? crypto.randomUUID();
  const token = jwt.sign(
    { userId, role, jti: useJti, type: "access" },
    TEST_JWT_SECRET,
    { algorithm: "HS256", expiresIn: 15 * 60 },
  );
  return { token, jti: useJti };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/auth/refresh — Day 5 rotation + theft detection", () => {
  beforeEach(() => {
    stateKv.clear();
    stateSets.clear();
    vi.clearAllMocks();
  });

  it("[T1] rotates refresh token on first use — old jti blacklisted, new jti active, both in family", async () => {
    const user = makeTestUser();
    // Controller's user-status check calls prisma.user.findUnique
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);

    const { token, jti: oldJti, familyId } = seedRefreshToken(user.id, user.role);

    // Pre-rotation invariants
    expect(stateKv.get(rtActiveKey(user.id, oldJti))).toBe("1");
    expect(stateKv.get(rtBlacklistKey(oldJti))).toBeUndefined();
    expect(stateSets.get(rtFamilyKey(familyId))?.size).toBe(1);

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`dk_refresh=${token}`])
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(token); // new jti

    // Post-rotation state:
    //   - old jti DELETED from rt:active
    //   - old jti SET in rt:blacklist (with 'rotated' marker)
    //   - new jti SET in rt:active
    //   - family set contains BOTH jtis
    expect(stateKv.has(rtActiveKey(user.id, oldJti))).toBe(false);
    expect(stateKv.get(rtBlacklistKey(oldJti))).toBe("rotated");

    // Extract new jti from response body
    const newDecoded = jwt.verify(res.body.refreshToken, TEST_JWT_REFRESH_SECRET) as { jti: string; familyId: string };
    expect(newDecoded.jti).not.toBe(oldJti);
    expect(newDecoded.familyId).toBe(familyId); // same family
    expect(stateKv.get(rtActiveKey(user.id, newDecoded.jti))).toBe("1");

    // Family set has both jtis (rotation extends the chain)
    const familyMembers = stateSets.get(rtFamilyKey(familyId));
    expect(familyMembers?.has(oldJti)).toBe(true);
    expect(familyMembers?.has(newDecoded.jti)).toBe(true);
    expect(familyMembers?.size).toBe(2);
  });

  it("[T2] reuse of blacklisted refresh token → 401 + entire family revoked", async () => {
    const user = makeTestUser();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);

    // First rotation — establishes the family with two jtis
    const { token: token1, jti: jti1, familyId } = seedRefreshToken(user.id, user.role);
    const rotateRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`dk_refresh=${token1}`])
      .send({});
    expect(rotateRes.status).toBe(200);
    const decoded = jwt.verify(rotateRes.body.refreshToken, TEST_JWT_REFRESH_SECRET) as { jti: string };
    const jti2 = decoded.jti;

    // Confirm pre-reuse state: jti1 blacklisted, jti2 active, family has both
    expect(stateKv.get(rtBlacklistKey(jti1))).toBe("rotated");
    expect(stateKv.get(rtActiveKey(user.id, jti2))).toBe("1");
    expect(stateSets.get(rtFamilyKey(familyId))?.size).toBe(2);

    // Now attempt to reuse the OLD (blacklisted) token. This is the theft
    // signal — legit client has jti2, but someone is presenting jti1.
    const reuseRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`dk_refresh=${token1}`])
      .send({});

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.code).toBe("REUSE_DETECTED");

    // Post-reuse-detection state: the ENTIRE family is revoked.
    //   - Both jtis blacklisted (jti1 stays as "rotated", jti2 added as "family_revoked")
    //   - rt:active for both jtis is DELETED
    //   - family set itself is DELETED
    expect(stateKv.get(rtBlacklistKey(jti1))).toBeTruthy();
    expect(stateKv.get(rtBlacklistKey(jti2))).toBeTruthy();
    expect(stateKv.has(rtActiveKey(user.id, jti1))).toBe(false);
    expect(stateKv.has(rtActiveKey(user.id, jti2))).toBe(false);
    expect(stateSets.has(rtFamilyKey(familyId))).toBe(false);
  });

  it("[T3] refresh with invalid signature → 401, no Redis state mutation", async () => {
    // Snapshot state before — should remain unchanged after the request.
    const kvBefore = new Map(stateKv);
    const setsBefore = new Map(stateSets);

    // Forge a JWT with the WRONG secret. Shape is valid, signature is not.
    const forgedToken = jwt.sign(
      {
        userId: "fake-user-id",
        role: "customer",
        jti: crypto.randomUUID(),
        familyId: crypto.randomUUID(),
        type: "refresh",
      },
      "wrong-secret-32-chars-long-padding",
      { algorithm: "HS256", expiresIn: "30d" },
    );

    const res = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`dk_refresh=${forgedToken}`])
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_TOKEN");

    // No state changed
    expect(stateKv).toEqual(kvBefore);
    expect(stateSets).toEqual(setsBefore);
  });

  it("[T4] refresh with no cookie + no header → 401 NO_REFRESH_TOKEN, no state mutation", async () => {
    const kvBefore = new Map(stateKv);
    const setsBefore = new Map(stateSets);

    const res = await request(app).post("/api/auth/refresh").send({});

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("NO_REFRESH_TOKEN");

    // No state changed
    expect(stateKv).toEqual(kvBefore);
    expect(stateSets).toEqual(setsBefore);
  });

  it("[T5] logout blacklists refresh jti + access jti, and post-logout refresh fails", async () => {
    const user = makeTestUser();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);

    const { token: refreshToken, jti: refreshJti } = seedRefreshToken(user.id, user.role);
    const { token: accessToken, jti: accessJti } = makeAccessToken(user.id, user.role);

    // Pre-logout: refresh jti active, access jti not blacklisted
    expect(stateKv.get(rtActiveKey(user.id, refreshJti))).toBe("1");
    expect(stateKv.has(accessBlacklistKey(accessJti))).toBe(false);

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [`dk_token=${accessToken}`, `dk_refresh=${refreshToken}`])
      .send({});

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.ok).toBe(true);

    // Post-logout:
    //   - refresh jti DELETED from rt:active
    //   - refresh jti SET in rt:blacklist (with 'logout' marker)
    //   - access jti SET in access:blacklist
    expect(stateKv.has(rtActiveKey(user.id, refreshJti))).toBe(false);
    expect(stateKv.get(rtBlacklistKey(refreshJti))).toBe("logout");
    expect(stateKv.get(accessBlacklistKey(accessJti))).toBe("logout");

    // Cookies cleared in response
    const setCookie = logoutRes.headers["set-cookie"];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    // clearCookie sends 'cookie=; Max-Age=0' or 'Expires=...' in the past
    expect(cookieStr).toMatch(/dk_token=;/);
    expect(cookieStr).toMatch(/dk_refresh=;/);

    // Attempt to refresh with the now-blacklisted token → reuse detected
    // (jti is in blacklist + no longer in active → verifyRefreshToken throws
    //  REUSE_DETECTED, controller calls detectReuseAndRevokeFamily)
    const refreshAfterLogout = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`dk_refresh=${refreshToken}`])
      .send({});

    expect(refreshAfterLogout.status).toBe(401);
    expect(refreshAfterLogout.body.code).toBe("REUSE_DETECTED");
  });

  it("[T6] admin login sets dk_admin_token + dk_admin_refresh (NOT dk_token / dk_refresh) — regression for ND #2", async () => {
    const adminUser = makeTestUser({ role: "admin" });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(adminUser as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ phone: "9876543210", password: "correct-password" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const setCookie = res.headers["set-cookie"];
    expect(Array.isArray(setCookie)).toBe(true);
    const cookieStr = (setCookie as string[]).join(";");

    // Admin role MUST set admin-prefixed cookies
    expect(cookieStr).toContain("dk_admin_token=");
    expect(cookieStr).toContain("dk_admin_refresh=");
    // And MUST NOT set the customer cookies (ND #2 fix verification)
    expect(cookieStr).not.toMatch(/(?:^|;|,\s*)dk_token=/);
    expect(cookieStr).not.toMatch(/(?:^|;|,\s*)dk_refresh=/);

    // Inverse check — customer login should set OPPOSITE cookies
    stateKv.clear();
    stateSets.clear();
    vi.clearAllMocks();
    const customerUser = makeTestUser({ role: "customer" });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(customerUser as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const customerRes = await request(app)
      .post("/api/auth/login")
      .send({ phone: "9876543210", password: "correct-password" });

    expect(customerRes.status).toBe(200);
    const customerCookieStr = (customerRes.headers["set-cookie"] as string[]).join(";");
    expect(customerCookieStr).toContain("dk_token=");
    expect(customerCookieStr).toContain("dk_refresh=");
    expect(customerCookieStr).not.toMatch(/dk_admin_token=/);
    expect(customerCookieStr).not.toMatch(/dk_admin_refresh=/);
  });
});
