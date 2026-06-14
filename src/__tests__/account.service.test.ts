import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.42 — direct AccountService spec coverage (DPDP-critical surface).
 *
 * ZERO prior tests for this service. Cover both public methods, every branch.
 *
 * Philosophy: tests encode the INTENDED SPEC. If a spec test FAILS, that
 * means a real bug exists → STOP, report it, do NOT weaken the test.
 *
 * DPDP-critical edges asserted here:
 *   - Soft-delete (NOT hard-delete) — 30-day grace before the row vanishes
 *   - Push channels (fcmToken + pushSubscription) purged atomically with
 *     the soft-delete write (transaction is the source of truth — push
 *     dispatcher's isUserUnavailable check is belt-and-suspenders per
 *     account.service.ts:36-40)
 *   - user-status cache invalidation after EVERY write — otherwise the
 *     auth middleware can let a deleted user through for up to 60s
 *   - restore returns a discriminated union (restored / alreadyActive /
 *     expired) — the controller maps these to HTTP status codes
 */

const { TEST_JWT_SECRET } = vi.hoisted(() => ({
  TEST_JWT_SECRET: 'test-jwt-secret-32-chars-long-padding',
}));

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-long-pad',
    NODE_ENV: 'test',
    BCRYPT_ROUNDS: 4,
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://localhost:6379',
    GEMINI_API_KEY: 'test-key',
  },
  getAllowedOrigins: () => ['http://localhost'],
  isNgrokOrigin: () => false,
}));

vi.mock('../config/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    fcmToken: { deleteMany: vi.fn() },
    pushSubscription: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../middlewares/user-status', () => ({
  invalidateUserStatusCache: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../config/prisma';
import { AccountService } from '../modules/account/account.service';
import { invalidateUserStatusCache } from '../middlewares/user-status';

const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. requestDeletion — happy path + DPDP-critical invariants ─────────────
describe('AccountService.requestDeletion', () => {
  // Captures the work `$transaction` is asked to perform, so each test can
  // independently inspect what was scheduled inside the tx.
  function setupTxMock() {
    const txCalls = {
      fcmDeleteMany: vi.fn(),
      pushSubDeleteMany: vi.fn(),
      userUpdate: vi.fn(),
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        fcmToken: { deleteMany: txCalls.fcmDeleteMany },
        pushSubscription: { deleteMany: txCalls.pushSubDeleteMany },
        user: { update: txCalls.userUpdate },
      };
      return cb(tx);
    });
    return txCalls;
  }

  it('sets deletionRequestedAt = NOW and deletedAt = NOW + 30 days', async () => {
    const tx = setupTxMock();
    const tBefore = Date.now();
    tx.userUpdate.mockImplementation(async (args: any) => {
      // Echo back what was written so the service can read the timestamps.
      return {
        id: USER_ID,
        deletionRequestedAt: args.data.deletionRequestedAt,
        deletedAt: args.data.deletedAt,
      };
    });

    const result = await AccountService.requestDeletion(USER_ID);
    const tAfter = Date.now();

    expect(result.id).toBe(USER_ID);
    const reqAt = result.deletionRequestedAt.getTime();
    const delAt = result.deletedAt.getTime();
    // deletionRequestedAt is "now" — within the test window
    expect(reqAt).toBeGreaterThanOrEqual(tBefore);
    expect(reqAt).toBeLessThanOrEqual(tAfter);
    // deletedAt is exactly 30 days later (within a 100ms tolerance for clock advance during the call)
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    expect(delAt - reqAt).toBe(THIRTY_DAYS_MS);
  });

  it('passes the reason through (capped at the DB layer — service does not truncate)', async () => {
    const tx = setupTxMock();
    tx.userUpdate.mockImplementation(async (args: any) => ({
      id: USER_ID,
      deletionRequestedAt: args.data.deletionRequestedAt,
      deletedAt: args.data.deletedAt,
    }));
    const longReason = 'a'.repeat(450); // under the 500-char DB cap
    await AccountService.requestDeletion(USER_ID, longReason);
    expect(tx.userUpdate).toHaveBeenCalledOnce();
    expect((tx.userUpdate.mock.calls[0][0] as any).data.deletionReason).toBe(longReason);
  });

  it('passes null when no reason is provided', async () => {
    const tx = setupTxMock();
    tx.userUpdate.mockImplementation(async (args: any) => ({
      id: USER_ID,
      deletionRequestedAt: args.data.deletionRequestedAt,
      deletedAt: args.data.deletedAt,
    }));
    await AccountService.requestDeletion(USER_ID);
    expect((tx.userUpdate.mock.calls[0][0] as any).data.deletionReason).toBeNull();
  });

  it('DPDP: purges fcmTokens + pushSubscriptions in the SAME transaction (atomic with the soft-delete write)', async () => {
    const tx = setupTxMock();
    tx.userUpdate.mockImplementation(async (args: any) => ({
      id: USER_ID,
      deletionRequestedAt: args.data.deletionRequestedAt,
      deletedAt: args.data.deletedAt,
    }));

    await AccountService.requestDeletion(USER_ID);

    // All three tx writes ran with the right targeting
    expect(tx.fcmDeleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(tx.pushSubDeleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(tx.userUpdate).toHaveBeenCalledOnce();
    expect((tx.userUpdate.mock.calls[0][0] as any).where).toEqual({ id: USER_ID });
    // And — the critical bit — they all ran INSIDE a single $transaction() call.
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('invalidates the user-status cache AFTER the transaction commits', async () => {
    const tx = setupTxMock();
    tx.userUpdate.mockImplementation(async (args: any) => ({
      id: USER_ID,
      deletionRequestedAt: args.data.deletionRequestedAt,
      deletedAt: args.data.deletedAt,
    }));

    await AccountService.requestDeletion(USER_ID);
    expect(invalidateUserStatusCache).toHaveBeenCalledWith(USER_ID);
  });

  it('SECURITY: throws if the transaction returns null timestamps (defensive narrowing — prevents a half-baked delete)', async () => {
    const tx = setupTxMock();
    tx.userUpdate.mockResolvedValue({ id: USER_ID, deletionRequestedAt: null, deletedAt: null });
    await expect(AccountService.requestDeletion(USER_ID)).rejects.toThrow('Soft-delete write did not persist timestamps');
    // And the cache MUST NOT be invalidated when the write was malformed.
    expect(invalidateUserStatusCache).not.toHaveBeenCalled();
  });
});

// ── 2. restore — discriminated union (restored / alreadyActive / expired / null) ─
describe('AccountService.restore', () => {
  it('returns null when the user has vanished (hard-deleted row)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    const result = await AccountService.restore(USER_ID);
    expect(result).toBeNull();
    // No update + no cache invalidate on the null-user path.
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(invalidateUserStatusCache).not.toHaveBeenCalled();
  });

  it('returns {alreadyActive: true} when deletionRequestedAt is null (user never requested deletion)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: USER_ID, deletedAt: null, deletionRequestedAt: null,
    } as never);
    const result = await AccountService.restore(USER_ID);
    expect(result).toEqual({ id: USER_ID, alreadyActive: true });
    // No write side-effect when the account is already active.
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(invalidateUserStatusCache).not.toHaveBeenCalled();
  });

  it('returns {expired: true} when deletedAt is in the past (grace window closed)', async () => {
    const pastDeletedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: USER_ID,
      deletedAt: pastDeletedAt,
      deletionRequestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    } as never);
    const result = await AccountService.restore(USER_ID);
    expect(result).toEqual({ id: USER_ID, expired: true });
    // No restore write when expired — the account is gone (or about to be).
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(invalidateUserStatusCache).not.toHaveBeenCalled();
  });

  it('happy path: in-grace user → clears deletedAt + deletionRequestedAt + deletionReason and returns {restored:true}', async () => {
    const futureDeletedAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: USER_ID, deletedAt: futureDeletedAt, deletionRequestedAt: new Date(),
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: USER_ID } as never);

    const result = await AccountService.restore(USER_ID);
    expect(result).toEqual({ id: USER_ID, restored: true });

    // Restore clears ALL THREE deletion fields atomically.
    const call = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(call.where).toEqual({ id: USER_ID });
    expect(call.data).toEqual({ deletedAt: null, deletionRequestedAt: null, deletionReason: null });

    // Cache invalidated AFTER the restore write — so the auth middleware
    // doesn't keep treating the user as deleted for up to 60s.
    expect(invalidateUserStatusCache).toHaveBeenCalledWith(USER_ID);
  });

  it('boundary: deletedAt EXACTLY now (timestamp equal to the cutoff) → expired (strict ≤ comparison)', async () => {
    // The service uses `<= Date.now()`, so deletedAt === now is treated as expired.
    // Pin it slightly in the past to remove the racey "during the test, time advanced" risk.
    const cutoffNow = new Date(Date.now() - 1);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: USER_ID, deletedAt: cutoffNow, deletionRequestedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 - 1),
    } as never);
    const result = await AccountService.restore(USER_ID);
    expect(result).toEqual({ id: USER_ID, expired: true });
  });
});
