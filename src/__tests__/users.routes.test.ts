import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * Users routes integration tests — Day 7 / Session 94 / Phase 4.
 *
 * Covers GET /api/users/:id (profile read with role-based visibility),
 * PUT /api/users/:id (ownership gate), and auth/not-found cases.
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
    user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    teamMember: { findUnique: vi.fn() },
    follow: { findMany: vi.fn() },
    savedItem: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    searchHistory: { findMany: vi.fn() },
    savedLocation: { findMany: vi.fn() },
    store: { findFirst: vi.fn() },
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

// UserService is NOT mocked — we want its code to execute so it counts
// toward coverage. Service only calls Prisma, which IS mocked above.

import { userRoutes } from '../modules/users/user.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_ID = '00000000-0000-0000-0000-000000000002';

describe('users routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeTestUser({ id: USER_ID, role: 'retailer' }) as never,
    );
  });

  const buildApp = () => makeTestApp({ routes: { '/api/users': userRoutes } });

  const retailerJwt = () => signTestJWT({ userId: USER_ID, role: 'retailer' });

  it('GET /api/users/:id → 200 with user profile (happy path)', async () => {
    // UserService.getUserProfile → prisma.user.findFirst — let the real
    // service code run; mock only the Prisma response.
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: USER_ID,
      name: 'Retailer One',
      role: 'retailer',
      email: null,
    } as never);

    const res = await request(buildApp())
      .get(`/api/users/${USER_ID}`)
      .set('Cookie', `dk_token=${retailerJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(USER_ID);
    expect(res.body.role).toBe('retailer');
  });

  it('GET /api/users/:id → 404 when user does not exist', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const res = await request(buildApp())
      .get(`/api/users/${OTHER_ID}`)
      .set('Cookie', `dk_token=${retailerJwt()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('GET /api/users/:id → 401 when no auth cookie', async () => {
    const res = await request(buildApp()).get(`/api/users/${USER_ID}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('PUT /api/users/:id → 403 when JWT user tries to update someone else', async () => {
    const res = await request(buildApp())
      .put(`/api/users/${OTHER_ID}`)
      .set('Cookie', `dk_token=${retailerJwt()}`)
      .send({ name: 'Hijack attempt' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/unauthorized to update/i);
  });
});
