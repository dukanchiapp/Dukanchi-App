import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Smoke tests for the auth middleware — Day 2.5 / Session 88.
 *
 * Covers the two critical surfaces of the soft-delete cascade in the gate:
 *   1. verifyAndAttach (via authenticateToken) — strict path that MUST reject
 *      all three unavailable reasons with HTTP 401 + the canonical
 *      { error, status } body shape.
 *   2. authenticateAllowDeleted — permissive variant that MUST:
 *        - accept users with reason="deleted_pending" (the carve-out for /restore + /refresh)
 *        - still reject reason="blocked" and reason="deleted_expired"
 *
 * Mocking strategy:
 *   - env is mocked so the middleware boots with a known JWT_SECRET
 *   - jwt itself is real (we sign tokens with the mocked secret)
 *   - prisma + pubClient are mocked to satisfy the teamMemberExists imports
 *     (not actually exercised — our tokens carry no teamMemberId)
 *   - The user-status module's isUserUnavailable is mocked so we control
 *     the (blocked|pending|expired|ok) result the middleware sees.
 *     The real unavailableError is kept (we want the canonical body shape).
 *
 * NOT tested here (deferred to Day 2.7):
 *   - JWT verification failure paths (invalid sig, expired, malformed)
 *   - Team-member revocation path
 *   - authenticateAdminToken / authenticateAny cookie selection
 *   - End-to-end Express integration (route → middleware → handler)
 */

// `vi.hoisted` makes the secret available during mock factory hoisting
// (vi.mock runs before regular top-level const initialization).
const { TEST_JWT_SECRET } = vi.hoisted(() => ({
  TEST_JWT_SECRET: "test-jwt-secret-32-chars-long-padding",
}));

// ──────────────────────────────────────────────────────────────────────────
// Hoisted mocks — these run before any import below.
// ──────────────────────────────────────────────────────────────────────────
vi.mock("../config/env", () => ({
  env: { JWT_SECRET: TEST_JWT_SECRET, NODE_ENV: "test" },
}));
vi.mock("../config/prisma", () => ({
  prisma: { teamMember: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } },
}));
vi.mock("../config/redis", () => ({
  pubClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  },
}));
vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
}));

// Mock the user-status module's isUserUnavailable only. Keep unavailableError
// real — we want to verify the middleware emits the canonical body shape.
vi.mock("./user-status", async () => {
  const actual = await vi.importActual<typeof import("./user-status")>("./user-status");
  return {
    ...actual,
    isUserUnavailable: vi.fn(),
  };
});

// Imports must come AFTER mocks
import jwt from "jsonwebtoken";
import { authenticateToken, authenticateAllowDeleted } from "./auth.middleware";
import { isUserUnavailable } from "./user-status";

// Test helpers
function makeReq(token: string) {
  return { cookies: { dk_token: token }, headers: {} } as unknown as Parameters<typeof authenticateToken>[0];
}
function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  // chain support: res.status(401).json({...})
  (res.status as any).mockReturnValue(res);
  (res.json as any).mockReturnValue(res);
  return res as unknown as Parameters<typeof authenticateToken>[1];
}

const validToken = () => jwt.sign({ userId: "test-user-id" }, TEST_JWT_SECRET);

describe("authenticateToken (strict) — rejects all 3 unavailable reasons with 401", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects blocked user → 401 { error: 'Account blocked', status: 'blocked' }", async () => {
    vi.mocked(isUserUnavailable).mockResolvedValue({
      unavailable: true,
      reason: "blocked",
      status: { isBlocked: true, deletedAt: null, blockedReason: null },
    });

    const req = makeReq(validToken());
    const res = makeRes();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Account blocked", status: "blocked" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects deleted_pending user → 401 with restore guidance", async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(isUserUnavailable).mockResolvedValue({
      unavailable: true,
      reason: "deleted_pending",
      status: { isBlocked: false, deletedAt: futureDate, blockedReason: null },
    });

    const req = makeReq(validToken());
    const res = makeRes();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Account scheduled for deletion. Restore via /api/account/restore.",
      status: "deleted_pending",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects deleted_expired user → 401 { error: 'Account deleted', status: 'deleted_expired' }", async () => {
    vi.mocked(isUserUnavailable).mockResolvedValue({
      unavailable: true,
      reason: "deleted_expired",
      status: null,
    });

    const req = makeReq(validToken());
    const res = makeRes();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Account deleted", status: "deleted_expired" });
    expect(next).not.toHaveBeenCalled();
  });

  it("admits an active user (calls next, no error response)", async () => {
    vi.mocked(isUserUnavailable).mockResolvedValue({
      unavailable: false,
      status: { isBlocked: false, deletedAt: null, blockedReason: null },
    });

    const req = makeReq(validToken());
    const res = makeRes();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("authenticateAllowDeleted (permissive) — carve-out for /restore + /refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts deleted_pending user (calls next — required for /restore to be reachable)", async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    vi.mocked(isUserUnavailable).mockResolvedValue({
      unavailable: true,
      reason: "deleted_pending",
      status: { isBlocked: false, deletedAt: futureDate, blockedReason: null },
    });

    const req = makeReq(validToken());
    const res = makeRes();
    const next = vi.fn();

    await authenticateAllowDeleted(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("STILL rejects blocked user even on permissive path → 401 status='blocked'", async () => {
    vi.mocked(isUserUnavailable).mockResolvedValue({
      unavailable: true,
      reason: "blocked",
      status: { isBlocked: true, deletedAt: null, blockedReason: null },
    });

    const req = makeReq(validToken());
    const res = makeRes();
    const next = vi.fn();

    await authenticateAllowDeleted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Account blocked", status: "blocked" });
    expect(next).not.toHaveBeenCalled();
  });

  it("STILL rejects deleted_expired user even on permissive path → 401 status='deleted_expired'", async () => {
    vi.mocked(isUserUnavailable).mockResolvedValue({
      unavailable: true,
      reason: "deleted_expired",
      status: null,
    });

    const req = makeReq(validToken());
    const res = makeRes();
    const next = vi.fn();

    await authenticateAllowDeleted(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Account deleted", status: "deleted_expired" });
    expect(next).not.toHaveBeenCalled();
  });

  it("admits an active user (parity with strict path)", async () => {
    vi.mocked(isUserUnavailable).mockResolvedValue({
      unavailable: false,
      status: { isBlocked: false, deletedAt: null, blockedReason: null },
    });

    const req = makeReq(validToken());
    const res = makeRes();
    const next = vi.fn();

    await authenticateAllowDeleted(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
