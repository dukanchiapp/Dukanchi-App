import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * Search routes integration tests — Day 7 / Session 94 / Phase 4.
 *
 * Covers GET /api/search (the customer-discovery happy path + the
 * "query too short → empty arrays" auto-recovery branch) and POST
 * /api/search/history (validation path).
 *
 * No 404 case — /api/search doesn't 404 on missing data, returns empty
 * arrays. Substituted with the empty-result branch.
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
    teamMember: { findUnique: vi.fn() },
    searchHistory: { create: vi.fn(), deleteMany: vi.fn() },
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

// Mock the search service directly to avoid pgvector / Gemini integration.
vi.mock('../modules/search/search.service', () => ({
  SearchService: {
    performStandardSearch: vi.fn().mockResolvedValue({ products: [], stores: [] }),
    getSuggestions: vi.fn().mockResolvedValue([]),
    performAISearch: vi
      .fn()
      .mockResolvedValue({ products: [], stores: [], query: 'test' }),
    saveSearchHistory: vi.fn(),
    clearSearchHistory: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

import { searchRoutes } from '../modules/search/search.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';
import { SearchService } from '../modules/search/search.service';

describe('search routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeTestUser({ role: 'customer' }) as never,
    );
  });

  const buildApp = () => makeTestApp({ routes: { '/api/search': searchRoutes } });

  const customerJwt = () =>
    signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role: 'customer' });

  it('GET /api/search?q=pen → 200 with results body (happy path)', async () => {
    vi.mocked(SearchService.performStandardSearch).mockResolvedValue({
      products: [{ id: 'p1', productName: 'Pen' }],
      stores: [],
    } as never);

    const res = await request(buildApp())
      .get('/api/search?q=pen')
      .set('Cookie', `dk_token=${customerJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].productName).toBe('Pen');
  });

  it('GET /api/search?q=p → 200 empty arrays (auto-recovery for short query)', async () => {
    // q.length < 2 → controller short-circuits to { products: [], stores: [] }
    // WITHOUT calling SearchService. Service spy should not be invoked.
    const res = await request(buildApp())
      .get('/api/search?q=p')
      .set('Cookie', `dk_token=${customerJwt()}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ products: [], stores: [] });
    expect(SearchService.performStandardSearch).not.toHaveBeenCalled();
  });

  it('GET /api/search → 401 when no auth cookie', async () => {
    const res = await request(buildApp()).get('/api/search?q=pen');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('POST /api/search/history → 400 when service throws "Query is required"', async () => {
    vi.mocked(SearchService.saveSearchHistory).mockRejectedValue(
      new Error('Query is required'),
    );

    const res = await request(buildApp())
      .post('/api/search/history')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({}); // missing `query` field

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/query is required/i);
  });
});
