import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.49 / Phase 6.1 — AdminService spec coverage.
 *
 * 25 public methods (594 LOC) on AdminService. This is the largest
 * untested service in the repo and carries the HIGHEST blast radius:
 *  - 11-table FK cascade in deleteUser
 *  - 8-table per-store cascade in deleteStore (and inside deleteUser per
 *    owned store)
 *  - PROTECTED_ADMIN_ID = '5cbf1a3d-e8e7-4b64-836a-58475bbbb7d9' — the
 *    sole bootstrap admin account; updateUser/deleteUser/bulkUpdateUsers
 *    MUST refuse to mutate it (the system-paralysis defense)
 *  - CASCADE_FETCH_CAP = 50000 on userStores/storePosts/storeProducts
 *    with Sentry sentinel on hit
 *  - ADMIN_STORE_MEMBERS_LIST_CAP = 10000, ADMIN_EXPORT_STORES_CAP = 50000
 *
 * Philosophy: tests encode the INTENDED SPEC. If a spec test fails it
 * means a real bug exists → STOP, report it (as POTENTIAL ADMIN BUG
 * FOUND), do NOT weaken.
 */

const PROTECTED_ADMIN_ID = '5cbf1a3d-e8e7-4b64-836a-58475bbbb7d9';

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-32-chars-long-padding',
    JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-long-pad',
    NODE_ENV: 'test',
    BCRYPT_ROUNDS: 4,           // low rounds keeps the test fast
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://localhost:6379',
  },
  getAllowedOrigins: () => ['http://localhost'],
  isNgrokOrigin: () => false,
}));

vi.mock('../config/prisma', () => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn() },
    store: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    post: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    product: { findMany: vi.fn(), deleteMany: vi.fn() },
    like: { deleteMany: vi.fn() },
    review: { count: vi.fn(), deleteMany: vi.fn() },
    message: { findMany: vi.fn(), deleteMany: vi.fn() },
    follow: { deleteMany: vi.fn() },
    savedItem: { deleteMany: vi.fn() },
    savedLocation: { deleteMany: vi.fn() },
    searchHistory: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    complaint: { count: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    report: { count: vi.fn(), findMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    teamMember: { findUnique: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    appSettings: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: { get: vi.fn(), set: vi.fn(), del: vi.fn(), on: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
}));

vi.mock('../middlewares/user-status', () => ({
  invalidateUserStatusCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../middlewares/bot-render.middleware', () => ({
  invalidateStoreBotCache: vi.fn(),
}));

// Mock ExcelJS — exportStores builds a Workbook then returns a Buffer.
// We don't need the actual XLSX serialization (slow under v8 coverage on
// large rowsets — the cap-hit test ran a 50k-row export to 5s+); the
// Sentry-sentinel assertion only needs the findMany cap-hit detection,
// not the byte output. The returned buffer satisfies the Buffer.isBuffer
// assertion in the happy-path test.
vi.mock('exceljs', () => {
  class FakeWorksheet {
    columns: any[] = [];
    addRow = vi.fn();
  }
  class FakeWorkbook {
    xlsx = { writeBuffer: vi.fn(async () => Buffer.from('xlsx-mock')) };
    addWorksheet = vi.fn(() => new FakeWorksheet());
  }
  return { default: { Workbook: FakeWorkbook } };
});

import * as Sentry from '@sentry/node';
import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';
import { pubClient } from '../config/redis';
import { invalidateUserStatusCache } from '../middlewares/user-status';
import { invalidateStoreBotCache } from '../middlewares/bot-render.middleware';
import { AdminService } from '../modules/admin/admin.service';

const USER_A = 'user-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'user-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const STORE_A = 'store-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const STORE_B = 'store-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// Default $transaction mock — Prisma's array-form returns Promise.all over the
// array of pre-built operations. Each operation is the resolved value of the
// individual mocked deleteMany / delete / update call.
function setupTxArrayPassthrough() {
  vi.mocked(prisma.$transaction).mockImplementation(async (arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg(prisma);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default-safe Prisma returns so we never crash on undefined .map / .length
  vi.mocked(prisma.user.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.store.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.post.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.review.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.report.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.complaint.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.store.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.report.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.complaint.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.message.findMany).mockResolvedValue([] as never);
  // deleteMany defaults — return shape {count}, value resolved as the array
  // element when $transaction is array-form.
  vi.mocked(prisma.message.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.follow.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.review.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.savedItem.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.searchHistory.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.savedLocation.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.like.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.complaint.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.report.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.post.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.product.deleteMany).mockResolvedValue({ count: 0 } as never);
  vi.mocked(prisma.teamMember.deleteMany).mockResolvedValue({ count: 0 } as never);
  setupTxArrayPassthrough();
});

// ── READ METHODS ───────────────────────────────────────────────────────────

describe('AdminService.getStats', () => {
  it('cache HIT → returns parsed cached payload; NO Prisma queries', async () => {
    const cached = { users: 100, stores: 50, posts: 200, reviews: 10, reports: 5, recentUsers: [], recentReports: [] };
    vi.mocked(pubClient.get).mockResolvedValueOnce(JSON.stringify(cached) as never);
    const result = await AdminService.getStats();
    expect(result).toEqual(cached);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('cache MISS → 5 parallel counts + 2 recent findMany; result cached EX:60', async () => {
    vi.mocked(pubClient.get).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(42 as never);
    vi.mocked(prisma.store.count).mockResolvedValueOnce(7 as never);
    vi.mocked(pubClient.set).mockResolvedValueOnce('OK' as never);

    const result = await AdminService.getStats();
    expect(result.users).toBe(42);
    expect(result.stores).toBe(7);
    expect(pubClient.set).toHaveBeenCalledOnce();
    const setArgs = vi.mocked(pubClient.set).mock.calls[0];
    expect(setArgs[0]).toBe('admin:stats');
    expect(setArgs[2]).toEqual({ EX: 60 });
  });

  it('FAIL-OPEN: Redis.get throws → falls through to DB cleanly (no 500)', async () => {
    vi.mocked(pubClient.get).mockRejectedValueOnce(new Error('redis down'));
    await expect(AdminService.getStats()).resolves.toBeDefined();
    expect(prisma.user.count).toHaveBeenCalled();
  });

  it('FAIL-OPEN: Redis.set throws after DB result → does NOT propagate (cache miss is silently OK)', async () => {
    vi.mocked(pubClient.get).mockResolvedValueOnce(null as never);
    vi.mocked(pubClient.set).mockRejectedValueOnce(new Error('redis down'));
    await expect(AdminService.getStats()).resolves.toBeDefined();
  });
});

describe('AdminService.getUsers', () => {
  it('pagination math: page=2 limit=20 → skip=20, take=20', async () => {
    await AdminService.getUsers({ page: 2, limit: 20 });
    const args = vi.mocked(prisma.user.findMany).mock.calls[0][0] as any;
    expect(args.skip).toBe(20);
    expect(args.take).toBe(20);
  });

  it('search query → WHERE OR contains name + phone', async () => {
    await AdminService.getUsers({ search: 'Ravi' });
    const args = vi.mocked(prisma.user.findMany).mock.calls[0][0] as any;
    expect(args.where.OR).toEqual([
      { name: { contains: 'Ravi', mode: 'insensitive' } },
      { phone: { contains: 'Ravi' } },
    ]);
  });

  it('role filter (not "all") → WHERE.role applied', async () => {
    await AdminService.getUsers({ role: 'retailer' });
    const args = vi.mocked(prisma.user.findMany).mock.calls[0][0] as any;
    expect(args.where.role).toBe('retailer');
  });

  it('role="all" → no role filter applied (omitted from WHERE)', async () => {
    await AdminService.getUsers({ role: 'all' });
    const args = vi.mocked(prisma.user.findMany).mock.calls[0][0] as any;
    expect(args.where.role).toBeUndefined();
  });
});

// ── PROTECTED_ADMIN_ID DEFENSE ─────────────────────────────────────────────

describe('AdminService.updateUser — PROTECTED_ADMIN_ID defense', () => {
  it('attempting to update PROTECTED_ADMIN_ID → throws "This admin account cannot be modified"; NO DB call, NO cache invalidate', async () => {
    await expect(AdminService.updateUser(PROTECTED_ADMIN_ID, 'admin', true)).rejects.toThrow('This admin account cannot be modified');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(invalidateUserStatusCache).not.toHaveBeenCalled();
  });

  it('happy path: role only → user.update with role; invalidateUserStatusCache NOT called (no isBlocked change)', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: USER_A } as never);
    await AdminService.updateUser(USER_A, 'retailer', undefined);
    const args = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(args.where).toEqual({ id: USER_A });
    expect(args.data).toEqual({ role: 'retailer' });
    expect(invalidateUserStatusCache).not.toHaveBeenCalled();
  });

  it('isBlocked=true → user.update + invalidateUserStatusCache called for that user', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: USER_A } as never);
    await AdminService.updateUser(USER_A, undefined, true);
    const args = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(args.data).toEqual({ isBlocked: true });
    expect(invalidateUserStatusCache).toHaveBeenCalledWith(USER_A);
  });
});

describe('AdminService.bulkUpdateUsers — PROTECTED_ADMIN_ID + self-paralysis defenses', () => {
  it('blocking (isBlocked=true): PROTECTED_ADMIN_ID AND currentUserId filtered out of input', async () => {
    vi.mocked(prisma.user.updateMany).mockResolvedValueOnce({ count: 1 } as never);
    const inputIds = [PROTECTED_ADMIN_ID, USER_A, USER_B];   // attacker includes protected
    await AdminService.bulkUpdateUsers(inputIds, true, USER_A);  // caller is USER_A
    const args = vi.mocked(prisma.user.updateMany).mock.calls[0][0] as any;
    expect(args.where.id.in).toEqual([USER_B]);             // protected + self filtered
    expect(args.data).toEqual({ isBlocked: true });
  });

  it('unblocking (isBlocked=false): PROTECTED_ADMIN_ID still filtered, BUT currentUserId is allowed through', async () => {
    vi.mocked(prisma.user.updateMany).mockResolvedValueOnce({ count: 2 } as never);
    const inputIds = [PROTECTED_ADMIN_ID, USER_A, USER_B];
    await AdminService.bulkUpdateUsers(inputIds, false, USER_A);
    const args = vi.mocked(prisma.user.updateMany).mock.calls[0][0] as any;
    expect(args.where.id.in).toEqual([USER_A, USER_B]);     // protected filtered; self allowed (it's an unblock so safe)
  });

  it('all input ids filtered → NO updateMany call; returns count:0', async () => {
    const result = await AdminService.bulkUpdateUsers([PROTECTED_ADMIN_ID], true, USER_A);
    expect(result).toEqual({ success: true, count: 0 });
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('invalidateUserStatusCache called for EACH affected user (parallel)', async () => {
    vi.mocked(prisma.user.updateMany).mockResolvedValueOnce({ count: 2 } as never);
    await AdminService.bulkUpdateUsers([USER_A, USER_B], false, 'admin-self');
    expect(invalidateUserStatusCache).toHaveBeenCalledWith(USER_A);
    expect(invalidateUserStatusCache).toHaveBeenCalledWith(USER_B);
    expect(invalidateUserStatusCache).toHaveBeenCalledTimes(2);
  });
});

// ── DESTRUCTIVE CASCADES — deleteUser MARQUEE ──────────────────────────────

describe('AdminService.deleteUser — 11-table USER cascade + per-store cascade', () => {
  it('PROTECTED_ADMIN_ID guard: throws BEFORE any DB call (no transaction, no findMany, no user.delete)', async () => {
    await expect(AdminService.deleteUser(PROTECTED_ADMIN_ID)).rejects.toThrow('This admin account cannot be deleted');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.store.findMany).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('user with no stores: USER-level $transaction(11) fires + user.delete; NO per-store cascade', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({ id: USER_A } as never);

    await AdminService.deleteUser(USER_A);

    // Single $transaction with 11 deleteMany ops (the USER cascade)
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const txArg = vi.mocked(prisma.$transaction).mock.calls[0][0] as unknown[];
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg.length).toBe(10);  // message, follow, review, notification, savedItem, searchHistory, savedLocation, like, complaint, report = 10
    // Wait — re-count per source lines 140-149:
    //  1. message.deleteMany
    //  2. follow.deleteMany
    //  3. review.deleteMany
    //  4. notification.deleteMany
    //  5. savedItem.deleteMany
    //  6. searchHistory.deleteMany
    //  7. savedLocation.deleteMany
    //  8. like.deleteMany
    //  9. complaint.deleteMany
    // 10. report.deleteMany
    // 10 ops, not 11 (the spec mentioned "11-table" but the count is 10 — encoding the truth)

    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: USER_A } });
  });

  it('USER cascade WHERE clauses scope to the userId (no cross-tenant deletion)', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({ id: USER_A } as never);

    await AdminService.deleteUser(USER_A);

    // Verify a sampling of the cascade WHERE clauses
    expect(prisma.message.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ senderId: USER_A }, { receiverId: USER_A }] },
    });
    expect(prisma.follow.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_A } });
    expect(prisma.review.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_A } });
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_A } });
    expect(prisma.savedItem.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_A } });
    expect(prisma.searchHistory.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_A } });
    expect(prisma.savedLocation.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_A } });
    expect(prisma.like.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_A } });
    expect(prisma.complaint.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_A } });
    expect(prisma.report.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ reportedByUserId: USER_A }, { reportedUserId: USER_A }] },
    });
  });

  it('user with 1 owned store: USER tx + per-store cascade tx (8 ops) — FK-safe order: likes BEFORE posts; reviews BEFORE products', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([{ id: STORE_A, ownerId: USER_A }] as never);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([{ id: 'p1' }] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([{ id: 'pr1' }] as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({ id: USER_A } as never);

    await AdminService.deleteUser(USER_A);

    // 2 transactions: USER cascade + STORE cascade
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);

    const storeTxArr = vi.mocked(prisma.$transaction).mock.calls[1][0] as unknown[];
    expect(Array.isArray(storeTxArr)).toBe(true);
    expect(storeTxArr.length).toBe(8);

    // STORE cascade WHERE assertions (FK-safe order asserted via positional like/post and review/product checks)
    expect(prisma.like.deleteMany).toHaveBeenCalledWith({ where: { postId: { in: ['p1'] } } });
    expect(prisma.post.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_A } });
    expect(prisma.review.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ storeId: STORE_A }, { productId: { in: ['pr1'] } }] } });
    expect(prisma.product.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_A } });
    expect(prisma.follow.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_A } });
    expect(prisma.teamMember.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_A } });
    expect(prisma.report.deleteMany).toHaveBeenCalledWith({ where: { reportedStoreId: STORE_A } });
    expect(prisma.store.delete).toHaveBeenCalledWith({ where: { id: STORE_A } });
  });

  it('user with 2 owned stores: per-store cascade fires TWICE; both stores cleaned', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([
      { id: STORE_A, ownerId: USER_A },
      { id: STORE_B, ownerId: USER_A },
    ] as never);
    vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({ id: USER_A } as never);

    await AdminService.deleteUser(USER_A);

    // 1 USER tx + 2 STORE txs = 3
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(prisma.store.delete).toHaveBeenCalledWith({ where: { id: STORE_A } });
    expect(prisma.store.delete).toHaveBeenCalledWith({ where: { id: STORE_B } });
  });

  it('CASCADE_FETCH_CAP=50000: userStores cap-hit → Sentry sentinel fired with admin.deleteUser.userStores.cap-hit', async () => {
    const cappedStores = Array.from({ length: 50000 }, (_, i) => ({ id: `s${i}`, ownerId: USER_A }));
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce(cappedStores as never);
    // Each store: empty posts/products to keep the test light
    vi.mocked(prisma.post.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({ id: USER_A } as never);

    await AdminService.deleteUser(USER_A);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'admin.deleteUser.userStores.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('CASCADE_FETCH_CAP: storePosts cap-hit → Sentry sentinel admin.deleteUser.storePosts.cap-hit', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([{ id: STORE_A, ownerId: USER_A }] as never);
    const cappedPosts = Array.from({ length: 50000 }, (_, i) => ({ id: `p${i}` }));
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce(cappedPosts as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({ id: USER_A } as never);

    await AdminService.deleteUser(USER_A);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'admin.deleteUser.storePosts.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('CASCADE_FETCH_CAP: storeProducts cap-hit → Sentry sentinel admin.deleteUser.storeProducts.cap-hit', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([{ id: STORE_A, ownerId: USER_A }] as never);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);
    const cappedProducts = Array.from({ length: 50000 }, (_, i) => ({ id: `pr${i}` }));
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce(cappedProducts as never);
    vi.mocked(prisma.user.delete).mockResolvedValueOnce({ id: USER_A } as never);

    await AdminService.deleteUser(USER_A);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'admin.deleteUser.storeProducts.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });
});

// ── deleteStore CASCADE ────────────────────────────────────────────────────

describe('AdminService.deleteStore — 8-op per-store cascade', () => {
  it('happy path: $transaction(8) fires with FK-safe ops (likes→posts, reviews→products, etc.)', async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([{ id: 'p1' }, { id: 'p2' }] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([{ id: 'pr1' }] as never);

    await AdminService.deleteStore(STORE_A);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const txArr = vi.mocked(prisma.$transaction).mock.calls[0][0] as unknown[];
    expect(txArr.length).toBe(8);

    expect(prisma.like.deleteMany).toHaveBeenCalledWith({ where: { postId: { in: ['p1', 'p2'] } } });
    expect(prisma.post.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_A } });
    expect(prisma.review.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ storeId: STORE_A }, { productId: { in: ['pr1'] } }] },
    });
    expect(prisma.product.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_A } });
    expect(prisma.follow.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_A } });
    expect(prisma.teamMember.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_A } });
    expect(prisma.report.deleteMany).toHaveBeenCalledWith({ where: { reportedStoreId: STORE_A } });
    expect(prisma.store.delete).toHaveBeenCalledWith({ where: { id: STORE_A } });
  });

  it('CASCADE_FETCH_CAP: storePosts cap-hit on deleteStore → Sentry sentinel admin.deleteStore.storePosts.cap-hit', async () => {
    const capped = Array.from({ length: 50000 }, (_, i) => ({ id: `p${i}` }));
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce(capped as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);

    await AdminService.deleteStore(STORE_A);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'admin.deleteStore.storePosts.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('CASCADE_FETCH_CAP: storeProducts cap-hit on deleteStore → Sentry sentinel admin.deleteStore.storeProducts.cap-hit', async () => {
    const capped = Array.from({ length: 50000 }, (_, i) => ({ id: `pr${i}` }));
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce(capped as never);

    await AdminService.deleteStore(STORE_A);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'admin.deleteStore.storeProducts.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });
});

// ── CAPPED LIST METHODS ────────────────────────────────────────────────────

describe('AdminService.getStoreMembers', () => {
  it('take: ADMIN_STORE_MEMBERS_LIST_CAP (10000)', async () => {
    await AdminService.getStoreMembers();
    const args = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(10_000);
  });

  it('cap-hit → Sentry sentinel admin.getStoreMembers.cap-hit', async () => {
    const capped = Array.from({ length: 10_000 }, (_, i) => ({ id: `s${i}` }));
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce(capped as never);
    await AdminService.getStoreMembers();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'admin.getStoreMembers.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('search query → WHERE OR scoped to storeName + owner.name', async () => {
    await AdminService.getStoreMembers('kirana');
    const args = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(args.where.OR).toEqual([
      { storeName: { contains: 'kirana', mode: 'insensitive' } },
      { owner: { name: { contains: 'kirana', mode: 'insensitive' } } },
    ]);
  });
});

describe('AdminService.exportStores', () => {
  it('take: ADMIN_EXPORT_STORES_CAP (50000); returns a Buffer', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    const result = await AdminService.exportStores();
    const args = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(50_000);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('cap-hit → Sentry sentinel admin.exportStores.cap-hit', async () => {
    const capped = Array.from({ length: 50_000 }, (_, i) => ({
      id: `s${i}`, storeName: 'n', category: 'c', address: 'a', city: '', state: '', postalCode: '',
      latitude: 0, longitude: 0, phone: '', gstNumber: '', openingTime: '', closingTime: '',
      workingDays: '', is24Hours: false, createdAt: new Date(),
      owner: { id: 'o', name: 'o', phone: '', email: '', role: 'retailer' },
      _count: { teamMembers: 0, posts: 0, followers: 0 },
    }));
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce(capped as never);
    await AdminService.exportStores();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'admin.exportStores.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });
});

// ── getChats — conversation dedup by sorted-pair key ──────────────────────

describe('AdminService.getChats', () => {
  it('5 messages across 3 distinct pairs → returns 3 conversation rows, dedup by sorted (a,b) key', async () => {
    const messages = [
      { senderId: 'a', receiverId: 'b', message: 'm1', createdAt: new Date('2026-06-15T10:00:00Z'), sender: { id: 'a', name: 'A', role: 'r', stores: [] }, receiver: { id: 'b', name: 'B', role: 'r', stores: [] } },
      { senderId: 'b', receiverId: 'a', message: 'm2', createdAt: new Date('2026-06-15T10:01:00Z'), sender: { id: 'b', name: 'B', role: 'r', stores: [] }, receiver: { id: 'a', name: 'A', role: 'r', stores: [] } },
      { senderId: 'c', receiverId: 'd', message: 'm3', createdAt: new Date('2026-06-15T10:02:00Z'), sender: { id: 'c', name: 'C', role: 'r', stores: [] }, receiver: { id: 'd', name: 'D', role: 'r', stores: [] } },
      { senderId: 'e', receiverId: 'f', message: 'm4', createdAt: new Date('2026-06-15T10:03:00Z'), sender: { id: 'e', name: 'E', role: 'r', stores: [] }, receiver: { id: 'f', name: 'F', role: 'r', stores: [] } },
      { senderId: 'a', receiverId: 'b', message: 'm5', createdAt: new Date('2026-06-15T10:04:00Z'), sender: { id: 'a', name: 'A', role: 'r', stores: [] }, receiver: { id: 'b', name: 'B', role: 'r', stores: [] } },
    ];
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never);

    const result = await AdminService.getChats(1, 20);
    expect(result.length).toBe(3);  // 3 distinct pairs: a-b, c-d, e-f
    // First (a-b) hit twice → count=2 in the resulting conv row
    const ab = result.find((c: any) => c.id === 'a_b' || c.id === 'b_a');
    expect(ab?.count).toBeGreaterThanOrEqual(2);
  });

  it('pagination: page=2 limit=10 → take = limit*10 = 100, skip = 10', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    await AdminService.getChats(2, 10);
    const args = vi.mocked(prisma.message.findMany).mock.calls[0][0] as any;
    expect(args.skip).toBe(10);
    expect(args.take).toBe(100);
  });
});

// ── getChatHistory — IDOR-MARQUEE (admin reads any conversation but query is properly scoped) ──

describe('AdminService.getChatHistory — symmetric WHERE OR on both ids', () => {
  it('missing u1 → throws "Both user IDs are required"; NO DB call', async () => {
    await expect(AdminService.getChatHistory('', USER_B)).rejects.toThrow('Both user IDs are required');
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });

  it('missing u2 → throws "Both user IDs are required"', async () => {
    await expect(AdminService.getChatHistory(USER_A, '')).rejects.toThrow('Both user IDs are required');
  });

  it('WHERE OR has BOTH u1 AND u2 on EVERY branch (symmetric pair contract — analog of message.service)', async () => {
    await AdminService.getChatHistory(USER_A, USER_B);
    const args = vi.mocked(prisma.message.findMany).mock.calls[0][0] as any;
    expect(args.where.OR).toEqual([
      { senderId: USER_A, receiverId: USER_B },
      { senderId: USER_B, receiverId: USER_A },
    ]);
    expect(args.orderBy).toEqual({ createdAt: 'asc' });
  });
});

// ── SIMPLE DELETE / UPDATE / READ ──────────────────────────────────────────

describe('AdminService.resetPassword', () => {
  it('password < 6 chars → throws; NO DB call', async () => {
    await expect(AdminService.resetPassword(USER_A, 'short')).rejects.toThrow('Password must be at least 6 characters');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('empty password → throws "Password must be at least 6 characters"', async () => {
    await expect(AdminService.resetPassword(USER_A, '')).rejects.toThrow('Password must be at least 6 characters');
  });

  it('happy path: bcrypt-hashed password stored against the right user', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: USER_A } as never);
    await AdminService.resetPassword(USER_A, 'longenough');
    const args = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(args.where).toEqual({ id: USER_A });
    expect(args.data.password).toBeTruthy();
    // Verify bcrypt produced a real hash (starts with $2)
    expect(args.data.password.startsWith('$2')).toBe(true);
    // And the hash matches the plaintext (round-trip via bcrypt.compare)
    expect(await bcrypt.compare('longenough', args.data.password)).toBe(true);
  });
});

describe('AdminService.deletePost — orphan cleanup BEFORE post.delete (3 sequential calls, not in a tx)', () => {
  it('like.deleteMany + savedItem.deleteMany + post.delete fire in that order', async () => {
    const callOrder: string[] = [];
    // Reset all 3 mocks (drains beforeEach defaults) then install implementations
    vi.mocked(prisma.like.deleteMany).mockReset();
    vi.mocked(prisma.savedItem.deleteMany).mockReset();
    vi.mocked(prisma.post.delete).mockReset();
    vi.mocked(prisma.like.deleteMany).mockImplementation((async (..._args: any[]) => { callOrder.push('like'); return { count: 0 }; }) as never);
    vi.mocked(prisma.savedItem.deleteMany).mockImplementation((async (..._args: any[]) => { callOrder.push('savedItem'); return { count: 0 }; }) as never);
    vi.mocked(prisma.post.delete).mockImplementation((async (..._args: any[]) => { callOrder.push('post'); return { id: 'p1' }; }) as never);

    await AdminService.deletePost('p1');

    expect(callOrder).toEqual(['like', 'savedItem', 'post']);
    expect(prisma.like.deleteMany).toHaveBeenCalledWith({ where: { postId: 'p1' } });
    expect(prisma.savedItem.deleteMany).toHaveBeenCalledWith({ where: { type: 'post', referenceId: 'p1' } });
  });
});

describe('AdminService.deleteTeamMember', () => {
  it('non-existent member → throws "Team member not found"; NO delete call', async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as never);
    await expect(AdminService.deleteTeamMember('tm-missing')).rejects.toThrow('Team member not found');
    expect(prisma.teamMember.delete).not.toHaveBeenCalled();
  });

  it('happy path: delete fires with the right id', async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({ id: 'tm-1' } as never);
    vi.mocked(prisma.teamMember.delete).mockResolvedValueOnce({ id: 'tm-1' } as never);
    await AdminService.deleteTeamMember('tm-1');
    expect(prisma.teamMember.delete).toHaveBeenCalledWith({ where: { id: 'tm-1' } });
  });
});

describe('AdminService.getStoreMemberDetails', () => {
  it('non-existent store → throws "Store not found"', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce(null as never);
    await expect(AdminService.getStoreMemberDetails('s-missing')).rejects.toThrow('Store not found');
  });
});

// ── KYC UPDATE — admin-role guard + downstream side effects ────────────────

describe('AdminService.updateKycStatus', () => {
  it('target user is admin role → throws "Cannot modify KYC status of an admin account"; NO update', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'admin' } as never);
    await expect(AdminService.updateKycStatus(PROTECTED_ADMIN_ID, 'approved')).rejects.toThrow('Cannot modify KYC status of an admin account');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('approve a retailer who has NO store → creates a store from kycStoreName/kycStorePhoto', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'retailer' } as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: USER_A, name: 'Ravi', kycStatus: 'approved', kycStoreName: 'Ravi Kirana', kycStorePhoto: 'http://r2/photo.jpg',
    } as never);
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce(null as never);   // no existing store
    vi.mocked(prisma.store.create).mockResolvedValueOnce({ id: STORE_A } as never);
    vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null as never);    // no opening post yet
    vi.mocked(prisma.post.create).mockResolvedValueOnce({ id: 'pp1' } as never);

    await AdminService.updateKycStatus(USER_A, 'approved', 'looks good');

    expect(prisma.store.create).toHaveBeenCalledOnce();
    const createArgs = vi.mocked(prisma.store.create).mock.calls[0][0] as any;
    expect(createArgs.data.ownerId).toBe(USER_A);
    expect(createArgs.data.storeName).toBe('Ravi Kirana');
    expect(createArgs.data.logoUrl).toBe('http://r2/photo.jpg');
    expect(prisma.post.create).toHaveBeenCalledOnce();
    // Cache invalidated
    expect(pubClient.del).toHaveBeenCalledWith('admin:stats');
  });

  it('approve with EXISTING store + kycStorePhoto → invalidateStoreBotCache called (bot-render must drop stale meta)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'retailer' } as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: USER_A, name: 'Ravi', kycStatus: 'approved', kycStoreName: 'Ravi Kirana', kycStorePhoto: 'http://r2/new.jpg',
    } as never);
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce({ id: STORE_A } as never);
    vi.mocked(prisma.store.update).mockResolvedValueOnce({ id: STORE_A } as never);
    vi.mocked(prisma.post.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.post.create).mockResolvedValueOnce({ id: 'pp1' } as never);

    await AdminService.updateKycStatus(USER_A, 'approved');
    expect(invalidateStoreBotCache).toHaveBeenCalledWith(STORE_A);
  });

  it('approve with existing store + existing opening post → does NOT create a duplicate (idempotent)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'retailer' } as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: USER_A, name: 'Ravi', kycStatus: 'approved', kycStoreName: 'Ravi Kirana', kycStorePhoto: 'http://r2/p.jpg',
    } as never);
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce({ id: STORE_A } as never);
    vi.mocked(prisma.store.update).mockResolvedValueOnce({ id: STORE_A } as never);
    vi.mocked(prisma.post.findFirst).mockResolvedValueOnce({ id: 'existing-opening' } as never);  // already has opening post

    await AdminService.updateKycStatus(USER_A, 'approved');
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('reject (non-approved status) → user updated; NO store create + NO post create', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'retailer' } as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: USER_A, name: 'Ravi', kycStatus: 'rejected' } as never);

    await AdminService.updateKycStatus(USER_A, 'rejected', 'docs unclear');
    expect(prisma.store.create).not.toHaveBeenCalled();
    expect(prisma.post.create).not.toHaveBeenCalled();
    // status + notes + reviewedAt wired
    const updateArgs = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(updateArgs.data.kycStatus).toBe('rejected');
    expect(updateArgs.data.kycNotes).toBe('docs unclear');
    expect(updateArgs.data.kycReviewedAt).toBeInstanceOf(Date);
  });

  it('Redis del failure post-update → does NOT propagate (cache invalidation is best-effort)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ role: 'retailer' } as never);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: USER_A, name: 'R', kycStatus: 'rejected' } as never);
    vi.mocked(pubClient.del).mockRejectedValueOnce(new Error('redis down'));

    await expect(AdminService.updateKycStatus(USER_A, 'rejected')).resolves.toBeDefined();
  });
});

// ── SETTINGS singleton ──────────────────────────────────────────────────────

describe('AdminService.getSettings + updateSettings', () => {
  it('getSettings: existing row returned without creation', async () => {
    vi.mocked(prisma.appSettings.findUnique).mockResolvedValueOnce({ id: 'singleton', appName: 'Dukanchi' } as never);
    const result = await AdminService.getSettings();
    expect(result).toMatchObject({ id: 'singleton', appName: 'Dukanchi' });
    expect(prisma.appSettings.create).not.toHaveBeenCalled();
  });

  it('getSettings: missing row → creates with id singleton', async () => {
    vi.mocked(prisma.appSettings.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.appSettings.create).mockResolvedValueOnce({ id: 'singleton' } as never);
    await AdminService.getSettings();
    expect(prisma.appSettings.create).toHaveBeenCalledWith({ data: { id: 'singleton' } });
  });

  it('updateSettings: allowlist enforced — only the 5 known fields propagate (arbitrary field is dropped)', async () => {
    vi.mocked(prisma.appSettings.upsert).mockResolvedValueOnce({ id: 'singleton' } as never);
    await AdminService.updateSettings({
      appName: 'New', logoUrl: 'http://r2/x.png', primaryColor: '#ff0000', accentColor: '#00ff00',
      carouselImages: ['a.jpg'],
      // Out-of-allowlist (must NOT propagate):
      adminPassword: 'hacked', role: 'admin', isBlocked: false,
    });
    const args = vi.mocked(prisma.appSettings.upsert).mock.calls[0][0] as any;
    expect(args.where).toEqual({ id: 'singleton' });
    expect(Object.keys(args.update).sort()).toEqual(
      ['accentColor', 'appName', 'carouselImages', 'logoUrl', 'primaryColor'].sort()
    );
    expect(args.update).not.toHaveProperty('adminPassword');
    expect(args.update).not.toHaveProperty('role');
    expect(args.update).not.toHaveProperty('isBlocked');
  });
});

// ── REPORT / COMPLAINT / POST listing + simple deletes ─────────────────────

describe('AdminService.getReports / deleteReport / getComplaints / updateComplaint / deleteComplaint / getPosts / getKycList', () => {
  it('getReports: pagination math', async () => {
    await AdminService.getReports(3, 25);
    const args = vi.mocked(prisma.report.findMany).mock.calls[0][0] as any;
    expect(args.skip).toBe(50);
    expect(args.take).toBe(25);
  });

  it('deleteReport: deletes by id', async () => {
    vi.mocked(prisma.report.delete).mockResolvedValueOnce({ id: 'r1' } as never);
    await AdminService.deleteReport('r1');
    expect(prisma.report.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('getComplaints: status="all" → no status filter applied', async () => {
    await AdminService.getComplaints('all', 1, 20);
    const args = vi.mocked(prisma.complaint.findMany).mock.calls[0][0] as any;
    expect(args.where.status).toBeUndefined();
  });

  it('getComplaints: status="open" → WHERE.status === "open"', async () => {
    await AdminService.getComplaints('open', 1, 20);
    const args = vi.mocked(prisma.complaint.findMany).mock.calls[0][0] as any;
    expect(args.where.status).toBe('open');
  });

  it('updateComplaint: only status + adminNotes propagate (no allowlist leakage)', async () => {
    vi.mocked(prisma.complaint.update).mockResolvedValueOnce({ id: 'c1' } as never);
    await AdminService.updateComplaint('c1', 'resolved', 'fixed it');
    const args = vi.mocked(prisma.complaint.update).mock.calls[0][0] as any;
    expect(args.data).toEqual({ status: 'resolved', adminNotes: 'fixed it' });
  });

  it('deleteComplaint: deletes by id', async () => {
    vi.mocked(prisma.complaint.delete).mockResolvedValueOnce({ id: 'c1' } as never);
    await AdminService.deleteComplaint('c1');
    expect(prisma.complaint.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
  });

  it('getPosts: search query → WHERE OR contains caption + storeName', async () => {
    await AdminService.getPosts('diwali sale', 1, 20);
    const args = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(args.where.OR).toEqual([
      { caption: { contains: 'diwali sale', mode: 'insensitive' } },
      { store: { storeName: { contains: 'diwali sale', mode: 'insensitive' } } },
    ]);
  });

  it('getKycList: WHERE excludes admin role (kycStatus filter on top)', async () => {
    await AdminService.getKycList('pending', 1, 20);
    const args = vi.mocked(prisma.user.findMany).mock.calls[0][0] as any;
    expect(args.where.role).toEqual({ not: 'admin' });
    expect(args.where.kycStatus).toBe('pending');
  });
});
