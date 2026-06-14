import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.43 / Phase 4.2 — NotificationService spec coverage.
 *
 * IDOR-CRITICAL service. The cross-user-contamination guard is the marquee:
 *   - getNotifications: WHERE scoped to {userId} so a user only sees their own
 *   - markAsRead:       WHERE is {id, userId} — BOTH fields. Another user's
 *                       notification with the same id cannot be updated
 *                       (no row matches both → Prisma P2025).
 *   - markAllAsRead:    WHERE is {userId, isRead:false} — updateMany
 *                       scoped, no cross-user contamination possible.
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
    notification: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { prisma } from '../config/prisma';
import { NotificationService } from '../modules/notifications/notification.service';

const USER_A = 'aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B_ATTACKER = 'bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const NOTIF_ID = 'notif-1111-1111-1111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. getNotifications — user-scoped, 50-cap ───────────────────────────────
describe('NotificationService.getNotifications', () => {
  it('passes WHERE userId so the response only contains the requesting user\'s notifications', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([
      { id: 'n1', userId: USER_A, message: 'hi', isRead: false, createdAt: new Date() },
    ] as never);

    await NotificationService.getNotifications(USER_A);
    const args = vi.mocked(prisma.notification.findMany).mock.calls[0][0] as any;
    // CRITICAL IDOR DEFENSE — the WHERE clause MUST include userId.
    expect(args.where).toEqual({ userId: USER_A });
  });

  it('passes take:50 (defensive bound — no cursor pagination today, but capped)', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([] as never);
    await NotificationService.getNotifications(USER_A);
    const args = vi.mocked(prisma.notification.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(50);
  });

  it('orders by createdAt desc (newest first)', async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([] as never);
    await NotificationService.getNotifications(USER_A);
    const args = vi.mocked(prisma.notification.findMany).mock.calls[0][0] as any;
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
  });
});

// ── 2. markAsRead — IDOR DEFENSE via {id, userId} both-fields WHERE ─────────
describe('NotificationService.markAsRead — IDOR-critical', () => {
  it('passes WHERE with BOTH id AND userId (so another user cannot flip your notification by guessing the id)', async () => {
    vi.mocked(prisma.notification.update).mockResolvedValueOnce({ id: NOTIF_ID } as never);
    await NotificationService.markAsRead(NOTIF_ID, USER_A);

    const args = vi.mocked(prisma.notification.update).mock.calls[0][0] as any;
    // CRITICAL: WHERE must be {id, userId} — BOTH fields. If a future
    // refactor changes this to just {id}, the test fails — which is the
    // spec failure that means a real IDOR bug.
    expect(args.where).toEqual({ id: NOTIF_ID, userId: USER_A });
    expect(args.data).toEqual({ isRead: true });
  });

  it('IDOR: another user attempts to mark User A\'s notification → Prisma P2025 (no row matches both id+userId)', async () => {
    // The mock simulates Prisma's behaviour: update where no row matches → P2025.
    // The service intentionally lets this propagate so the controller can
    // map to 404 (rather than silently noop'ing, which would be a leak in
    // the opposite direction — letting the attacker know they hit a real id).
    const p2025 = new Error('No record found');
    (p2025 as any).code = 'P2025';
    vi.mocked(prisma.notification.update).mockRejectedValueOnce(p2025);
    await expect(NotificationService.markAsRead(NOTIF_ID, USER_B_ATTACKER)).rejects.toThrow();
    // The attempt was made with {id, userId: attacker} — the WHERE clause
    // is the proof that even though Prisma was asked, no row matches.
    const args = vi.mocked(prisma.notification.update).mock.calls[0][0] as any;
    expect(args.where).toEqual({ id: NOTIF_ID, userId: USER_B_ATTACKER });
  });
});

// ── 3. markAllAsRead — IDOR DEFENSE via updateMany WHERE userId ────────────
describe('NotificationService.markAllAsRead — IDOR-critical bulk update', () => {
  it('updateMany WHERE includes userId (no cross-user contamination — User A\'s call does NOT flip User B\'s notifications)', async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 5 } as never);
    const result = await NotificationService.markAllAsRead(USER_A);
    expect(result).toEqual({ success: true });

    const args = vi.mocked(prisma.notification.updateMany).mock.calls[0][0] as any;
    // CRITICAL: the WHERE must scope to userId. If a future refactor
    // drops this filter, EVERY notification in the table gets flipped —
    // the marquee failure mode this test catches.
    expect(args.where.userId).toBe(USER_A);
    expect(args.data).toEqual({ isRead: true });
  });

  it('updateMany WHERE also includes isRead:false (only unread notifications are touched — no needless writes on already-read rows)', async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 0 } as never);
    await NotificationService.markAllAsRead(USER_A);
    const args = vi.mocked(prisma.notification.updateMany).mock.calls[0][0] as any;
    expect(args.where.isRead).toBe(false);
  });

  it('returns {success:true} regardless of count (a no-op call with 0 rows is still success)', async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 0 } as never);
    expect(await NotificationService.markAllAsRead(USER_A)).toEqual({ success: true });
  });

  it('IDOR scenario: User B attacker calls markAllAsRead → only User B\'s notifications are touched; User A unaffected (the WHERE scopes the bulk op)', async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 3 } as never);
    await NotificationService.markAllAsRead(USER_B_ATTACKER);

    // The WHERE was scoped to USER_B_ATTACKER — User A's rows are
    // untouched because the WHERE filter excluded them.
    const args = vi.mocked(prisma.notification.updateMany).mock.calls[0][0] as any;
    expect(args.where.userId).toBe(USER_B_ATTACKER);
    expect(args.where.userId).not.toBe(USER_A);
  });
});
