import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * Stores routes integration tests — Day 7 / Session 94 / Phase 4.
 *
 * Coverage of /api/stores/:id GET (read path — highest production-traffic
 * surface) and POST /api/stores (validation surface via Zod createStoreSchema).
 *
 * Pattern mirrors src/modules/auth/auth.integration.test.ts (Day 2.7).
 * No real DB / Redis (Rule F).
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
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    store: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
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

import { storeRoutes } from '../modules/stores/store.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser, makeTestStore } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';

describe('stores routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const buildApp = () => makeTestApp({ routes: { '/api/stores': storeRoutes } });

  const validJwt = () =>
    signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role: 'retailer' });

  it('GET /api/stores/:id → 200 with store body for valid id', async () => {
    const user = makeTestUser({ role: 'retailer' });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    const store = makeTestStore();
    // store.service.getStoreById uses findFirst with include (deletedAt filter).
    vi.mocked(prisma.store.findFirst).mockResolvedValue({
      ...store,
      owner: { role: 'retailer', isBlocked: false, deletedAt: null },
      _count: { posts: 0, products: 0, followers: 0 },
    } as never);

    const res = await request(buildApp())
      .get(`/api/stores/${store.id}`)
      .set('Cookie', `dk_token=${validJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(store.id);
    expect(res.body.storeName).toBe(store.storeName);
  });

  it('GET /api/stores/:id → 404 when store does not exist', async () => {
    const user = makeTestUser({ role: 'retailer' });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);
    vi.mocked(prisma.store.findFirst).mockResolvedValue(null);

    const res = await request(buildApp())
      .get('/api/stores/00000000-0000-0000-0000-000000000099')
      .set('Cookie', `dk_token=${validJwt()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('GET /api/stores/:id → 401 when no auth cookie', async () => {
    const res = await request(buildApp()).get('/api/stores/00000000-0000-0000-0000-000000000010');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('POST /api/stores → 400 when required field missing (Zod validation)', async () => {
    const user = makeTestUser({ role: 'retailer', kycStoreName: 'Test Shop' });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);

    const res = await request(buildApp())
      .post('/api/stores')
      .set('Cookie', `dk_token=${validJwt()}`)
      .send({}); // empty body — missing storeName / category / address / etc.

    expect(res.status).toBe(400);
    // Zod errors come back with `errors` or similar; just confirm 400 fired
  });
});
