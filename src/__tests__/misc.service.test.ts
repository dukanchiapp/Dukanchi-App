import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.44 / Phase 4.3 — MiscService spec coverage.
 *
 * 6 public methods:
 *   - submitComplaint      — write-only, trusts JWT
 *   - submitReport         — XOR validation (user OR store target)
 *   - getStoreReviews      — paginated, anonymize-deleted-users policy
 *   - getProductReviews    — same shape, productId scope
 *   - createReview         — XOR validation + recompute aggregates +
 *                            Prisma P2002 propagates (D3 unique constraint
 *                            from session 128.31)
 *   - getAppSettings       — singleton with lazy-init on first call
 *
 * Existing route-level coverage:
 *   - reviews.routes.test.ts — covers P2002 → 409 mapping at HTTP layer.
 *     Don't duplicate; assert the service contract directly here.
 *
 * Philosophy: tests encode the INTENDED SPEC. If a spec test fails it
 * means a real bug exists → STOP, report it, do NOT weaken.
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
    complaint: { create: vi.fn() },
    report: { create: vi.fn() },
    review: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    store: { update: vi.fn() },
    product: { update: vi.fn() },
    appSettings: { findUnique: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { prisma } from '../config/prisma';
import { MiscService } from '../modules/misc/misc.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const STORE_ID = 'store-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_ID = 'prod-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. submitComplaint ──────────────────────────────────────────────────────
describe('MiscService.submitComplaint', () => {
  it('persists the 3 fields (userId, issueType, description) verbatim — trusts the JWT-derived userId', async () => {
    vi.mocked(prisma.complaint.create).mockResolvedValueOnce({ id: 'c1' } as never);
    await MiscService.submitComplaint(USER_ID, 'bug', 'It crashed on the home feed');

    const args = vi.mocked(prisma.complaint.create).mock.calls[0][0] as any;
    expect(args.data).toEqual({
      userId: USER_ID,
      issueType: 'bug',
      description: 'It crashed on the home feed',
    });
  });
});

// ── 2. submitReport ─────────────────────────────────────────────────────────
describe('MiscService.submitReport', () => {
  it('throws when neither reportedUserId nor reportedStoreId provided', async () => {
    await expect(MiscService.submitReport(USER_ID, 'spam')).rejects.toThrow(/reportedUserId or reportedStoreId is required/);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('reports a USER: reportedUserId set, reportedStoreId stored as null', async () => {
    vi.mocked(prisma.report.create).mockResolvedValueOnce({ id: 'r1' } as never);
    await MiscService.submitReport(USER_ID, 'harassment', OTHER_USER_ID);
    const args = vi.mocked(prisma.report.create).mock.calls[0][0] as any;
    expect(args.data).toMatchObject({
      reason: 'harassment',
      reportedByUserId: USER_ID,
      reportedUserId: OTHER_USER_ID,
      reportedStoreId: null,
    });
  });

  it('reports a STORE: reportedStoreId set, reportedUserId stored as null', async () => {
    vi.mocked(prisma.report.create).mockResolvedValueOnce({ id: 'r1' } as never);
    await MiscService.submitReport(USER_ID, 'fake', undefined, STORE_ID);
    const args = vi.mocked(prisma.report.create).mock.calls[0][0] as any;
    expect(args.data).toMatchObject({
      reason: 'fake',
      reportedByUserId: USER_ID,
      reportedUserId: null,
      reportedStoreId: STORE_ID,
    });
  });

  it('SPEC NOTE — service does NOT defend against self-report (user A reporting user A); that policy lives at the controller layer if needed', async () => {
    // Documented contract: a user reporting themselves is technically allowed
    // at the SERVICE layer. The controller layer can add a check if product
    // policy needs it. This test PASSES today by design — surface the
    // assumption so it can't silently change.
    vi.mocked(prisma.report.create).mockResolvedValueOnce({ id: 'r1' } as never);
    await expect(MiscService.submitReport(USER_ID, 'self-report', USER_ID))
      .resolves.toBeDefined();
    const args = vi.mocked(prisma.report.create).mock.calls[0][0] as any;
    expect(args.data.reportedByUserId).toBe(USER_ID);
    expect(args.data.reportedUserId).toBe(USER_ID);  // same user
  });
});

// ── 3. getStoreReviews / getProductReviews ─────────────────────────────────
describe('MiscService.getStoreReviews', () => {
  it('returns { reviews, total, page, totalPages } with pagination math', async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValueOnce([{ id: 'r1' }] as never);
    vi.mocked(prisma.review.count).mockResolvedValueOnce(25 as never);

    const result = await MiscService.getStoreReviews(STORE_ID, 2, 10);
    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(3);  // Math.ceil(25/10)
  });

  it('passes skip = (page-1)*limit and take = limit to findMany', async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.review.count).mockResolvedValueOnce(0 as never);
    await MiscService.getStoreReviews(STORE_ID, 3, 20);
    const args = vi.mocked(prisma.review.findMany).mock.calls[0][0] as any;
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
    expect(args.where).toEqual({ storeId: STORE_ID });
  });

  it('D2 anonymize: include user.deletedAt so the frontend can render "Deleted user" (content stays visible)', async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.review.count).mockResolvedValueOnce(0 as never);
    await MiscService.getStoreReviews(STORE_ID, 1, 10);
    const args = vi.mocked(prisma.review.findMany).mock.calls[0][0] as any;
    // include.user.select must carry deletedAt (the anonymize signal).
    expect(args.include.user.select.deletedAt).toBe(true);
    expect(args.include.user.select.id).toBe(true);
    expect(args.include.user.select.name).toBe(true);
  });

  it('totalPages math handles total=0 (empty store) → 0 pages', async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.review.count).mockResolvedValueOnce(0 as never);
    const result = await MiscService.getStoreReviews(STORE_ID, 1, 10);
    expect(result.totalPages).toBe(0);  // Math.ceil(0/10)
  });
});

describe('MiscService.getProductReviews', () => {
  it('same pagination + anonymize policy as getStoreReviews, scoped to productId', async () => {
    vi.mocked(prisma.review.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.review.count).mockResolvedValueOnce(15 as never);
    const result = await MiscService.getProductReviews(PRODUCT_ID, 1, 10);
    expect(result.total).toBe(15);
    expect(result.totalPages).toBe(2);
    const args = vi.mocked(prisma.review.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({ productId: PRODUCT_ID });
    expect(args.include.user.select.deletedAt).toBe(true);
  });
});

// ── 4. createReview — XOR + aggregates + P2002 propagation ──────────────────
describe('MiscService.createReview', () => {
  it('XOR validation: missing BOTH storeId and productId → throws "Must review either a store or a product"', async () => {
    await expect(MiscService.createReview(USER_ID, { rating: 5, comment: 'great' }))
      .rejects.toThrow(/Must review either a store or a product/);
    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  it('XOR validation: BOTH storeId and productId provided → throws "Cannot review both store and product at once"', async () => {
    await expect(MiscService.createReview(USER_ID, { rating: 5, storeId: STORE_ID, productId: PRODUCT_ID }))
      .rejects.toThrow(/Cannot review both store and product at once/);
    expect(prisma.review.create).not.toHaveBeenCalled();
  });

  it('STORE review happy path: creates review, recomputes store aggregates (averageRating + reviewCount) via review.aggregate', async () => {
    vi.mocked(prisma.review.create).mockResolvedValueOnce({ id: 'r1', rating: 5 } as never);
    vi.mocked(prisma.review.aggregate).mockResolvedValueOnce({
      _avg: { rating: 4.6 }, _count: { id: 23 },
    } as never);
    vi.mocked(prisma.store.update).mockResolvedValueOnce({} as never);

    const result = await MiscService.createReview(USER_ID, { rating: 5, comment: 'awesome', storeId: STORE_ID });
    expect(result).toMatchObject({ id: 'r1', rating: 5 });

    // store.update is called with the freshly-recomputed aggregates.
    const updateArgs = vi.mocked(prisma.store.update).mock.calls[0][0] as any;
    expect(updateArgs.where).toEqual({ id: STORE_ID });
    expect(updateArgs.data).toEqual({ averageRating: 4.6, reviewCount: 23 });

    // product.update is NOT called on the store path.
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('PRODUCT review happy path: creates review, recomputes product aggregates, store.update NOT called', async () => {
    vi.mocked(prisma.review.create).mockResolvedValueOnce({ id: 'r2', rating: 3 } as never);
    vi.mocked(prisma.review.aggregate).mockResolvedValueOnce({
      _avg: { rating: 3.2 }, _count: { id: 7 },
    } as never);
    vi.mocked(prisma.product.update).mockResolvedValueOnce({} as never);

    await MiscService.createReview(USER_ID, { rating: 3, comment: 'meh', productId: PRODUCT_ID });

    const updateArgs = vi.mocked(prisma.product.update).mock.calls[0][0] as any;
    expect(updateArgs.where).toEqual({ id: PRODUCT_ID });
    expect(updateArgs.data).toEqual({ averageRating: 3.2, reviewCount: 7 });
    expect(prisma.store.update).not.toHaveBeenCalled();
  });

  it('aggregates default to 0 when _avg.rating is null (no reviews yet, edge case)', async () => {
    vi.mocked(prisma.review.create).mockResolvedValueOnce({ id: 'r1' } as never);
    vi.mocked(prisma.review.aggregate).mockResolvedValueOnce({
      _avg: { rating: null }, _count: { id: 0 },
    } as never);
    vi.mocked(prisma.store.update).mockResolvedValueOnce({} as never);

    await MiscService.createReview(USER_ID, { rating: 5, storeId: STORE_ID });
    const updateArgs = vi.mocked(prisma.store.update).mock.calls[0][0] as any;
    expect(updateArgs.data.averageRating).toBe(0);  // null → 0 fallback
  });

  it('D3 unique-constraint (session 128.31): Prisma P2002 propagates — controller catches and maps to 409', async () => {
    const p2002 = new Error('Unique constraint failed');
    (p2002 as any).code = 'P2002';
    vi.mocked(prisma.review.create).mockRejectedValueOnce(p2002);
    await expect(MiscService.createReview(USER_ID, { rating: 5, storeId: STORE_ID }))
      .rejects.toThrow();
    // Aggregates are NOT recomputed when create fails — defensive ordering.
    expect(prisma.review.aggregate).not.toHaveBeenCalled();
    expect(prisma.store.update).not.toHaveBeenCalled();
  });
});

// ── 5. getAppSettings — singleton with lazy-init ────────────────────────────
describe('MiscService.getAppSettings', () => {
  it('returns the existing singleton row when present', async () => {
    const settings = { id: 'singleton', appName: 'Dukanchi', primaryColor: '#FFD63B' };
    vi.mocked(prisma.appSettings.findUnique).mockResolvedValueOnce(settings as never);

    const result = await MiscService.getAppSettings();
    expect(result).toEqual(settings);
    expect(prisma.appSettings.create).not.toHaveBeenCalled();
  });

  it('LAZY-INIT: creates the singleton on first call when no row exists', async () => {
    vi.mocked(prisma.appSettings.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.appSettings.create).mockResolvedValueOnce({ id: 'singleton' } as never);

    const result = await MiscService.getAppSettings();
    expect(result).toEqual({ id: 'singleton' });
    // Lazy-init uses the singleton id verbatim — the row key is the literal 'singleton' string.
    const createArgs = vi.mocked(prisma.appSettings.create).mock.calls[0][0] as any;
    expect(createArgs.data).toEqual({ id: 'singleton' });
  });

  it('singleton lookup uses the documented id: "singleton" PK', async () => {
    vi.mocked(prisma.appSettings.findUnique).mockResolvedValueOnce({ id: 'singleton' } as never);
    await MiscService.getAppSettings();
    const findArgs = vi.mocked(prisma.appSettings.findUnique).mock.calls[0][0] as any;
    expect(findArgs.where).toEqual({ id: 'singleton' });
  });
});
