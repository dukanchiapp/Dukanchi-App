import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.51 / Phase 6.2 — StoreService spec coverage.
 *
 * 8 public methods (214 LOC) on StoreService. Baseline 26.56% lines.
 *
 * Marquee tests (4):
 *   - updateStore ALLOWLIST defense: ownerId / role / isBlocked etc.
 *     dropped silently from a crafted body before prisma.update
 *   - getStores role-visibility: customer viewer sees only retailers;
 *     B2B viewer sees all 4 B2B roles
 *   - getStoreById soft-delete cascade: owner.deletedAt set → findFirst
 *     returns null (no leakage of deleted-owner stores)
 *   - toggleFollow self-notification GUARD: store.owner.id === userId
 *     → no notification.create, no socket emit (don't notify yourself)
 *
 * Philosophy: encode INTENDED SPEC. If a spec test fails → real bug
 * exists → STOP and report.
 */

vi.mock('../config/prisma', () => ({
  prisma: {
    store: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    follow: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    post: { findMany: vi.fn(), count: vi.fn() },
    product: { create: vi.fn(), findMany: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: { get: vi.fn(), set: vi.fn(), del: vi.fn(), on: vi.fn() },
}));

vi.mock('../services/geminiEmbeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../middlewares/bot-render.middleware', () => ({
  invalidateStoreBotCache: vi.fn(),
}));

// socket is dynamically imported inside toggleFollow — mock it eagerly.
vi.mock('../config/socket', () => ({
  getIO: vi.fn(),
}));

import { prisma } from '../config/prisma';
import { pubClient } from '../config/redis';
import { generateEmbedding } from '../services/geminiEmbeddings';
import { invalidateStoreBotCache } from '../middlewares/bot-render.middleware';
import { getIO } from '../config/socket';
import { StoreService } from '../modules/stores/store.service';

const OWNER_A = 'owner-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OWNER_B = 'owner-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_C = 'user-cccc-cccc-cccc-cccccccccccc';
const STORE_A = 'store-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function setupIO() {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  vi.mocked(getIO).mockReturnValue({ to } as never);
  return { to, emit };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pubClient.del).mockResolvedValue(1 as never);
  vi.mocked(generateEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
});

// ── 1. createStore ─────────────────────────────────────────────────────────
describe('StoreService.createStore', () => {
  it('happy path: creates store with the supplied ownerId + sensible defaults', async () => {
    vi.mocked(prisma.store.create).mockResolvedValueOnce({ id: STORE_A } as never);
    await StoreService.createStore({ ownerId: OWNER_A, storeName: 'Ravi Store', category: 'Grocery', latitude: '28.6', longitude: '77.2' });
    const args = vi.mocked(prisma.store.create).mock.calls[0][0] as any;
    expect(args.data.ownerId).toBe(OWNER_A);
    expect(args.data.storeName).toBe('Ravi Store');
    expect(args.data.latitude).toBe(28.6);
    expect(args.data.longitude).toBe(77.2);
    // Sensible defaults
    expect(args.data.phoneVisible).toBe(true);
    expect(args.data.is24Hours).toBe(false);
  });

  it('missing storeName → defaults to "My Store"; missing category → "General"', async () => {
    vi.mocked(prisma.store.create).mockResolvedValueOnce({ id: STORE_A } as never);
    await StoreService.createStore({ ownerId: OWNER_A });
    const args = vi.mocked(prisma.store.create).mock.calls[0][0] as any;
    expect(args.data.storeName).toBe('My Store');
    expect(args.data.category).toBe('General');
  });

  it('postalCode passed as string → parsed to int', async () => {
    vi.mocked(prisma.store.create).mockResolvedValueOnce({ id: STORE_A } as never);
    await StoreService.createStore({ ownerId: OWNER_A, postalCode: '110085' });
    const args = vi.mocked(prisma.store.create).mock.calls[0][0] as any;
    expect(args.data.postalCode).toBe(110085);
  });

  it('Redis del failure → does NOT propagate (best-effort cache invalidation)', async () => {
    vi.mocked(prisma.store.create).mockResolvedValueOnce({ id: STORE_A } as never);
    vi.mocked(pubClient.del).mockRejectedValueOnce(new Error('redis down'));
    await expect(StoreService.createStore({ ownerId: OWNER_A })).resolves.toBeDefined();
  });
});

// ── 2. updateStore — MARQUEE: ALLOWLIST DEFENSE ────────────────────────────
describe('StoreService.updateStore — ALLOWLIST defense', () => {
  it('MARQUEE: crafted body with ownerId / role / isBlocked / arbitrary fields → DROPPED before prisma.update', async () => {
    vi.mocked(prisma.store.update).mockResolvedValueOnce({ id: STORE_A } as never);
    await StoreService.updateStore(STORE_A, {
      storeName: 'New Name',                       // ALLOWED
      category: 'Pharmacy',                        // ALLOWED
      ownerId: 'attacker-owns-it-now',             // SHOULD BE DROPPED
      role: 'admin',                               // SHOULD BE DROPPED
      isBlocked: false,                            // SHOULD BE DROPPED
      adminPassword: 'lol',                        // SHOULD BE DROPPED
      kycStatus: 'approved',                       // SHOULD BE DROPPED
    });

    const args = vi.mocked(prisma.store.update).mock.calls[0][0] as any;
    expect(args.where).toEqual({ id: STORE_A });
    // Allowed propagated
    expect(args.data.storeName).toBe('New Name');
    expect(args.data.category).toBe('Pharmacy');
    // NON-allowlist fields SILENTLY DROPPED — the IDOR / escalation prevention
    expect(args.data).not.toHaveProperty('ownerId');
    expect(args.data).not.toHaveProperty('role');
    expect(args.data).not.toHaveProperty('isBlocked');
    expect(args.data).not.toHaveProperty('adminPassword');
    expect(args.data).not.toHaveProperty('kycStatus');
  });

  it('all 21 allowlist fields propagate verbatim', async () => {
    vi.mocked(prisma.store.update).mockResolvedValueOnce({ id: STORE_A } as never);
    const allFields: Record<string, any> = {
      storeName: 'X', category: 'Y', description: 'D', address: 'A', phone: '999',
      openingHours: 'h', openingTime: '09:00', closingTime: '21:00', workingDays: 'Mon-Sat', is24Hours: false,
      logoUrl: 'u', coverUrl: 'c', city: 'Delhi', state: 'DL', postalCode: 110001,
      phoneVisible: true, hideRatings: false, chatEnabled: true,
      manualProductText: 'm', gstNumber: 'g', gstOrBillUrl: 'gu', selfieUrl: 's',
      latitude: 28.6, longitude: 77.2,
    };
    await StoreService.updateStore(STORE_A, allFields);
    const args = vi.mocked(prisma.store.update).mock.calls[0][0] as any;
    // All 21 allowed fields should pass through
    for (const k of Object.keys(allFields)) {
      expect(args.data).toHaveProperty(k);
    }
  });

  it('postalCode passed as non-numeric string → coerced to null (not NaN)', async () => {
    vi.mocked(prisma.store.update).mockResolvedValueOnce({ id: STORE_A } as never);
    await StoreService.updateStore(STORE_A, { postalCode: 'not-a-number' });
    const args = vi.mocked(prisma.store.update).mock.calls[0][0] as any;
    expect(args.data.postalCode).toBeNull();
  });

  it('invalidateStoreBotCache fires after update (bot-render must drop stale HTML)', async () => {
    vi.mocked(prisma.store.update).mockResolvedValueOnce({ id: STORE_A } as never);
    await StoreService.updateStore(STORE_A, { storeName: 'X' });
    expect(invalidateStoreBotCache).toHaveBeenCalledWith(STORE_A);
  });

  it('Redis del failure → does NOT propagate', async () => {
    vi.mocked(prisma.store.update).mockResolvedValueOnce({ id: STORE_A } as never);
    vi.mocked(pubClient.del).mockRejectedValueOnce(new Error('redis down'));
    await expect(StoreService.updateStore(STORE_A, { storeName: 'X' })).resolves.toBeDefined();
  });
});

// ── 3. getStores — MARQUEE: role-visibility ────────────────────────────────
describe('StoreService.getStores — role-visibility', () => {
  it('MARQUEE: viewerRole="customer" → visibleRoles=["retailer"] (B2C — customers see retailers only)', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.count).mockResolvedValueOnce(0 as never);
    await StoreService.getStores(1, 20, 'customer');
    const args = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(args.where.owner.role.in).toEqual(['retailer']);
    expect(args.where.owner.deletedAt).toBeNull();
    expect(args.where.owner.isBlocked).toBe(false);
  });

  it('MARQUEE: viewerRole="retailer" (B2B) → visibleRoles=["retailer","supplier","brand","manufacturer"]', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.count).mockResolvedValueOnce(0 as never);
    await StoreService.getStores(1, 20, 'retailer');
    const args = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(args.where.owner.role.in).toEqual(['retailer', 'supplier', 'brand', 'manufacturer']);
  });

  it('viewerRole="supplier" (B2B) → same B2B visibility', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.count).mockResolvedValueOnce(0 as never);
    await StoreService.getStores(1, 20, 'supplier');
    const args = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(args.where.owner.role.in).toEqual(['retailer', 'supplier', 'brand', 'manufacturer']);
  });

  it('category filter wired through', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.count).mockResolvedValueOnce(0 as never);
    await StoreService.getStores(1, 20, 'customer', 'Grocery');
    const args = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(args.where.category).toBe('Grocery');
  });

  it('excludeOwnerId wired — typically used to hide caller\'s own stores from suggestions', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.count).mockResolvedValueOnce(0 as never);
    await StoreService.getStores(1, 20, 'customer', undefined, OWNER_A);
    const args = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(args.where.ownerId).toEqual({ not: OWNER_A });
  });

  it('pagination math: page=3 limit=15 → skip=30 take=15', async () => {
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.count).mockResolvedValueOnce(0 as never);
    await StoreService.getStores(3, 15, 'customer');
    const args = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(args.skip).toBe(30);
    expect(args.take).toBe(15);
  });
});

// ── 4. getStoreById — MARQUEE: soft-delete cascade ─────────────────────────
describe('StoreService.getStoreById — soft-delete cascade', () => {
  it('MARQUEE: WHERE clause requires owner.deletedAt: null — deleted-owner stores hidden', async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce(null as never);
    await StoreService.getStoreById(STORE_A);
    const args = vi.mocked(prisma.store.findFirst).mock.calls[0][0] as any;
    expect(args.where.id).toBe(STORE_A);
    expect(args.where.owner.deletedAt).toBeNull();
  });

  it('currentUserId absent → followers include is FALSE (skip follow query)', async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce({ id: STORE_A } as never);
    await StoreService.getStoreById(STORE_A);
    const args = vi.mocked(prisma.store.findFirst).mock.calls[0][0] as any;
    expect(args.include.followers).toBe(false);
  });

  it('currentUserId present → followers include scoped WHERE userId=currentUserId', async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce({ id: STORE_A } as never);
    await StoreService.getStoreById(STORE_A, USER_C);
    const args = vi.mocked(prisma.store.findFirst).mock.calls[0][0] as any;
    expect(args.include.followers).toEqual({ where: { userId: USER_C } });
  });

  it('store returns null when soft-deleted — controller maps to 404', async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce(null as never);
    const result = await StoreService.getStoreById(STORE_A);
    expect(result).toBeNull();
  });
});

// ── 5. toggleFollow — MARQUEE: self-notification GUARD ─────────────────────
describe('StoreService.toggleFollow — self-notification GUARD', () => {
  it('NEW follow + caller IS NOT the owner → notification.create + socket emit fire', async () => {
    const { to, emit } = setupIO();
    vi.mocked(prisma.follow.findUnique).mockResolvedValueOnce(null as never);  // no existing
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({
      id: STORE_A, storeName: 'Ravi Store', owner: { id: OWNER_A, name: 'Ravi' },
    } as never);
    vi.mocked(prisma.follow.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: 'Customer X' } as never);
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({} as never);

    const result = await StoreService.toggleFollow(USER_C, STORE_A);
    expect(result).toEqual({ following: true });
    expect(prisma.notification.create).toHaveBeenCalledOnce();
    expect(to).toHaveBeenCalledWith(OWNER_A);
    expect(emit).toHaveBeenCalledWith('newNotification', expect.objectContaining({ type: 'NEW_FOLLOWER' }));
  });

  it('MARQUEE: NEW follow + caller IS the owner (self-follow) → notification + socket emit SKIPPED', async () => {
    const { emit } = setupIO();
    vi.mocked(prisma.follow.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({
      id: STORE_A, storeName: 'My Store', owner: { id: OWNER_A, name: 'Me' },
    } as never);
    vi.mocked(prisma.follow.create).mockResolvedValueOnce({} as never);

    const result = await StoreService.toggleFollow(OWNER_A, STORE_A);   // caller === owner
    expect(result).toEqual({ following: true });
    // The follow itself created, but no self-notification side effects:
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('existing follow → delete (unfollow); returns following:false; NO new notifications', async () => {
    setupIO();
    vi.mocked(prisma.follow.findUnique).mockResolvedValueOnce({ userId: USER_C, storeId: STORE_A } as never);
    vi.mocked(prisma.follow.delete).mockResolvedValueOnce({} as never);

    const result = await StoreService.toggleFollow(USER_C, STORE_A);
    expect(result).toEqual({ following: false });
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  it('NEW follow but store not found → throws "Store not found"; NO follow.create', async () => {
    vi.mocked(prisma.follow.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce(null as never);

    await expect(StoreService.toggleFollow(USER_C, STORE_A)).rejects.toThrow('Store not found');
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  it('notification.create failure on follow → BEST-EFFORT (does not abort the follow)', async () => {
    setupIO();
    vi.mocked(prisma.follow.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({
      id: STORE_A, storeName: 'X', owner: { id: OWNER_A, name: 'R' },
    } as never);
    vi.mocked(prisma.follow.create).mockResolvedValueOnce({} as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: 'C' } as never);
    vi.mocked(prisma.notification.create).mockRejectedValueOnce(new Error('db hiccup'));

    const result = await StoreService.toggleFollow(USER_C, STORE_A);
    expect(result).toEqual({ following: true });   // follow succeeded
  });
});

// ── 6. getStorePosts — role-visibility + soft-delete ───────────────────────
describe('StoreService.getStorePosts', () => {
  it('viewerRole="customer" → only retailer posts surface', async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(0 as never);
    await StoreService.getStorePosts(STORE_A, 1, 20, 'customer');
    const args = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(args.where.store.owner.role.in).toEqual(['retailer']);
  });

  it('soft-delete: posts of a deleted-owner store are filtered out', async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(0 as never);
    await StoreService.getStorePosts(STORE_A, 1, 20, 'customer');
    const args = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(args.where.store.owner.deletedAt).toBeNull();
  });

  it('ordering: openingPost desc → pinned desc → createdAt desc', async () => {
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(0 as never);
    await StoreService.getStorePosts(STORE_A, 1, 20, 'customer');
    const args = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(args.orderBy).toEqual([
      { isOpeningPost: 'desc' }, { isPinned: 'desc' }, { createdAt: 'desc' },
    ]);
  });
});

// ── 7. createProduct + embedding side-effect ───────────────────────────────
describe('StoreService.createProduct', () => {
  it('product.create called with provided data; embedding generation is fire-and-forget', async () => {
    vi.mocked(prisma.product.create).mockResolvedValueOnce({
      id: 'p1', productName: 'Atta', category: 'Grocery', description: 'wheat flour',
    } as never);

    const result = await StoreService.createProduct({
      productName: 'Atta', category: 'Grocery', description: 'wheat flour', storeId: STORE_A,
    });
    expect(result).toMatchObject({ id: 'p1' });
    // embedding triggered (best-effort)
    expect(generateEmbedding).toHaveBeenCalled();
  });

  it('embedding failure → caught + logged, NOT propagated to caller', async () => {
    vi.mocked(prisma.product.create).mockResolvedValueOnce({
      id: 'p2', productName: 'X', category: 'Y', description: '',
    } as never);
    vi.mocked(generateEmbedding).mockRejectedValueOnce(new Error('gemini down'));

    // The .catch in source swallows; the create still resolves.
    await expect(StoreService.createProduct({ productName: 'X', category: 'Y' })).resolves.toBeDefined();
  });
});

// ── 8. getProducts — soft-delete + search ──────────────────────────────────
describe('StoreService.getProducts', () => {
  it('soft-delete: products of deleted-owner stores are hidden', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    await StoreService.getProducts();
    const args = vi.mocked(prisma.product.findMany).mock.calls[0][0] as any;
    expect(args.where.store.owner.deletedAt).toBeNull();
    expect(args.where.store.owner.isBlocked).toBe(false);
  });

  it('search query → WHERE OR contains productName + description + brand', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    await StoreService.getProducts('atta');
    const args = vi.mocked(prisma.product.findMany).mock.calls[0][0] as any;
    expect(args.where.OR).toEqual([
      { productName: { contains: 'atta', mode: 'insensitive' } },
      { description: { contains: 'atta', mode: 'insensitive' } },
      { brand: { contains: 'atta', mode: 'insensitive' } },
    ]);
  });

  it('category + storeId filters wired', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    await StoreService.getProducts(undefined, 'Grocery', STORE_A);
    const args = vi.mocked(prisma.product.findMany).mock.calls[0][0] as any;
    expect(args.where.category).toBe('Grocery');
    expect(args.where.storeId).toBe(STORE_A);
  });

  it('take cap = 50 (legacy)', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    await StoreService.getProducts();
    const args = vi.mocked(prisma.product.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(50);
  });
});
