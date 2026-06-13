import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * Reviews route integration tests — D3 (Session 128.31).
 *
 * The new @@unique([userId,storeId]) / @@unique([userId,productId]) constraints
 * make a second review by the same user throw Prisma P2002. This asserts the
 * create path maps that to a clean 409 (NOT a 500), and that a first-time
 * review still succeeds. No real DB (Rule F).
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
    review: { create: vi.fn(), aggregate: vi.fn() },
    store: { update: vi.fn() },
    product: { update: vi.fn() },
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

import { reviewRoutes } from '../modules/misc/misc.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';

describe('reviews routes — D3 unique constraint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // authenticateToken availability check → available user.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeTestUser({ role: 'customer' }) as never);
  });

  const buildApp = () => makeTestApp({ routes: { '/api/reviews': reviewRoutes } });
  const customerJwt = () =>
    signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role: 'customer' });
  const STORE_ID = '11111111-1111-4111-8111-111111111111';

  it('POST /api/reviews → 409 (not 500) when the unique constraint throws Prisma P2002', async () => {
    const p2002: any = new Error('Unique constraint failed on the fields: (`userId`,`storeId`)');
    p2002.code = 'P2002';
    p2002.meta = { target: ['userId', 'storeId'] };
    vi.mocked(prisma.review.create).mockRejectedValue(p2002);

    const res = await request(buildApp())
      .post('/api/reviews')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({ rating: 5, comment: 'Great', storeId: STORE_ID });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already reviewed/i);
  });

  it('POST /api/reviews → 200 on a first-time review (P2002 handling does not break the happy path)', async () => {
    vi.mocked(prisma.review.create).mockResolvedValue({
      id: 'rev-1', rating: 5, comment: 'Great', storeId: STORE_ID, productId: null,
      userId: '00000000-0000-0000-0000-000000000001', createdAt: new Date(),
    } as never);
    vi.mocked(prisma.review.aggregate).mockResolvedValue({ _avg: { rating: 5 }, _count: { id: 1 } } as never);
    vi.mocked(prisma.store.update).mockResolvedValue({} as never);

    const res = await request(buildApp())
      .post('/api/reviews')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({ rating: 5, comment: 'Great', storeId: STORE_ID });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('rev-1');
  });
});
