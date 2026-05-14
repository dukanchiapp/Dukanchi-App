import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * Posts routes integration tests — Day 7 / Session 94 / Phase 4.
 *
 * Covers GET /api/posts (feed read — retailer engagement surface),
 * POST /api/posts (write + storeId ownership gate), and Zod validation.
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
    store: { findUnique: vi.fn() },
    post: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
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

vi.mock('../modules/posts/post.service', () => ({
  PostService: {
    getFeed: vi.fn().mockResolvedValue({ posts: [], hasMore: false }),
    createPost: vi.fn(),
  },
}));

import { postRoutes } from '../modules/posts/post.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser, makeTestPost } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';
import { PostService } from '../modules/posts/post.service';

describe('posts routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeTestUser({ role: 'retailer' }) as never,
    );
  });

  const buildApp = () => makeTestApp({ routes: { '/api/posts': postRoutes } });

  const retailerJwt = () =>
    signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role: 'retailer' });

  it('GET /api/posts → 200 with feed body (happy path)', async () => {
    const post = makeTestPost();
    vi.mocked(PostService.getFeed).mockResolvedValue({
      posts: [post],
      hasMore: false,
    } as never);

    const res = await request(buildApp())
      .get('/api/posts')
      .set('Cookie', `dk_token=${retailerJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].id).toBe(post.id);
  });

  it('POST /api/posts → 404 when storeId references nonexistent store', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/api/posts')
      .set('Cookie', `dk_token=${retailerJwt()}`)
      .send({
        storeId: '00000000-0000-0000-0000-000000000099',
        imageUrl: 'https://example.test/img.jpg',
        caption: 'Test post',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/store not found/i);
  });

  it('POST /api/posts → 401 when no auth cookie', async () => {
    const res = await request(buildApp()).post('/api/posts').send({
      storeId: '00000000-0000-0000-0000-000000000010',
      imageUrl: 'https://example.test/img.jpg',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('POST /api/posts → 400 when imageUrl missing (Zod validation)', async () => {
    const res = await request(buildApp())
      .post('/api/posts')
      .set('Cookie', `dk_token=${retailerJwt()}`)
      .send({ storeId: '00000000-0000-0000-0000-000000000010' }); // missing imageUrl

    expect(res.status).toBe(400);
  });
});
