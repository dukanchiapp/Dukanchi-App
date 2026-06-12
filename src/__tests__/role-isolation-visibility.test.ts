import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * Role-isolation suite — STORE / SEARCH / FEED VISIBILITY. (test/role-isolation-matrix)
 *
 * Encodes the INTENDED SPEC (a failing spec assertion = a real isolation
 * leak → report, do not weaken). The visibility rule lives in the Prisma
 * `owner.role.in` filter each service builds from the viewer's role, so the
 * authoritative assertion is on the WHERE clause the real service constructs
 * (with mocked Prisma — Rule F, no real DB). For the store list we ALSO
 * simulate the DB filter so we can assert the RESULT SET literally excludes
 * non-visible roles.
 *
 * Spec:
 *   - customer viewer  → sees ONLY owner.role === 'retailer'
 *   - B2B viewer (retailer/supplier/brand/manufacturer) → sees the B2B set
 *     ['retailer','supplier','brand','manufacturer'] (customers excluded)
 *   - customer hitting a non-retailer store profile directly → blocked
 *
 * NOTE (spec vs code, NOT a leak): the task spec says customer→non-retailer
 * store detail should be 403. The code returns 404 *by design* — store.controller
 * comments "return 404 (not 403) to avoid leaking existence". 404 is STRICTER
 * than 403 (it hides existence entirely), so the isolation boundary IS enforced.
 * We assert the real, more-secure 404 and flag the status-code nuance in the
 * session summary rather than manufacture a failing 403 test.
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
    store: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    post: { findMany: vi.fn(), count: vi.fn() },
    follow: { findMany: vi.fn() },
    like: { findMany: vi.fn(), groupBy: vi.fn() },
    savedItem: { groupBy: vi.fn() },
    message: { findMany: vi.fn() },
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

// store.service imports generateEmbedding at module top — stub it so importing
// the REAL StoreService doesn't pull the Gemini client. (Lazy-called only in
// createProduct, never on the read paths under test.)
vi.mock('../services/geminiEmbeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([]),
  embedProductBatch: vi.fn().mockResolvedValue(undefined),
}));

// Stub SearchService so importing SearchController doesn't pull pgvector/Gemini,
// AND so we can assert the controller passes the correct allowedRoles to it.
vi.mock('../modules/search/search.service', () => ({
  SearchService: {
    performStandardSearch: vi.fn().mockResolvedValue({ products: [], stores: [] }),
    performAISearch: vi.fn().mockResolvedValue({ products: [], stores: [], query: '' }),
    getSuggestions: vi.fn().mockResolvedValue([]),
    saveSearchHistory: vi.fn(),
    clearSearchHistory: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

import { storeRoutes } from '../modules/stores/store.routes';
import { postRoutes } from '../modules/posts/post.routes';
import { searchRoutes } from '../modules/search/search.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser, makeTestStore } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';
import { SearchService } from '../modules/search/search.service';

type Role = 'customer' | 'retailer' | 'supplier' | 'brand' | 'manufacturer' | 'admin';
const B2B_SET = ['retailer', 'supplier', 'brand', 'manufacturer'];
const jwtFor = (role: Role) =>
  signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role });

beforeEach(() => {
  vi.clearAllMocks();
  // authenticateToken availability check → always an available user.
  vi.mocked(prisma.user.findUnique).mockResolvedValue(
    makeTestUser({ role: 'customer' }) as never,
  );
});

// ── 1. STORE LIST VISIBILITY ────────────────────────────────────────────────
describe('role-isolation › store list (GET /api/stores)', () => {
  // Fixtures keyed by the owner role the store belongs to. The mock simulates
  // the DB `owner.role.in` filter so we can assert the literal result set.
  const FIXTURES = [
    { id: 'store-retailer', storeName: 'R', _ownerRole: 'retailer' },
    { id: 'store-supplier', storeName: 'S', _ownerRole: 'supplier' },
    { id: 'store-brand', storeName: 'B', _ownerRole: 'brand' },
    { id: 'store-manufacturer', storeName: 'M', _ownerRole: 'manufacturer' },
    { id: 'store-customer', storeName: 'C', _ownerRole: 'customer' },
  ];

  const wireFilteredStore = () => {
    vi.mocked(prisma.store.findMany).mockImplementation(
      async (args: any) => FIXTURES.filter(s => args.where.owner.role.in.includes(s._ownerRole)) as never,
    );
    vi.mocked(prisma.store.count).mockImplementation(
      async (args: any) => FIXTURES.filter(s => args.where.owner.role.in.includes(s._ownerRole)).length as never,
    );
  };

  const app = () => makeTestApp({ routes: { '/api/stores': storeRoutes } });

  it('customer → WHERE restricts to retailer-only AND result set excludes all B2B + customer stores', async () => {
    wireFilteredStore();
    const res = await request(app())
      .get('/api/stores?page=1&limit=20')
      .set('Cookie', `dk_token=${jwtFor('customer')}`);

    expect(res.status).toBe(200);
    // Mechanism: the service restricted the query to retailer.
    const where = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(where.where.owner.role.in).toEqual(['retailer']);
    // Result: ONLY the retailer store; supplier/brand/manufacturer ABSENT.
    const ids = res.body.stores.map((s: any) => s.id);
    expect(ids).toEqual(['store-retailer']);
    expect(ids).not.toContain('store-supplier');
    expect(ids).not.toContain('store-brand');
    expect(ids).not.toContain('store-manufacturer');
  });

  for (const viewer of ['retailer', 'supplier', 'brand', 'manufacturer'] as Role[]) {
    it(`B2B viewer (${viewer}) → WHERE = B2B set AND customer-owned stores excluded`, async () => {
      wireFilteredStore();
      const res = await request(app())
        .get('/api/stores?page=1&limit=20')
        .set('Cookie', `dk_token=${jwtFor(viewer)}`);

      expect(res.status).toBe(200);
      const where = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
      expect(where.where.owner.role.in).toEqual(B2B_SET);
      const ids = res.body.stores.map((s: any) => s.id);
      expect(ids).toEqual(
        expect.arrayContaining(['store-retailer', 'store-supplier', 'store-brand', 'store-manufacturer']),
      );
      expect(ids).not.toContain('store-customer'); // customers never in a B2B viewer's store list
    });
  }
});

// ── 2. STORE DETAIL VISIBILITY ──────────────────────────────────────────────
describe('role-isolation › store detail (GET /api/stores/:id)', () => {
  const app = () => makeTestApp({ routes: { '/api/stores': storeRoutes } });
  const ownedBy = (role: string) =>
    ({
      ...makeTestStore({ id: '00000000-0000-0000-0000-000000000010' }),
      owner: { role, isBlocked: false, deletedAt: null },
      _count: { posts: 0, products: 0, followers: 0 },
    }) as never;

  it('customer → non-retailer (supplier) store profile → 404 (existence-hidden; spec said 403, code is stricter)', async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValue(ownedBy('supplier'));
    const res = await request(app())
      .get('/api/stores/00000000-0000-0000-0000-000000000010')
      .set('Cookie', `dk_token=${jwtFor('customer')}`);
    expect(res.status).toBe(404);
    expect(res.body.id).toBeUndefined(); // no store body leaked
  });

  it('customer → retailer store profile → 200 (allowed)', async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValue(ownedBy('retailer'));
    const res = await request(app())
      .get('/api/stores/00000000-0000-0000-0000-000000000010')
      .set('Cookie', `dk_token=${jwtFor('customer')}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('00000000-0000-0000-0000-000000000010');
  });

  it('B2B viewer (supplier) → supplier store profile → 200 (B2B can view B2B)', async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValue(ownedBy('supplier'));
    const res = await request(app())
      .get('/api/stores/00000000-0000-0000-0000-000000000010')
      .set('Cookie', `dk_token=${jwtFor('supplier')}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('00000000-0000-0000-0000-000000000010');
  });
});

// ── 3. STORE POSTS VISIBILITY ───────────────────────────────────────────────
describe('role-isolation › store posts (GET /api/stores/:id/posts)', () => {
  const app = () => makeTestApp({ routes: { '/api/stores': storeRoutes } });

  beforeEach(() => {
    vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.post.count).mockResolvedValue(0 as never);
  });

  it('customer → posts query restricted to retailer-owned stores', async () => {
    const res = await request(app())
      .get('/api/stores/00000000-0000-0000-0000-000000000010/posts?page=1&limit=20')
      .set('Cookie', `dk_token=${jwtFor('customer')}`);
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(where.where.store.owner.role.in).toEqual(['retailer']);
  });

  it('B2B viewer (manufacturer) → posts query uses B2B set', async () => {
    const res = await request(app())
      .get('/api/stores/00000000-0000-0000-0000-000000000010/posts?page=1&limit=20')
      .set('Cookie', `dk_token=${jwtFor('manufacturer')}`);
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(where.where.store.owner.role.in).toEqual(B2B_SET);
  });
});

// ── 4. FEED VISIBILITY ──────────────────────────────────────────────────────
describe('role-isolation › feed (GET /api/posts)', () => {
  const app = () => makeTestApp({ routes: { '/api/posts': postRoutes } });

  beforeEach(() => {
    // Empty everything so getFeed completes (empty candidate set short-circuits
    // the scoring queries) and we can read the candidate post.findMany WHERE.
    vi.mocked(prisma.follow.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.like.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.like.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.savedItem.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.message.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.post.count).mockResolvedValue(0 as never);
    vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
  });

  it('customer → feed candidate query restricted to retailer-authored posts', async () => {
    const res = await request(app())
      .get('/api/posts?page=1&limit=10')
      .set('Cookie', `dk_token=${jwtFor('customer')}`);
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(where.where.store.owner.role.in).toEqual(['retailer']);
  });

  it('retailer → feed candidate query uses B2B set (retailer sees B2B-authored posts)', async () => {
    const res = await request(app())
      .get('/api/posts?page=1&limit=10')
      .set('Cookie', `dk_token=${jwtFor('retailer')}`);
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(where.where.store.owner.role.in).toEqual(['retailer', 'supplier', 'manufacturer', 'brand']);
  });
});

// ── 5. SEARCH VISIBILITY ────────────────────────────────────────────────────
describe('role-isolation › search (GET /api/search)', () => {
  const app = () => makeTestApp({ routes: { '/api/search': searchRoutes } });

  const allowedRolesFor = async (viewer: Role): Promise<string[]> => {
    const res = await request(app())
      .get('/api/search?q=phones')
      .set('Cookie', `dk_token=${jwtFor(viewer)}`);
    expect(res.status).toBe(200);
    // Controller derives allowedRoles from viewer role + passes to the service.
    return vi.mocked(SearchService.performStandardSearch).mock.calls[0][1] as string[];
  };

  it('customer → search restricted to retailer profiles only', async () => {
    expect(await allowedRolesFor('customer')).toEqual(['retailer']);
  });

  it('retailer → search sees the B2B set', async () => {
    expect(await allowedRolesFor('retailer')).toEqual(['retailer', 'supplier', 'manufacturer', 'brand']);
  });

  it('supplier/brand/manufacturer → search sees the B2B set (no customers)', async () => {
    for (const r of ['supplier', 'brand', 'manufacturer'] as Role[]) {
      expect(await allowedRolesFor(r)).toEqual(['retailer', 'supplier', 'manufacturer', 'brand']);
    }
  });
});
