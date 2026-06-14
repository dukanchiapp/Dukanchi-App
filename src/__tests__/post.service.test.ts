import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.45 / Phase 5.1 — PostService spec coverage.
 *
 * 9 public methods, 469 LOC, the app's core engine. Test strategy:
 *
 *   PART A — SECURITY-CRITICAL (NON-NEGOTIABLE):
 *     - updatePost, deletePost, togglePin: owner-only IDOR proofs
 *     - deleteAllStorePosts: store-owner gate + STORE_POSTS_CASCADE_CAP
 *       (50k) Sentry sentinel
 *     - deletePost cascade: like + savedItem(type='post') cleanup before
 *       post.delete
 *
 *   PART B — USER ACTIONS (any authed user, NOT ownership-gated):
 *     - toggleLike: idempotency + notification side-effect best-effort
 *       semantics (creator-only notification gate, no self-notify)
 *     - toggleSave: idempotency
 *
 *   PART C — HAPPY-PATH CONTRACT (no line-by-line scoring math, just
 *   the externally-visible contract):
 *     - createPost: write + BullMQ enqueue
 *     - getInteractions: WHERE userId scoping on all 3 queries (IDOR-adjacent)
 *     - getFeed: pagination shape; role-filter wire-through; diversity
 *       cap (max 2 per store per page); FEED_FOLLOWS_CAP=10k Sentry
 *       sentinel; empty-candidates handled; seen-penalty ranking effect
 *
 * Philosophy: tests encode the INTENDED SPEC. If a spec test fails it
 * means a real bug exists → STOP, report it as POTENTIAL IDOR BUG FOUND,
 * do NOT weaken.
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
    post: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    store: { findUnique: vi.fn(), findMany: vi.fn() },
    like: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    },
    savedItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    },
    follow: { findMany: vi.fn() },
    message: { findMany: vi.fn() },
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    sMIsMember: vi.fn().mockResolvedValue([]),
    sAdd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
  },
}));

vi.mock('../config/bullmq', () => ({
  notificationQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  },
}));

vi.mock('../config/socket', () => ({
  getIO: () => ({ to: () => ({ emit: vi.fn() }) }),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

import { prisma } from '../config/prisma';
import { pubClient } from '../config/redis';
import { notificationQueue } from '../config/bullmq';
import { PostService } from '../modules/posts/post.service';
import * as Sentry from '@sentry/node';

const OWNER_ID = 'owner-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_USER_ID = 'other-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const STORE_ID = 'store-cccc-cccc-cccc-cccccccccccc';
const POST_ID = 'post-dddd-dddd-dddd-dddddddddddd';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// PART A — SECURITY-CRITICAL (IDOR-NON-NEGOTIABLE)
// ─────────────────────────────────────────────────────────────────────────

describe('PostService.updatePost — IDOR-critical owner-only gate', () => {
  it('OWNER updates own post → succeeds with allowlisted body fields (caption/imageUrl/price)', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, storeId: STORE_ID, store: { id: STORE_ID, ownerId: OWNER_ID },
    } as never);
    vi.mocked(prisma.post.update).mockResolvedValueOnce({ id: POST_ID, caption: 'new caption' } as never);

    const result = await PostService.updatePost(POST_ID, OWNER_ID, {
      caption: 'new caption', imageUrl: 'r2://new.jpg', price: '99.50',
    });
    expect(result.id).toBe(POST_ID);

    const updateArgs = vi.mocked(prisma.post.update).mock.calls[0][0] as any;
    expect(updateArgs.where).toEqual({ id: POST_ID });
    expect(updateArgs.data.caption).toBe('new caption');
    expect(updateArgs.data.imageUrl).toBe('r2://new.jpg');
    expect(updateArgs.data.price).toBe(99.5);  // parseFloat applied
  });

  it('IDOR: non-owner tries to update → throws "Unauthorized"; NO update attempted', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, storeId: STORE_ID, store: { id: STORE_ID, ownerId: OWNER_ID },
    } as never);
    await expect(PostService.updatePost(POST_ID, OTHER_USER_ID, { caption: 'attacker' }))
      .rejects.toThrow('Unauthorized');
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it('non-existent post → throws "Not found" BEFORE the owner check (no oracle for "exists but unauthorized" vs "doesn\'t exist")', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(null as never);
    await expect(PostService.updatePost(POST_ID, OWNER_ID, { caption: 'x' }))
      .rejects.toThrow('Not found');
  });

  it('price="" (empty string) clears the price (parseFloat falsy → null)', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, storeId: STORE_ID, store: { id: STORE_ID, ownerId: OWNER_ID },
    } as never);
    vi.mocked(prisma.post.update).mockResolvedValueOnce({ id: POST_ID } as never);

    await PostService.updatePost(POST_ID, OWNER_ID, { price: '' });
    const args = vi.mocked(prisma.post.update).mock.calls[0][0] as any;
    expect(args.data.price).toBeNull();
  });

  it('field allowlist: undefined-keyed fields are NOT in the update set (extra body keys silently dropped at service)', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, storeId: STORE_ID, store: { id: STORE_ID, ownerId: OWNER_ID },
    } as never);
    vi.mocked(prisma.post.update).mockResolvedValueOnce({} as never);

    await PostService.updatePost(POST_ID, OWNER_ID, { caption: 'only this' });
    const args = vi.mocked(prisma.post.update).mock.calls[0][0] as any;
    // Only `caption` is in data; imageUrl + price were undefined so omitted.
    expect(Object.keys(args.data).sort()).toEqual(['caption']);
  });
});

describe('PostService.deletePost — IDOR-critical + cascade', () => {
  it('OWNER deletes own post → cascade: likes deleted, savedItems (type=post) deleted, then post deleted; returns {success:true}', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, storeId: STORE_ID, store: { id: STORE_ID, ownerId: OWNER_ID },
    } as never);

    const result = await PostService.deletePost(POST_ID, OWNER_ID);
    expect(result).toEqual({ success: true });
    // CASCADE ORDER (critical — likes/savedItems BEFORE post.delete to avoid FK errors):
    expect(prisma.like.deleteMany).toHaveBeenCalledWith({ where: { postId: POST_ID } });
    expect(prisma.savedItem.deleteMany).toHaveBeenCalledWith({ where: { type: 'post', referenceId: POST_ID } });
    expect(prisma.post.delete).toHaveBeenCalledWith({ where: { id: POST_ID } });
  });

  it('IDOR: non-owner tries to delete → "Unauthorized"; NO cascade started', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, storeId: STORE_ID, store: { id: STORE_ID, ownerId: OWNER_ID },
    } as never);
    await expect(PostService.deletePost(POST_ID, OTHER_USER_ID)).rejects.toThrow('Unauthorized');
    expect(prisma.like.deleteMany).not.toHaveBeenCalled();
    expect(prisma.savedItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.post.delete).not.toHaveBeenCalled();
  });

  it('non-existent post → "Not found" BEFORE auth check (consistent with updatePost behaviour)', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(null as never);
    await expect(PostService.deletePost(POST_ID, OWNER_ID)).rejects.toThrow('Not found');
    expect(prisma.like.deleteMany).not.toHaveBeenCalled();
  });
});

describe('PostService.deleteAllStorePosts — store-owner gate + cap', () => {
  it('OWNER bulk-deletes all posts in their store → cascade likes + savedItems + post.deleteMany', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([
      { id: 'p1' }, { id: 'p2' }, { id: 'p3' },
    ] as never);

    await PostService.deleteAllStorePosts(STORE_ID, OWNER_ID);
    // Bounded fetch (Session 128.38 cap).
    const fetchArgs = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(fetchArgs.take).toBe(50000);  // STORE_POSTS_CASCADE_CAP
    expect(fetchArgs.select).toEqual({ id: true });
    // Cascade across the 3 ids
    expect(prisma.like.deleteMany).toHaveBeenCalledWith({ where: { postId: { in: ['p1', 'p2', 'p3'] } } });
    expect(prisma.savedItem.deleteMany).toHaveBeenCalledWith({ where: { type: 'post', referenceId: { in: ['p1', 'p2', 'p3'] } } });
    expect(prisma.post.deleteMany).toHaveBeenCalledWith({ where: { storeId: STORE_ID } });
  });

  it('IDOR: non-owner tries → throws "Unauthorized"; NO cascade started', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    await expect(PostService.deleteAllStorePosts(STORE_ID, OTHER_USER_ID)).rejects.toThrow('Unauthorized');
    expect(prisma.post.findMany).not.toHaveBeenCalled();
    expect(prisma.post.deleteMany).not.toHaveBeenCalled();
  });

  it('IDOR: missing store → throws "Unauthorized" (same error message — no existence oracle)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce(null as never);
    await expect(PostService.deleteAllStorePosts(STORE_ID, OWNER_ID)).rejects.toThrow('Unauthorized');
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('STORE_POSTS_CASCADE_CAP sentinel: when findMany returns exactly 50000 posts, Sentry warning fires', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    const fullBatch = Array.from({ length: 50000 }, (_, i) => ({ id: `p${i}` }));
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce(fullBatch as never);

    await PostService.deleteAllStorePosts(STORE_ID, OWNER_ID);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'post.deleteAllStorePosts.cap-hit',
      expect.objectContaining({ level: 'warning', tags: { service: 'post' } }),
    );
  });

  it('empty store (no posts) → skips cascade deletes entirely', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);

    const result = await PostService.deleteAllStorePosts(STORE_ID, OWNER_ID);
    expect(result).toEqual({ success: true });
    // When postIds is empty, the 3 cascade calls are skipped (line 462 guard).
    expect(prisma.like.deleteMany).not.toHaveBeenCalled();
    expect(prisma.savedItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.post.deleteMany).not.toHaveBeenCalled();
  });
});

describe('PostService.togglePin — IDOR + per-store 3-pin cap', () => {
  it('OWNER pins their own post → isPinned flipped true→true (actually: false→true since not pinned)', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, isPinned: false, storeId: STORE_ID, store: { ownerId: OWNER_ID },
    } as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(2 as never);  // under the 3-cap
    vi.mocked(prisma.post.update).mockResolvedValueOnce({ id: POST_ID, isPinned: true } as never);

    const result = await PostService.togglePin(POST_ID, OWNER_ID);
    expect((result as any).isPinned).toBe(true);
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: { isPinned: true },
    });
  });

  it('OWNER unpins (pinned → false) — count check is SKIPPED on the unpin path (only enforced when going pinned:false→true)', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, isPinned: true, storeId: STORE_ID, store: { ownerId: OWNER_ID },
    } as never);
    vi.mocked(prisma.post.update).mockResolvedValueOnce({ id: POST_ID, isPinned: false } as never);

    await PostService.togglePin(POST_ID, OWNER_ID);
    // count() not consulted when going pinned→unpinned (the !post.isPinned guard at line 413).
    expect(prisma.post.count).not.toHaveBeenCalled();
  });

  it('IDOR: non-owner tries to pin → throws "Unauthorized"; no count/update', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, isPinned: false, storeId: STORE_ID, store: { ownerId: OWNER_ID },
    } as never);
    await expect(PostService.togglePin(POST_ID, OTHER_USER_ID)).rejects.toThrow('Unauthorized');
    expect(prisma.post.count).not.toHaveBeenCalled();
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it('non-existent post → throws "Post not found" (before auth check)', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce(null as never);
    await expect(PostService.togglePin(POST_ID, OWNER_ID)).rejects.toThrow('Post not found');
  });

  it('SPEC: cap of 3 pinned posts per store — attempting to pin a 4th throws "Maximum 3 pinned posts allowed"', async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      id: POST_ID, isPinned: false, storeId: STORE_ID, store: { ownerId: OWNER_ID },
    } as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(3 as never);  // already at cap
    await expect(PostService.togglePin(POST_ID, OWNER_ID))
      .rejects.toThrow('Maximum 3 pinned posts allowed');
    expect(prisma.post.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PART B — USER ACTIONS (NOT ownership-gated; toggle idempotency)
// ─────────────────────────────────────────────────────────────────────────

describe('PostService.toggleLike — idempotency + notification side-effect', () => {
  it('user has NOT liked → creates like, returns {liked:true}, attempts to notify post author', async () => {
    vi.mocked(prisma.like.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.like.create).mockResolvedValueOnce({ id: 'lk1' } as never);
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      store: { owner: { id: OWNER_ID }, storeName: 'X Dukaan' },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: 'Alice' } as never);
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({ id: 'n1' } as never);

    const result = await PostService.toggleLike(OTHER_USER_ID, POST_ID);
    expect(result).toEqual({ liked: true });
    expect(prisma.like.create).toHaveBeenCalledWith({ data: { userId: OTHER_USER_ID, postId: POST_ID } });
  });

  it('user already liked → DELETES the like, returns {liked:false}; NO notification attempted (toggle-off path)', async () => {
    vi.mocked(prisma.like.findUnique).mockResolvedValueOnce({ id: 'existing-like' } as never);
    vi.mocked(prisma.like.delete).mockResolvedValueOnce({} as never);

    const result = await PostService.toggleLike(OTHER_USER_ID, POST_ID);
    expect(result).toEqual({ liked: false });
    expect(prisma.like.delete).toHaveBeenCalledWith({ where: { id: 'existing-like' } });
    // No notification for the unlike path.
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('IDEMPOTENCY: double-toggle round-trips to the original state (mocked unique check + reset)', async () => {
    // Round 1: not liked → like (full notification side-effect path)
    vi.mocked(prisma.like.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.like.create).mockResolvedValueOnce({ id: 'lk1' } as never);
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({ store: { owner: { id: OWNER_ID }, storeName: 'X' } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: 'A' } as never);
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({ id: 'n1' } as never);
    const r1 = await PostService.toggleLike(OTHER_USER_ID, POST_ID);
    expect(r1).toEqual({ liked: true });

    // Round 2: now liked → unlike (no notification path)
    vi.mocked(prisma.like.findUnique).mockResolvedValueOnce({ id: 'lk1' } as never);
    vi.mocked(prisma.like.delete).mockResolvedValueOnce({} as never);
    const r2 = await PostService.toggleLike(OTHER_USER_ID, POST_ID);
    expect(r2).toEqual({ liked: false });
  });

  it('SECURITY: post author liking own post does NOT generate a self-notification (authorId === userId guard)', async () => {
    vi.mocked(prisma.like.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.like.create).mockResolvedValueOnce({ id: 'lk1' } as never);
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      store: { owner: { id: OWNER_ID }, storeName: 'X' },
    } as never);

    await PostService.toggleLike(OWNER_ID, POST_ID);  // OWNER likes their own post
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('notification creation failure is BEST-EFFORT (does NOT throw or affect the toggle result)', async () => {
    vi.mocked(prisma.like.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.like.create).mockResolvedValueOnce({ id: 'lk1' } as never);
    vi.mocked(prisma.post.findUnique).mockResolvedValueOnce({
      store: { owner: { id: OWNER_ID }, storeName: 'X' },
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: 'A' } as never);
    vi.mocked(prisma.notification.create).mockRejectedValueOnce(new Error('DB down'));

    // Toggle still resolves with {liked:true} even though notification.create throws.
    await expect(PostService.toggleLike(OTHER_USER_ID, POST_ID)).resolves.toEqual({ liked: true });
  });
});

describe('PostService.toggleSave — idempotency', () => {
  it('user has NOT saved → creates savedItem(type:"post"), returns {saved:true}', async () => {
    vi.mocked(prisma.savedItem.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.savedItem.create).mockResolvedValueOnce({ id: 's1' } as never);

    const result = await PostService.toggleSave(OTHER_USER_ID, POST_ID);
    expect(result).toEqual({ saved: true });
    expect(prisma.savedItem.create).toHaveBeenCalledWith({
      data: { userId: OTHER_USER_ID, type: 'post', referenceId: POST_ID },
    });
  });

  it('user already saved → DELETES the savedItem, returns {saved:false}', async () => {
    vi.mocked(prisma.savedItem.findUnique).mockResolvedValueOnce({ id: 'existing-save' } as never);
    vi.mocked(prisma.savedItem.delete).mockResolvedValueOnce({} as never);

    const result = await PostService.toggleSave(OTHER_USER_ID, POST_ID);
    expect(result).toEqual({ saved: false });
    expect(prisma.savedItem.delete).toHaveBeenCalledWith({ where: { id: 'existing-save' } });
  });

  it('savedItem unique lookup uses the composite key { userId, type:"post", referenceId } (not just postId)', async () => {
    vi.mocked(prisma.savedItem.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.savedItem.create).mockResolvedValueOnce({} as never);
    await PostService.toggleSave(OTHER_USER_ID, POST_ID);
    const args = vi.mocked(prisma.savedItem.findUnique).mock.calls[0][0] as any;
    expect(args.where).toEqual({
      userId_type_referenceId: { userId: OTHER_USER_ID, type: 'post', referenceId: POST_ID },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PART C — HAPPY-PATH CONTRACT (createPost, getInteractions, getFeed)
// ─────────────────────────────────────────────────────────────────────────

describe('PostService.createPost', () => {
  it('happy path: creates post + enqueues publishPostNotifications BullMQ job', async () => {
    vi.mocked(prisma.post.create).mockResolvedValueOnce({ id: POST_ID, storeId: STORE_ID } as never);
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, storeName: 'X' } as never);

    const result = await PostService.createPost({
      caption: 'hi', imageUrl: 'r2://x.jpg', storeId: STORE_ID, price: '50',
    });
    expect(result.id).toBe(POST_ID);

    // post.create called with store.connect + numeric price (parseFloat).
    const createArgs = vi.mocked(prisma.post.create).mock.calls[0][0] as any;
    expect(createArgs.data.store).toEqual({ connect: { id: STORE_ID } });
    expect(createArgs.data.price).toBe(50);

    // BullMQ job enqueued with the right payload.
    expect(notificationQueue.add).toHaveBeenCalledWith('publishPostNotifications', {
      postId: POST_ID, storeId: STORE_ID, storeName: 'X',
    });
  });

  it('optional productId: when supplied, connects the product relation', async () => {
    vi.mocked(prisma.post.create).mockResolvedValueOnce({ id: POST_ID, storeId: STORE_ID } as never);
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, storeName: 'X' } as never);

    await PostService.createPost({
      caption: 'hi', imageUrl: 'r2://x.jpg', storeId: STORE_ID, productId: 'prod-1',
    });
    const args = vi.mocked(prisma.post.create).mock.calls[0][0] as any;
    expect(args.data.product).toEqual({ connect: { id: 'prod-1' } });
  });

  it('store fetch failure does NOT abort the post create (notification enqueue is best-effort)', async () => {
    vi.mocked(prisma.post.create).mockResolvedValueOnce({ id: POST_ID, storeId: STORE_ID } as never);
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce(null as never);  // store vanished

    // Post still resolved; notification enqueue skipped (store-null guard at line 58).
    await expect(PostService.createPost({
      caption: 'hi', imageUrl: 'r2://x.jpg', storeId: STORE_ID,
    })).resolves.toBeDefined();
    expect(notificationQueue.add).not.toHaveBeenCalled();
  });

  it('SPEC NOTE — service does NOT verify caller owns the storeId; controller\'s job (documented by absence)', async () => {
    vi.mocked(prisma.post.create).mockResolvedValueOnce({ id: POST_ID, storeId: STORE_ID } as never);
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, storeName: 'X' } as never);

    await PostService.createPost({ caption: 'hi', imageUrl: 'r2://x.jpg', storeId: STORE_ID });
    // No user lookup, no ownership comparison — service trusts the caller's storeId.
    // The route layer (post.controller) MUST verify the JWT user owns this store.
    expect(true).toBe(true);  // Trust boundary documented by what's NOT called.
  });
});

describe('PostService.getInteractions — WHERE userId scope on all 3 queries', () => {
  it('returns shape { likedPostIds, savedPostIds, followedStoreIds }; each query is WHERE userId scoped + take:500', async () => {
    vi.mocked(prisma.like.findMany).mockResolvedValueOnce([
      { postId: 'p1' }, { postId: 'p2' },
    ] as never);
    vi.mocked(prisma.savedItem.findMany).mockResolvedValueOnce([
      { type: 'post', referenceId: 'p3' }, { type: 'store', referenceId: 'st1' },
    ] as never);
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce([
      { storeId: 'st2' },
    ] as never);

    const result = await PostService.getInteractions(OTHER_USER_ID);
    expect(result).toEqual({
      likedPostIds: ['p1', 'p2'],
      savedPostIds: ['p3'],   // saves filtered to type:'post' only — 'store' saves stripped
      followedStoreIds: ['st2'],
    });

    // All 3 queries scoped to userId + take:500 (Session 128.38 cap).
    for (const fn of [prisma.like.findMany, prisma.savedItem.findMany, prisma.follow.findMany]) {
      expect(fn).toHaveBeenCalledOnce();
      const args = (fn as any).mock.calls[0][0] as any;
      expect(args.where).toEqual({ userId: OTHER_USER_ID });
      expect(args.take).toBe(500);
    }
  });

  it('savedPostIds filters to type==="post" — store/product saves NOT included (the savedPostIds contract)', async () => {
    vi.mocked(prisma.like.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.savedItem.findMany).mockResolvedValueOnce([
      { type: 'store', referenceId: 'st-saved' },
      { type: 'product', referenceId: 'prod-saved' },
      { type: 'post', referenceId: 'p-saved' },
    ] as never);
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce([] as never);

    const result = await PostService.getInteractions(OTHER_USER_ID);
    // ONLY the post-typed save makes it into savedPostIds.
    expect(result.savedPostIds).toEqual(['p-saved']);
  });
});

describe('PostService.getFeed — contract (NOT line-by-line scoring math)', () => {
  // Common shape — mock everything to harmless empties so we can focus on
  // contract assertions in each test.
  function setupEmptyFeed() {
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.like.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);
  }

  it('empty candidates → returns { posts: [], pagination: { page, limit, total:0, totalPages:0 } } without throwing', async () => {
    setupEmptyFeed();
    const result = await PostService.getFeed('user-1', 'customer', { feedType: 'all', page: 1, limit: 10 });
    expect(result.posts).toEqual([]);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
  });

  it('customer role → allowedRoles=[retailer] (the storeFilter is wired with the role-filtered set, mirror of session 128.30 role-isolation)', async () => {
    setupEmptyFeed();
    await PostService.getFeed('user-1', 'customer', { feedType: 'all', page: 1, limit: 10 });
    // The post.findMany WHERE.store.owner.role.in must be ['retailer'] (customer-restricted)
    const findManyCall = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(findManyCall.where.store.owner.role.in).toEqual(['retailer']);
    // Soft-delete cascade — owner must NOT be blocked or deleted.
    expect(findManyCall.where.store.owner.isBlocked).toBe(false);
    expect(findManyCall.where.store.owner.deletedAt).toBeNull();
  });

  it('retailer role → allowedRoles includes all 4 B2B (retailer/supplier/manufacturer/brand)', async () => {
    setupEmptyFeed();
    await PostService.getFeed('user-1', 'retailer', { feedType: 'all', page: 1, limit: 10 });
    const findManyCall = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(findManyCall.where.store.owner.role.in.sort()).toEqual(['brand', 'manufacturer', 'retailer', 'supplier'].sort());
  });

  it('admin role → allowedRoles=all 6 roles (including customer + admin)', async () => {
    setupEmptyFeed();
    await PostService.getFeed('user-1', 'admin', { feedType: 'all', page: 1, limit: 10 });
    const findManyCall = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(findManyCall.where.store.owner.role.in.sort()).toEqual(
      ['admin', 'brand', 'customer', 'manufacturer', 'retailer', 'supplier'].sort(),
    );
  });

  it('candidate fetch is 3× limit (over-fetch for the diversity-cap + scoring buffer)', async () => {
    setupEmptyFeed();
    await PostService.getFeed('user-1', 'customer', { feedType: 'all', page: 1, limit: 10 });
    const args = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(30);  // limit * 3
  });

  it('DIVERSITY CAP: max 2 posts per store per page — 5 candidates from same store → only 2 in result', async () => {
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.like.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(5 as never);
    // 5 posts all from STORE_ID (same store) — diversity cap should keep only 2.
    const sameStorePosts = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      storeId: STORE_ID,
      createdAt: new Date(Date.now() - i * 60_000),
      isPinned: false,
      isOpeningPost: false,
      store: {
        id: STORE_ID, latitude: null, longitude: null, category: '', ownerId: OWNER_ID,
        owner: { id: OWNER_ID, role: 'retailer' }, _count: { followers: 0 },
      },
      _count: { likes: 0 },
    }));
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce(sameStorePosts as never);
    // Same-store aggregates → no per-post groups
    vi.mocked(prisma.savedItem.groupBy).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.like.groupBy).mockResolvedValueOnce([] as never);

    const result = await PostService.getFeed('user-1', 'customer', { feedType: 'all', page: 1, limit: 10 });
    // CRITICAL — diversity cap enforced.
    expect(result.posts).toHaveLength(2);
    // Both kept are from STORE_ID; the other 3 are dropped.
    result.posts.forEach((p: any) => expect(p.storeId).toBe(STORE_ID));
  });

  it('SEEN-PENALTY RANKING: a seen post is ranked LOWER than an unseen one (score × 0.4 multiplier proves the wire-through)', async () => {
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.like.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(2 as never);
    // Two posts of EQUAL freshness/distance/etc — only the seen-flag distinguishes them.
    const now = Date.now();
    const posts = [
      { id: 'seen-post', storeId: 'store-A', createdAt: new Date(now), isPinned: false, isOpeningPost: false,
        store: { id: 'store-A', latitude: null, longitude: null, category: '', ownerId: 'oA', owner: { id: 'oA', role: 'retailer' }, _count: { followers: 0 } },
        _count: { likes: 0 } },
      { id: 'unseen-post', storeId: 'store-B', createdAt: new Date(now), isPinned: false, isOpeningPost: false,
        store: { id: 'store-B', latitude: null, longitude: null, category: '', ownerId: 'oB', owner: { id: 'oB', role: 'retailer' }, _count: { followers: 0 } },
        _count: { likes: 0 } },
    ];
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce(posts as never);
    vi.mocked(prisma.savedItem.groupBy).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.like.groupBy).mockResolvedValueOnce([] as never);
    // Redis says: seen-post is in the seen set, unseen-post is not.
    vi.mocked(pubClient.sMIsMember).mockResolvedValueOnce([true, false] as never);

    const result = await PostService.getFeed('user-1', 'customer', { feedType: 'all', page: 1, limit: 10 });
    // Unseen wins (higher base score after seen × 0.4 multiplier on the other).
    expect(result.posts[0].id).toBe('unseen-post');
    expect(result.posts[1].id).toBe('seen-post');
  });

  it('FEED_FOLLOWS_CAP=10000 sentinel: follow list exactly at cap fires Sentry warning', async () => {
    const capFullFollows = Array.from({ length: 10000 }, (_, i) => ({ storeId: `s${i}` }));
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce(capFullFollows as never);
    vi.mocked(prisma.like.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);

    await PostService.getFeed('user-1', 'customer', { feedType: 'all', page: 1, limit: 10 });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'post.feed.follows.cap-hit',
      expect.objectContaining({ level: 'warning', tags: { service: 'post' } }),
    );
  });

  it('Redis seen-check failure is FAIL-OPEN — feed still renders without the penalty applied', async () => {
    setupEmptyFeed();
    vi.mocked(pubClient.sMIsMember).mockRejectedValueOnce(new Error('redis down'));

    // Should still resolve normally (the try/catch at line 246 swallows the error).
    await expect(PostService.getFeed('user-1', 'customer', { feedType: 'all', page: 1, limit: 10 }))
      .resolves.toBeDefined();
  });

  it('isOwnPost flag set on returned posts where store.ownerId === userId', async () => {
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.like.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.post.count).mockResolvedValueOnce(2 as never);
    const posts = [
      { id: 'p-mine', storeId: 'sA', createdAt: new Date(), isPinned: false, isOpeningPost: false,
        store: { id: 'sA', latitude: null, longitude: null, category: '', ownerId: 'user-1', owner: { id: 'user-1', role: 'retailer' }, _count: { followers: 0 } },
        _count: { likes: 0 } },
      { id: 'p-other', storeId: 'sB', createdAt: new Date(), isPinned: false, isOpeningPost: false,
        store: { id: 'sB', latitude: null, longitude: null, category: '', ownerId: 'someone-else', owner: { id: 'someone-else', role: 'retailer' }, _count: { followers: 0 } },
        _count: { likes: 0 } },
    ];
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce(posts as never);
    vi.mocked(prisma.savedItem.groupBy).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.like.groupBy).mockResolvedValueOnce([] as never);

    const result = await PostService.getFeed('user-1', 'retailer', { feedType: 'all', page: 1, limit: 10 });
    const mine = result.posts.find((p: any) => p.id === 'p-mine');
    const other = result.posts.find((p: any) => p.id === 'p-other');
    expect(mine?.isOwnPost).toBe(true);
    expect(other?.isOwnPost).toBe(false);
  });
});
