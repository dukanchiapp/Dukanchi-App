import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Smoke tests for user-status helpers — Day 2.5 / Session 88.
 *
 * Covers the most security-critical surface of the soft-delete cascade:
 *   - isUserUnavailable: 4-state decision (active / blocked / pending / expired)
 *     plus the missing-user case (treated as expired).
 *   - visibleOwnerFilter: pure-function shape correctness.
 *
 * Mocking strategy:
 *   - prisma, pubClient, logger, Sentry are mocked at the module level so the
 *     helper's logic runs against controlled inputs with no I/O.
 *   - Cache GET returns null by default (cache miss) so we exercise the
 *     DB-fallback path and can stub the User row precisely.
 *
 * NOT tested here (deferred to Day 2.7 — Test Coverage Sprint):
 *   - Cache-hit path of getUserStatus (positive + negative sentinel)
 *   - invalidateUserStatusCache success/failure paths
 *   - Concurrent access / cache-race semantics
 *   - Real Redis integration
 */

// ──────────────────────────────────────────────────────────────────────────
// Module-level mocks — hoisted by vitest before any import below resolves.
// ──────────────────────────────────────────────────────────────────────────
vi.mock("../config/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("../config/redis", () => ({
  pubClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));
vi.mock("../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@sentry/node", () => ({
  captureException: vi.fn(),
}));

// Imports must come AFTER mocks
import { isUserUnavailable, visibleOwnerFilter } from "./user-status";
import { prisma } from "../config/prisma";
import { pubClient } from "../config/redis";

describe("isUserUnavailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: cache miss → falls through to DB
    vi.mocked(pubClient.get).mockResolvedValue(null);
    vi.mocked(pubClient.set).mockResolvedValue("OK" as never);
  });

  it("returns { unavailable: false } for an active user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      isBlocked: false,
      deletedAt: null,
    } as never);

    const result = await isUserUnavailable("active-user-id");

    expect(result.unavailable).toBe(false);
  });

  it("returns reason='blocked' when isBlocked is true", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      isBlocked: true,
      deletedAt: null,
    } as never);

    const result = await isUserUnavailable("blocked-user-id");

    expect(result.unavailable).toBe(true);
    if (result.unavailable) {
      expect(result.reason).toBe("blocked");
    }
  });

  it("returns reason='deleted_pending' when deletedAt is in the future (within grace)", async () => {
    const fiveDaysAhead = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      isBlocked: false,
      deletedAt: fiveDaysAhead,
    } as never);

    const result = await isUserUnavailable("pending-user-id");

    expect(result.unavailable).toBe(true);
    if (result.unavailable) {
      expect(result.reason).toBe("deleted_pending");
    }
  });

  it("returns reason='deleted_expired' when deletedAt is in the past (grace over)", async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      isBlocked: false,
      deletedAt: yesterday,
    } as never);

    const result = await isUserUnavailable("expired-user-id");

    expect(result.unavailable).toBe(true);
    if (result.unavailable) {
      expect(result.reason).toBe("deleted_expired");
    }
  });

  it("returns reason='deleted_expired' when User row is missing (hard-deleted)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await isUserUnavailable("missing-user-id");

    expect(result.unavailable).toBe(true);
    if (result.unavailable) {
      expect(result.reason).toBe("deleted_expired");
      expect(result.status).toBeNull();
    }
  });
});

describe("visibleOwnerFilter", () => {
  it("produces the canonical 3-gate shape for a single role", () => {
    const result = visibleOwnerFilter(["retailer"]);

    expect(result).toEqual({
      role: { in: ["retailer"] },
      isBlocked: false,
      deletedAt: null,
    });
  });

  it("preserves role order for multi-role queries (B2B view)", () => {
    const result = visibleOwnerFilter(["retailer", "supplier", "brand", "manufacturer"]);

    expect(result).toEqual({
      role: { in: ["retailer", "supplier", "brand", "manufacturer"] },
      isBlocked: false,
      deletedAt: null,
    });
  });

  it("handles empty role array — Prisma 'in: []' evaluates to a match-nothing predicate (safe default)", () => {
    const result = visibleOwnerFilter([]);

    expect(result).toEqual({
      role: { in: [] },
      isBlocked: false,
      deletedAt: null,
    });
    // Documenting the contract: a caller passing [] gets a filter that
    // matches no rows. Prevents accidentally widening visibility when an
    // upstream config bug produces an empty allowedRoles list.
  });
});
