import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.51 / Phase 6.2 — UserService spec coverage.
 *
 * 8 public methods (140 LOC) on UserService. Baseline 30.3% lines.
 *
 * Marquee tests (5):
 *   - getUserProfile FIELD-SCOPE: select projects ONLY id/name/role/email
 *     — NOT phone/password/kyc* (defense against field-explosion regression)
 *   - getUserProfile soft-delete: WHERE clause requires deletedAt:null
 *   - updateUserProfile P2002 → opaque error map (phone uniqueness leak
 *     prevention — caller sees clean text, not "P2002")
 *   - WHERE userId IDOR scope across all 5 read methods (getFollowed,
 *     getSaved, getReviews, getSearchHistory, getLocations)
 *   - 4 cap-sentinel tests (5000/5000/5000/1000)
 *
 * Philosophy: encode INTENDED SPEC. If a spec test fails → real bug.
 */

vi.mock('../config/prisma', () => ({
  prisma: {
    store: { findFirst: vi.fn() },
    user: { findFirst: vi.fn(), update: vi.fn() },
    follow: { findMany: vi.fn() },
    savedItem: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    searchHistory: { findMany: vi.fn() },
    savedLocation: { findMany: vi.fn() },
    post: { findMany: vi.fn() },
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: { del: vi.fn(), get: vi.fn(), set: vi.fn(), on: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/node';
import { prisma } from '../config/prisma';
import { pubClient } from '../config/redis';
import { UserService } from '../modules/users/user.service';

const USER_A = 'user-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'user-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pubClient.del).mockResolvedValue(1 as never);
});

// ── 1. getUserStore — WHERE ownerId scope ─────────────────────────────────
describe('UserService.getUserStore', () => {
  it('WHERE clause scopes to ownerId; _count counters included', async () => {
    vi.mocked(prisma.store.findFirst).mockResolvedValueOnce({ id: 's1', _count: { posts: 0, products: 0, followers: 0 } } as never);
    await UserService.getUserStore(USER_A);
    const args = vi.mocked(prisma.store.findFirst).mock.calls[0][0] as any;
    expect(args.where).toEqual({ ownerId: USER_A });
    expect(args.include._count.select).toEqual({ posts: true, products: true, followers: true });
  });
});

// ── 2. getUserProfile — MARQUEE: field-scope + soft-delete ────────────────
describe('UserService.getUserProfile — MARQUEE field-scope + soft-delete', () => {
  it('MARQUEE: WHERE requires deletedAt: null — soft-deleted users hidden from public reads', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null as never);
    await UserService.getUserProfile(USER_A);
    const args = vi.mocked(prisma.user.findFirst).mock.calls[0][0] as any;
    expect(args.where.id).toBe(USER_A);
    expect(args.where.deletedAt).toBeNull();
  });

  it('MARQUEE: select projects ONLY id/name/role/email — phone/password/kyc* MUST NOT be in the select set', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null as never);
    await UserService.getUserProfile(USER_A);
    const args = vi.mocked(prisma.user.findFirst).mock.calls[0][0] as any;
    expect(args.select).toEqual({ id: true, name: true, role: true, email: true });
    // Defense against field-explosion regression — if anyone adds phone, password,
    // kycDocumentUrl, kycSelfieUrl etc. to this select, this fails and tells them why.
    expect(args.select).not.toHaveProperty('phone');
    expect(args.select).not.toHaveProperty('password');
    expect(args.select).not.toHaveProperty('kycDocumentUrl');
    expect(args.select).not.toHaveProperty('kycSelfieUrl');
    expect(args.select).not.toHaveProperty('deletedAt');
  });

  it('soft-deleted user → findFirst returns null → service returns null (controller maps to 404)', async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null as never);
    const result = await UserService.getUserProfile(USER_A);
    expect(result).toBeNull();
  });
});

// ── 3. updateUserProfile — MARQUEE: P2002 opaque error map ─────────────────
describe('UserService.updateUserProfile — MARQUEE P2002 → opaque error', () => {
  it('happy path: prisma.user.update fires; Redis del runs (best-effort)', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: USER_A, name: 'Ravi' } as never);
    await UserService.updateUserProfile(USER_A, { name: 'Ravi' });
    const args = vi.mocked(prisma.user.update).mock.calls[0][0] as any;
    expect(args.where).toEqual({ id: USER_A });
    expect(args.data).toEqual({ name: 'Ravi' });
    expect(pubClient.del).toHaveBeenCalledWith('admin:stats');
  });

  it('MARQUEE: Prisma P2002 (unique constraint) → opaque "phone number is already in use" — raw P2002 code MUST NOT leak', async () => {
    const p2002 = Object.assign(new Error('Unique constraint failed on the fields: (`phone`)'), { code: 'P2002' });
    vi.mocked(prisma.user.update).mockRejectedValueOnce(p2002);

    let captured: any;
    try {
      await UserService.updateUserProfile(USER_A, { phone: '999' });
    } catch (e: any) { captured = e; }
    expect(captured).toBeDefined();
    expect(captured.message).toBe('This phone number is already in use by another account.');
    // Critical: the raw P2002 code does NOT surface to the controller
    expect(captured.message).not.toContain('P2002');
    expect(captured.message).not.toContain('Unique constraint');
  });

  it('non-P2002 errors re-thrown unchanged (so other failure modes still surface to Sentry)', async () => {
    const otherError = new Error('connection lost');
    vi.mocked(prisma.user.update).mockRejectedValueOnce(otherError);

    await expect(UserService.updateUserProfile(USER_A, { name: 'X' })).rejects.toThrow('connection lost');
  });

  it('Redis del failure → does NOT propagate (best-effort cache invalidation)', async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: USER_A } as never);
    vi.mocked(pubClient.del).mockRejectedValueOnce(new Error('redis down'));

    await expect(UserService.updateUserProfile(USER_A, { name: 'X' })).resolves.toBeDefined();
  });
});

// ── 4. getFollowedStores — WHERE userId + CAP sentinel ─────────────────────
describe('UserService.getFollowedStores', () => {
  it('MARQUEE: WHERE userId scope + take 5000 + order by createdAt desc', async () => {
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce([] as never);
    await UserService.getFollowedStores(USER_A);
    const args = vi.mocked(prisma.follow.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({ userId: USER_A });
    expect(args.take).toBe(5000);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('returns .map(f => f.store) — store objects only, not the follow row', async () => {
    const followRows = [
      { store: { id: 's1', storeName: 'A' } },
      { store: { id: 's2', storeName: 'B' } },
    ];
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce(followRows as never);
    const result = await UserService.getFollowedStores(USER_A);
    expect(result).toEqual([
      { id: 's1', storeName: 'A' },
      { id: 's2', storeName: 'B' },
    ]);
  });

  it('CAP sentinel: 5000 follows returned → Sentry user.getFollowedStores.cap-hit fires', async () => {
    const capped = Array.from({ length: 5000 }, (_, i) => ({ store: { id: `s${i}` } }));
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce(capped as never);
    await UserService.getFollowedStores(USER_A);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'user.getFollowedStores.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('below cap → NO Sentry fire', async () => {
    vi.mocked(prisma.follow.findMany).mockResolvedValueOnce([{ store: { id: 's1' } }] as never);
    await UserService.getFollowedStores(USER_A);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});

// ── 5. getSavedItems — WHERE userId + D2 anonymize + CAP ──────────────────
describe('UserService.getSavedItems', () => {
  it('WHERE userId scope; take 5000; ordering desc', async () => {
    vi.mocked(prisma.savedItem.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);
    await UserService.getSavedItems(USER_A);
    const args = vi.mocked(prisma.savedItem.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({ userId: USER_A });
    expect(args.take).toBe(5000);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('post-type saves → second query hydrates posts with store.owner.deletedAt surfaced (D2 anonymize policy)', async () => {
    vi.mocked(prisma.savedItem.findMany).mockResolvedValueOnce([
      { type: 'post', referenceId: 'p1' },
      { type: 'post', referenceId: 'p2' },
      { type: 'store', referenceId: 's1' },  // not hydrated
    ] as never);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([
      { id: 'p1', store: { owner: { id: 'u1', deletedAt: null } } },
      { id: 'p2', store: { owner: { id: 'u2', deletedAt: new Date('2026-06-10') } } },  // soft-deleted author — STILL surfaced (D2 policy)
    ] as never);

    const result = await UserService.getSavedItems(USER_A);
    // Both posts returned — deleted author's post NOT filtered out
    expect(result.posts).toHaveLength(2);
    // owner.deletedAt is included so the UI can render "Deleted user"
    expect((result.posts[1] as any).store.owner.deletedAt).toBeInstanceOf(Date);
    // Post query was scoped to only the post-type referenceIds
    const postArgs = vi.mocked(prisma.post.findMany).mock.calls[0][0] as any;
    expect(postArgs.where.id.in).toEqual(['p1', 'p2']);  // 's1' (store-type) excluded
  });

  it('CAP sentinel: 5000 saved items → Sentry user.getSavedItems.cap-hit fires', async () => {
    const capped = Array.from({ length: 5000 }, (_, i) => ({ type: 'store', referenceId: `s${i}` }));
    vi.mocked(prisma.savedItem.findMany).mockResolvedValueOnce(capped as never);
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);
    await UserService.getSavedItems(USER_A);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'user.getSavedItems.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });
});

// ── 6. getReviews — WHERE userId + CAP ────────────────────────────────────
describe('UserService.getReviews', () => {
  it('WHERE userId scope; take 5000; includes store + product', async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValueOnce([] as never);
    await UserService.getReviews(USER_A);
    const args = vi.mocked(prisma.review.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({ userId: USER_A });
    expect(args.take).toBe(5000);
    expect(args.include.store.select).toEqual({ id: true, storeName: true });
    expect(args.include.product.select).toEqual({ id: true, productName: true });
  });

  it('CAP sentinel: 5000 reviews → Sentry user.getReviews.cap-hit fires', async () => {
    const capped = Array.from({ length: 5000 }, (_, i) => ({ id: `r${i}` }));
    vi.mocked(prisma.review.findMany).mockResolvedValueOnce(capped as never);
    await UserService.getReviews(USER_A);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'user.getReviews.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });
});

// ── 7. getSearchHistory — WHERE userId + small fixed take ─────────────────
describe('UserService.getSearchHistory', () => {
  it('WHERE userId scope; take 20 (small fixed window — no cap sentinel needed)', async () => {
    vi.mocked(prisma.searchHistory.findMany).mockResolvedValueOnce([] as never);
    await UserService.getSearchHistory(USER_A);
    const args = vi.mocked(prisma.searchHistory.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({ userId: USER_A });
    expect(args.take).toBe(20);
  });

  it('cross-user IDOR proof: USER_B param → ONLY USER_B in WHERE, never USER_A', async () => {
    vi.mocked(prisma.searchHistory.findMany).mockResolvedValueOnce([] as never);
    await UserService.getSearchHistory(USER_B);
    const args = vi.mocked(prisma.searchHistory.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({ userId: USER_B });
  });
});

// ── 8. getLocations — WHERE userId + CAP ──────────────────────────────────
describe('UserService.getLocations', () => {
  it('WHERE userId scope; take 1000 (smaller cap than other listings)', async () => {
    vi.mocked(prisma.savedLocation.findMany).mockResolvedValueOnce([] as never);
    await UserService.getLocations(USER_A);
    const args = vi.mocked(prisma.savedLocation.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({ userId: USER_A });
    expect(args.take).toBe(1000);
  });

  it('CAP sentinel: 1000 locations → Sentry user.getLocations.cap-hit fires', async () => {
    const capped = Array.from({ length: 1000 }, (_, i) => ({ id: `l${i}` }));
    vi.mocked(prisma.savedLocation.findMany).mockResolvedValueOnce(capped as never);
    await UserService.getLocations(USER_A);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'user.getLocations.cap-hit',
      expect.objectContaining({ level: 'warning' }),
    );
  });
});
