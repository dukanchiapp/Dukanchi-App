import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * KYC routes integration tests — Day 7 / Session 94 / Phase 4.
 *
 * Covers GET /api/kyc/status (happy + auth), POST /api/kyc/submit (Zod
 * validation gate + admin-forbidden carve-out).
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
    user: { findUnique: vi.fn() },
    teamMember: { findUnique: vi.fn() },
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

// KycService is NOT mocked — it's a thin Prisma passthrough and counts
// toward coverage when run directly. Prisma calls are still mocked above.

import { kycRoutes } from '../modules/kyc/kyc.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';

describe('kyc routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeTestUser({ role: 'retailer' }) as never,
    );
  });

  const buildApp = () => makeTestApp({ routes: { '/api/kyc': kycRoutes } });

  const retailerJwt = () =>
    signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role: 'retailer' });
  const adminJwt = () =>
    signTestJWT({ userId: '00000000-0000-0000-0000-0000000000ad', role: 'admin' });

  it('GET /api/kyc/status → 200 with status body (happy path)', async () => {
    // KycService.getKycStatus → prisma.user.findUnique with specific select.
    // The same findUnique is also called by auth middleware's user-status check
    // (different fields). Return the union of both projections.
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...makeTestUser({ role: 'retailer' }),
      kycStatus: 'pending',
      kycNotes: null,
      kycSubmittedAt: null,
      kycReviewedAt: null,
      kycStoreName: 'Test Shop',
      kycStorePhoto: null,
    } as never);

    const res = await request(buildApp())
      .get('/api/kyc/status')
      .set('Cookie', `dk_token=${retailerJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body.kycStatus).toBe('pending');
  });

  it('POST /api/kyc/submit → 401 when no auth cookie', async () => {
    const res = await request(buildApp()).post('/api/kyc/submit').send({
      documentUrl: 'https://example.test/doc.pdf',
      selfieUrl: 'https://example.test/selfie.jpg',
      storeName: 'Test Shop',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('POST /api/kyc/submit → 400 when required fields missing (Zod validation)', async () => {
    const res = await request(buildApp())
      .post('/api/kyc/submit')
      .set('Cookie', `dk_token=${retailerJwt()}`)
      .send({ storeName: 'Test Shop' }); // missing documentUrl + selfieUrl

    expect(res.status).toBe(400);
  });

  it('POST /api/kyc/submit → 403 when caller is admin (carve-out)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeTestUser({
        id: '00000000-0000-0000-0000-0000000000ad',
        role: 'admin',
      }) as never,
    );

    const res = await request(buildApp())
      .post('/api/kyc/submit')
      .set('Cookie', `dk_token=${adminJwt()}`)
      .send({
        documentUrl: 'https://example.test/doc.pdf',
        selfieUrl: 'https://example.test/selfie.jpg',
        storeName: 'Admin shouldn’t do this',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin accounts cannot submit kyc/i);
  });
});
