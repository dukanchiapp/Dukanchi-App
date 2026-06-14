import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.43 / Phase 4.2 — direct KycService spec coverage.
 *
 * Tiny service (2 methods, 32 lines). Public surface:
 *   - submitKyc(userId, data) → user.update + pubClient.del('admin:stats')
 *   - getKycStatus(userId)    → user.findUnique({select: 6 kyc fields})
 *
 * No IDOR surface here — controller passes the requesting user's own
 * userId; the service doesn't have a "view another user's KYC" path.
 *
 * Philosophy: tests encode the INTENDED SPEC. If a spec test fails it
 * means a real bug exists → STOP, report it, do NOT weaken.
 */

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-32-chars-long-padding',
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
    user: { update: vi.fn(), findUnique: vi.fn() },
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

import { prisma } from '../config/prisma';
import { pubClient } from '../config/redis';
import { KycService } from '../modules/kyc/kyc.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('KycService.submitKyc — happy path', () => {
  it('writes the canonical kyc fields + status=pending + kycSubmittedAt=now + kycNotes=null', async () => {
    const tBefore = Date.now();
    vi.mocked(prisma.user.update).mockImplementation(async (args: any) => ({
      id: USER_ID, kycStatus: 'pending', kycSubmittedAt: args.data.kycSubmittedAt,
    } as never));
    const tAfter = Date.now();

    const result = await KycService.submitKyc(USER_ID, {
      documentUrl: 'r2://doc.jpg',
      selfieUrl: 'r2://selfie.jpg',
      storeName: 'My Dukaan',
      storePhoto: 'r2://store.jpg',
    });

    expect(result.kycStatus).toBe('pending');
    expect(prisma.user.update).toHaveBeenCalledOnce();
    const args = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(args.where).toEqual({ id: USER_ID });
    expect(args.data).toMatchObject({
      kycDocumentUrl: 'r2://doc.jpg',
      kycSelfieUrl: 'r2://selfie.jpg',
      kycStatus: 'pending',
      kycStoreName: 'My Dukaan',
      kycStorePhoto: 'r2://store.jpg',
      kycNotes: null,
    });
    // kycSubmittedAt was set to "now" — within the test window
    const submittedAt = (args.data.kycSubmittedAt as Date).getTime();
    expect(submittedAt).toBeGreaterThanOrEqual(tBefore);
    expect(submittedAt).toBeLessThanOrEqual(tAfter + 100);
  });

  it('invalidates the admin:stats cache after the write (admin dashboard reads aggregate KYC counts)', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: USER_ID, kycStatus: 'pending', kycSubmittedAt: new Date(),
    } as never);
    await KycService.submitKyc(USER_ID, { documentUrl: 'r2://doc.jpg', selfieUrl: 'r2://selfie.jpg' });
    expect(pubClient.del).toHaveBeenCalledWith('admin:stats');
  });

  it('Redis del failure does NOT propagate (non-fatal — try/catch in source line 22)', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: USER_ID, kycStatus: 'pending', kycSubmittedAt: new Date(),
    } as never);
    vi.mocked(pubClient.del).mockRejectedValueOnce(new Error('redis down'));
    // Submission still succeeds even though the cache invalidate threw.
    await expect(KycService.submitKyc(USER_ID, { documentUrl: 'r2://doc.jpg', selfieUrl: 'r2://selfie.jpg' })).resolves.toBeDefined();
  });
});

describe('KycService.submitKyc — optional store fields', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.update).mockImplementation(async (args: any) => ({
      id: USER_ID, kycStatus: 'pending', kycSubmittedAt: args.data.kycSubmittedAt,
    } as never));
  });

  it('storeName and storePhoto default to null when omitted', async () => {
    await KycService.submitKyc(USER_ID, { documentUrl: 'r2://doc.jpg', selfieUrl: 'r2://selfie.jpg' });
    const args = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(args.data.kycStoreName).toBeNull();
    expect(args.data.kycStorePhoto).toBeNull();
  });
});

describe('KycService.submitKyc — resubmission idempotency (SPEC)', () => {
  it('a SECOND submission overwrites prior fields AND resets kycNotes to null (so an admin rejection note from round 1 doesn\'t carry into round 2)', async () => {
    // First submission
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: USER_ID, kycStatus: 'pending', kycSubmittedAt: new Date(),
    } as never);
    await KycService.submitKyc(USER_ID, { documentUrl: 'r2://v1-doc.jpg', selfieUrl: 'r2://v1-selfie.jpg' });

    // Second submission — different URLs (the user is resubmitting after a rejection)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: USER_ID, kycStatus: 'pending', kycSubmittedAt: new Date(),
    } as never);
    await KycService.submitKyc(USER_ID, { documentUrl: 'r2://v2-doc.jpg', selfieUrl: 'r2://v2-selfie.jpg' });

    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    // BOTH writes must set kycNotes:null — so any prior admin "rejection
    // reason" note is cleared on resubmission. (Otherwise the new pending
    // KYC would carry the OLD rejection note, confusing both user + admin.)
    const callA = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    const callB = vi.mocked(prisma.user.update).mock.calls[1][0] as any;
    expect(callA.data.kycNotes).toBeNull();
    expect(callB.data.kycNotes).toBeNull();
    // The second write reflects v2 URLs (overwrite, not reject).
    expect(callB.data.kycDocumentUrl).toBe('r2://v2-doc.jpg');
    expect(callB.data.kycSelfieUrl).toBe('r2://v2-selfie.jpg');
  });
});

describe('KycService.getKycStatus', () => {
  it('returns the 6 selected fields for an existing user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      kycStatus: 'approved',
      kycNotes: null,
      kycSubmittedAt: new Date('2026-06-01'),
      kycReviewedAt: new Date('2026-06-02'),
      kycStoreName: 'My Dukaan',
      kycStorePhoto: 'r2://store.jpg',
    } as never);

    const result = await KycService.getKycStatus(USER_ID);
    expect(result?.kycStatus).toBe('approved');
    // Confirm the precise select shape — these 6 fields, nothing else (so we never accidentally
    // expose other User columns like password / phone / role via this endpoint).
    const selectArg = vi.mocked(prisma.user.findUnique).mock.calls[0][0] as any;
    expect(selectArg.where).toEqual({ id: USER_ID });
    expect(Object.keys(selectArg.select).sort()).toEqual(
      ['kycNotes', 'kycReviewedAt', 'kycStatus', 'kycStoreName', 'kycStorePhoto', 'kycSubmittedAt'].sort(),
    );
  });

  it('returns null when the user does not exist (vanished row)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    expect(await KycService.getKycStatus(USER_ID)).toBeNull();
  });

  it('returns a user row with kycStatus: null when they never submitted (KYC fields default-null in schema)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      kycStatus: null, kycNotes: null, kycSubmittedAt: null, kycReviewedAt: null,
      kycStoreName: null, kycStorePhoto: null,
    } as never);
    const result = await KycService.getKycStatus(USER_ID);
    expect(result?.kycStatus).toBeNull();
  });
});
