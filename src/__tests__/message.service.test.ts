import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.46 / Phase 5.2 — MessageService spec coverage.
 *
 * **The chat surface is the highest-trust IDOR boundary in the app.**
 * A leak here means one user's private messages reach another. Tests
 * encode the INTENDED SPEC — if a spec assertion fails, that is a
 * CRITICAL IDOR BUG, STOP and report, do NOT weaken.
 *
 * 3 public methods:
 *   - getMessages(userId, otherUserId, before?, limit=100)
 *       WHERE OR: [{sender:user, recv:other}, {sender:other, recv:user}]
 *       — the hijack-prevention contract (both ids appear on every branch)
 *   - getConversations(userId)
 *       WHERE OR: [{senderId:userId}, {receiverId:userId}] — always scoped
 *       D2 anonymize: deleted users NOT hidden, surface deletedAt
 *   - sendMessage(senderId, receiverId, text, imageUrl?, imageUrls=[])
 *       canChat() permission gate fires BEFORE message.create
 *       availability checks (sender + receiver) BEFORE message.create
 *       side-effects (socket emit, in-app notification, push) BEST-EFFORT
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
    message: { findMany: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
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

// Mock the canChat wire-through. Session 128.30 covers the canChat matrix
// directly; here we control returns to verify that sendMessage CALLS canChat
// AND throws BEFORE message.create when it returns false.
vi.mock('../middlewares/auth.middleware', () => ({
  canChat: vi.fn(),
}));

vi.mock('../middlewares/user-status', async () => {
  const actual = await vi.importActual<typeof import('../middlewares/user-status')>('../middlewares/user-status');
  return {
    // Re-export evaluateUserStatus as-is — it's a pure function, no IO.
    evaluateUserStatus: actual.evaluateUserStatus,
  };
});

vi.mock('../services/push.service', () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/socket', () => ({
  getIO: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

import { prisma } from '../config/prisma';
import { canChat } from '../middlewares/auth.middleware';
import { sendPushToUser } from '../services/push.service';
import { getIO } from '../config/socket';
import { MessageService, ChatRejectionError } from '../modules/messages/message.service';

const USER_A = 'aaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_B = 'bbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_C_ATTACKER = 'cccc-cccc-cccc-cccc-cccccccccccc';

// Helper — build a healthy user row (not blocked, not deleted)
function activeUser(id: string, role = 'retailer', name = 'User') {
  return {
    id, role, name, password: 'opaque', isBlocked: false, deletedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default getIO() returns a chainable mock that records emit calls
  vi.mocked(getIO).mockReturnValue({
    to: vi.fn(() => ({ emit: vi.fn() })),
  } as never);
});

// ─────────────────────────────────────────────────────────────────────────
// PART A — IDOR-MARQUEE: the highest-severity bug class
// ─────────────────────────────────────────────────────────────────────────

describe('MessageService.getMessages — IDOR-CRITICAL hijack-prevention contract', () => {
  it('SECURITY MARQUEE — WHERE clause is `OR: [{sender:userId,recv:otherUserId},{sender:otherUserId,recv:userId}]` (both ids appear on EVERY branch — no missing-userId branch that could leak third-party messages)', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    await MessageService.getMessages(USER_A, USER_B);

    const args = vi.mocked(prisma.message.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({
      OR: [
        { senderId: USER_A, receiverId: USER_B },
        { senderId: USER_B, receiverId: USER_A },
      ],
    });
    // EVERY branch must include BOTH userId AND otherUserId. If a future
    // refactor drops one of them, third-party messages leak — the test catches it.
    args.where.OR.forEach((branch: any) => {
      expect(branch).toHaveProperty('senderId');
      expect(branch).toHaveProperty('receiverId');
      const ids = [branch.senderId, branch.receiverId].sort();
      expect(ids).toEqual([USER_A, USER_B].sort());
    });
  });

  it('IDOR ATTEMPT: User C (third party) querying for A↔B → WHERE includes ONLY {C,A} pairings, NOT A↔B leakage', async () => {
    // An attacker passing their own userId as the first param + A as otherUserId
    // would get back only C↔A messages (which they're entitled to). They CANNOT
    // pass A as userId and B as otherUserId — that would be a controller bug
    // (the controller must use req.user.userId, not a body field). The service-
    // level contract is: the FIRST argument is always one of the participants.
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    await MessageService.getMessages(USER_C_ATTACKER, USER_A);

    const args = vi.mocked(prisma.message.findMany).mock.calls[0][0] as any;
    // Neither branch contains USER_B — so the attacker C can never read A↔B.
    args.where.OR.forEach((branch: any) => {
      expect(branch.senderId).not.toBe(USER_B);
      expect(branch.receiverId).not.toBe(USER_B);
    });
  });

  it('limit cap: limit=9999 → Math.min(limit, 100) = 100; take = 100+1 = 101 (the +1 is for hasMore detection)', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    await MessageService.getMessages(USER_A, USER_B, undefined, 9999);
    const args = vi.mocked(prisma.message.findMany).mock.calls[0][0] as any;
    expect(args.take).toBe(101);  // 100-cap + 1-for-hasMore
  });

  it('hasMore detection: when more than `take` rows returned, the extra is popped and hasMore=true', async () => {
    // 11 messages with take=10 (limit=10) → hasMore=true, returned 10
    const messages = Array.from({ length: 11 }, (_, i) => ({
      id: `m${i}`, senderId: USER_A, receiverId: USER_B, message: `msg ${i}`,
      createdAt: new Date(Date.now() - i * 1000),
    }));
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never);

    const result = await MessageService.getMessages(USER_A, USER_B, undefined, 10);
    expect(result.hasMore).toBe(true);
    expect(result.messages).toHaveLength(10);  // the 11th was popped
    expect(result.nextCursor).toBe(result.messages[0]?.id);
  });

  it('no hasMore: when fewer than `take+1` rows returned, hasMore=false and nextCursor=null', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
      { id: 'm1', senderId: USER_A, receiverId: USER_B, message: 'hi', createdAt: new Date() },
    ] as never);
    const result = await MessageService.getMessages(USER_A, USER_B, undefined, 10);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('cursor pagination: `before` arg passed → cursor:{id:before} + skip:1 added to query', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    await MessageService.getMessages(USER_A, USER_B, 'cursor-msg-id', 10);
    const args = vi.mocked(prisma.message.findMany).mock.calls[0][0] as any;
    expect(args.cursor).toEqual({ id: 'cursor-msg-id' });
    expect(args.skip).toBe(1);
  });

  it('no `before` arg → no cursor + no skip', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    await MessageService.getMessages(USER_A, USER_B);
    const args = vi.mocked(prisma.message.findMany).mock.calls[0][0] as any;
    expect(args.cursor).toBeUndefined();
    expect(args.skip).toBeUndefined();
  });

  it('return order is ASCENDING (oldest-first) — Prisma query is DESC, then service reverses() to ASC for display', async () => {
    // Prisma returns DESC by createdAt — service should reverse to ASC.
    const t0 = new Date(2026, 5, 1).getTime();
    const messages = [
      { id: 'm3', message: 'newest', createdAt: new Date(t0 + 3000) },
      { id: 'm2', message: 'middle', createdAt: new Date(t0 + 2000) },
      { id: 'm1', message: 'oldest', createdAt: new Date(t0 + 1000) },
    ];
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never);
    const result = await MessageService.getMessages(USER_A, USER_B);
    expect(result.messages.map((m: any) => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('empty conversation → returns { messages: [], hasMore: false, nextCursor: null }', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    const result = await MessageService.getMessages(USER_A, USER_B);
    expect(result).toEqual({ messages: [], hasMore: false, nextCursor: null });
  });
});

describe('MessageService.getConversations — IDOR-CRITICAL WHERE userId scoping', () => {
  it('SECURITY MARQUEE — WHERE is `OR: [{senderId:userId},{receiverId:userId}]` — both branches require userId on EVERY query', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    await MessageService.getConversations(USER_A);
    const args = vi.mocked(prisma.message.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({
      OR: [{ senderId: USER_A }, { receiverId: USER_A }],
    });
    // Both branches mention userId. If a future refactor drops one, the
    // results include conversations that don't involve the requesting user.
    args.where.OR.forEach((branch: any) => {
      const isMine = branch.senderId === USER_A || branch.receiverId === USER_A;
      expect(isMine).toBe(true);
    });
  });

  it('happy path: dedup by other-participant — 3 conversations from 5 messages (2 with B, 2 with C, 1 with D) → 3 distinct conversation rows', async () => {
    const t = Date.now();
    const messages = [
      // Newest first (DESC); the FIRST occurrence per otherId is the conversation row
      { senderId: USER_A, receiverId: 'D', message: 'most recent with D', createdAt: new Date(t),
        receiver: { id: 'D', name: 'Dani', role: 'retailer', deletedAt: null, stores: [] } },
      { senderId: USER_C_ATTACKER, receiverId: USER_A, message: 'C → A', createdAt: new Date(t - 1000),
        sender: { id: USER_C_ATTACKER, name: 'Charu', role: 'customer', deletedAt: null, stores: [] } },
      { senderId: USER_A, receiverId: USER_C_ATTACKER, message: 'A → C earlier', createdAt: new Date(t - 2000),
        receiver: { id: USER_C_ATTACKER, name: 'Charu', role: 'customer', deletedAt: null, stores: [] } },
      { senderId: USER_B, receiverId: USER_A, message: 'B → A recent', createdAt: new Date(t - 3000),
        sender: { id: USER_B, name: 'Bandhu', role: 'retailer', deletedAt: null, stores: [] } },
      { senderId: USER_A, receiverId: USER_B, message: 'A → B earlier', createdAt: new Date(t - 4000),
        receiver: { id: USER_B, name: 'Bandhu', role: 'retailer', deletedAt: null, stores: [] } },
    ];
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never);
    const result = await MessageService.getConversations(USER_A);
    expect(result).toHaveLength(3);
    const ids = result.map((c: any) => c.userId).sort();
    expect(ids).toEqual(['D', USER_B, USER_C_ATTACKER].sort());
  });

  it('UNREAD heuristic: most-recent message where receiverId===userId → unread:1 (the conversation has unread)', async () => {
    const t = Date.now();
    const messages = [
      // Most recent with B is INBOUND (B → A) → unread:1 expected
      { senderId: USER_B, receiverId: USER_A, message: 'unread inbound', createdAt: new Date(t),
        sender: { id: USER_B, name: 'B', role: 'retailer', deletedAt: null, stores: [] } },
    ];
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never);
    const result = await MessageService.getConversations(USER_A);
    expect(result[0].unread).toBe(1);
  });

  it('UNREAD heuristic: most-recent message where senderId===userId (outbound) → unread:0', async () => {
    const t = Date.now();
    const messages = [
      { senderId: USER_A, receiverId: USER_B, message: 'my outbound', createdAt: new Date(t),
        receiver: { id: USER_B, name: 'B', role: 'retailer', deletedAt: null, stores: [] } },
    ];
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never);
    const result = await MessageService.getConversations(USER_A);
    expect(result[0].unread).toBe(0);
  });

  it('D2 ANONYMIZE: a conversation partner with deletedAt set still appears in the list; deletedAt is surfaced (frontend renders "Deleted user")', async () => {
    const deletedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messages = [
      { senderId: USER_B, receiverId: USER_A, message: 'before B deleted', createdAt: new Date(),
        sender: { id: USER_B, name: 'Was Bandhu', role: 'retailer', deletedAt, stores: [] } },
    ];
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never);
    const result = await MessageService.getConversations(USER_A);
    expect(result).toHaveLength(1);
    expect(result[0].deletedAt).toEqual(deletedAt);
    // The conversation is NOT hidden — that's the D2 anonymize policy.
  });

  it('STORE META: conversation partner with a store → conversation row carries category/openingTime/closingTime/etc. (Session 126 rich rows)', async () => {
    const messages = [
      { senderId: USER_B, receiverId: USER_A, message: 'hi', createdAt: new Date(),
        sender: {
          id: USER_B, name: 'B', role: 'retailer', deletedAt: null,
          stores: [{
            storeName: 'B Dukaan', logoUrl: 'r2://logo.jpg', category: 'Grocery',
            openingTime: '09:00', closingTime: '21:00', is24Hours: false,
            workingDays: 'mon,tue,wed,thu,fri', latitude: 19.07, longitude: 72.87,
            city: 'Mumbai', postalCode: '400050',
          }],
        }},
    ];
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never);
    const result = await MessageService.getConversations(USER_A);
    expect(result[0].name).toBe('B Dukaan');  // store name overrides user name
    expect(result[0].logoUrl).toBe('r2://logo.jpg');
    expect(result[0].store).toMatchObject({
      category: 'Grocery', openingTime: '09:00', closingTime: '21:00', is24Hours: false,
      city: 'Mumbai', postalCode: '400050',
    });
  });

  it('partner with no store (customer↔customer chat) → result row has store: null + uses user.name (not storeName)', async () => {
    const messages = [
      { senderId: USER_B, receiverId: USER_A, message: 'hi', createdAt: new Date(),
        sender: { id: USER_B, name: 'Bandhu', role: 'customer', deletedAt: null, stores: [] }},
    ];
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce(messages as never);
    const result = await MessageService.getConversations(USER_A);
    expect(result[0].name).toBe('Bandhu');
    expect(result[0].store).toBeNull();
  });

  it('empty: no messages → returns []', async () => {
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([] as never);
    const result = await MessageService.getConversations(USER_A);
    expect(result).toEqual([]);
  });
});

describe('MessageService.sendMessage — permission-gate + availability-gate ordering', () => {
  it('happy path: allowed pair (customer→retailer) + both active → message.create runs, returns saved message', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A, 'customer', 'Alice') as never)
      .mockResolvedValueOnce(activeUser(USER_B, 'retailer', 'Bandhu') as never);
    vi.mocked(canChat).mockReturnValueOnce(true);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({
      id: 'msg-1', senderId: USER_A, receiverId: USER_B, message: 'hi',
    } as never);

    const result = await MessageService.sendMessage(USER_A, USER_B, 'hi');
    expect(result).toMatchObject({ id: 'msg-1', message: 'hi' });

    expect(canChat).toHaveBeenCalledWith('customer', 'retailer');
    expect(prisma.message.create).toHaveBeenCalledOnce();
    const createArgs = vi.mocked(prisma.message.create).mock.calls[0][0] as any;
    expect(createArgs.data.senderId).toBe(USER_A);
    expect(createArgs.data.receiverId).toBe(USER_B);
  });

  it('CRITICAL ORDERING — denied pair (customer→supplier per #128.30 canChat matrix): throws BEFORE message.create. Prisma.create NEVER called.', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A, 'customer') as never)
      .mockResolvedValueOnce(activeUser(USER_B, 'supplier') as never);
    vi.mocked(canChat).mockReturnValueOnce(false);  // canChat denies

    await expect(MessageService.sendMessage(USER_A, USER_B, 'hi'))
      .rejects.toThrow('Chat not permitted between these roles');

    expect(canChat).toHaveBeenCalledOnce();
    // THE NON-NEGOTIABLE: message.create must NOT run when canChat returned false.
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('sender not found → throws "User not found"; NO availability checks attempted', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null as never)  // sender vanished
      .mockResolvedValueOnce(activeUser(USER_B) as never);
    await expect(MessageService.sendMessage(USER_A, USER_B, 'hi'))
      .rejects.toThrow('User not found');
    expect(canChat).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('receiver not found → throws "User not found"', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A) as never)
      .mockResolvedValueOnce(null as never);
    await expect(MessageService.sendMessage(USER_A, USER_B, 'hi'))
      .rejects.toThrow('User not found');
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('sender is BLOCKED → throws ChatRejectionError("sender", "blocked"); canChat NOT consulted; NO message created', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ ...activeUser(USER_A), isBlocked: true } as never)
      .mockResolvedValueOnce(activeUser(USER_B) as never);

    try {
      await MessageService.sendMessage(USER_A, USER_B, 'hi');
      throw new Error('expected ChatRejectionError');
    } catch (e) {
      expect(e).toBeInstanceOf(ChatRejectionError);
      expect((e as ChatRejectionError).subject).toBe('sender');
      expect((e as ChatRejectionError).reason).toBe('blocked');
    }
    expect(canChat).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('receiver is BLOCKED → throws ChatRejectionError("recipient", "blocked"); message NEVER lands in blocked user\'s inbox', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A) as never)
      .mockResolvedValueOnce({ ...activeUser(USER_B), isBlocked: true } as never);

    try {
      await MessageService.sendMessage(USER_A, USER_B, 'hi');
      throw new Error('expected ChatRejectionError');
    } catch (e) {
      expect(e).toBeInstanceOf(ChatRejectionError);
      expect((e as ChatRejectionError).subject).toBe('recipient');
      expect((e as ChatRejectionError).reason).toBe('blocked');
    }
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('receiver is DELETED (past grace) → throws ChatRejectionError("recipient", "deleted_expired"); no inbox landing', async () => {
    const expiredDeletedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);  // 1 day past
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A) as never)
      .mockResolvedValueOnce({ ...activeUser(USER_B), deletedAt: expiredDeletedAt } as never);

    try {
      await MessageService.sendMessage(USER_A, USER_B, 'hi');
      throw new Error('expected ChatRejectionError');
    } catch (e) {
      expect(e).toBeInstanceOf(ChatRejectionError);
      expect((e as ChatRejectionError).subject).toBe('recipient');
      expect((e as ChatRejectionError).reason).toBe('deleted_expired');
    }
  });

  it('receiver is DELETED_PENDING (within grace) → throws ChatRejectionError("recipient", "deleted_pending")', async () => {
    const futureDeletedAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);  // 10 days future
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A) as never)
      .mockResolvedValueOnce({ ...activeUser(USER_B), deletedAt: futureDeletedAt } as never);

    try {
      await MessageService.sendMessage(USER_A, USER_B, 'hi');
      throw new Error('expected ChatRejectionError');
    } catch (e) {
      expect(e).toBeInstanceOf(ChatRejectionError);
      expect((e as ChatRejectionError).reason).toBe('deleted_pending');
    }
  });

  it('SECURITY ORDERING — sender check fires BEFORE receiver check (so we don\'t leak whether the receiver is blocked via differential errors)', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ ...activeUser(USER_A), isBlocked: true } as never)
      .mockResolvedValueOnce({ ...activeUser(USER_B), isBlocked: true } as never);

    // When BOTH parties are blocked, the SENDER error fires first.
    try {
      await MessageService.sendMessage(USER_A, USER_B, 'hi');
    } catch (e) {
      expect((e as ChatRejectionError).subject).toBe('sender');
    }
  });

  it('stores both text and imageUrl when both supplied', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A) as never)
      .mockResolvedValueOnce(activeUser(USER_B) as never);
    vi.mocked(canChat).mockReturnValueOnce(true);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'm1' } as never);

    await MessageService.sendMessage(USER_A, USER_B, 'check this out', 'r2://image.jpg');
    const args = vi.mocked(prisma.message.create).mock.calls[0][0] as any;
    expect(args.data.message).toBe('check this out');
    expect(args.data.imageUrl).toBe('r2://image.jpg');
  });

  it('imageUrls (plural array) is preserved verbatim — image-only message with no text', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A) as never)
      .mockResolvedValueOnce(activeUser(USER_B) as never);
    vi.mocked(canChat).mockReturnValueOnce(true);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'm1' } as never);

    await MessageService.sendMessage(USER_A, USER_B, '', undefined, ['r2://a.jpg', 'r2://b.jpg']);
    const args = vi.mocked(prisma.message.create).mock.calls[0][0] as any;
    expect(args.data.message).toBe('');  // empty text preserved
    expect(args.data.imageUrl).toBeNull();
    expect(args.data.imageUrls).toEqual(['r2://a.jpg', 'r2://b.jpg']);
  });

  it('SPEC: self-message — when senderId === receiverId AND canChat(role,role)=true (same-role B2B), the service ALLOWS it (no service-level self-message guard)', async () => {
    // Service-level rule is just canChat(senderRole, receiverRole). When the
    // same user sends to themselves, both roles match — canChat with retailer-
    // retailer returns true (B2B↔B2B per #128.30 matrix). The service does NOT
    // add a separate self-message check; documented as passing-by-design.
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A, 'retailer') as never)
      .mockResolvedValueOnce(activeUser(USER_A, 'retailer') as never);
    vi.mocked(canChat).mockReturnValueOnce(true);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'self-msg' } as never);

    await expect(MessageService.sendMessage(USER_A, USER_A, 'note to self'))
      .resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PART B — SIDE-EFFECT BEST-EFFORT (socket emit + in-app notif + push)
// ─────────────────────────────────────────────────────────────────────────

describe('MessageService.sendMessage — side-effect best-effort semantics', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(activeUser(USER_A, 'customer', 'Alice') as never)
      .mockResolvedValueOnce(activeUser(USER_B, 'retailer', 'Bandhu') as never);
    vi.mocked(canChat).mockReturnValueOnce(true);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'msg-1' } as never);
  });

  it('socket emit + in-app notification are attempted after message.create', async () => {
    const emitSpy = vi.fn();
    vi.mocked(getIO).mockReturnValue({ to: vi.fn(() => ({ emit: emitSpy })) } as never);
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({ id: 'n1' } as never);

    await MessageService.sendMessage(USER_A, USER_B, 'hi');
    // newMessage emit twice (receiver + sender), newNotification once
    expect(emitSpy).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledOnce();
    const notifArgs = vi.mocked(prisma.notification.create).mock.calls[0][0] as any;
    expect(notifArgs.data.userId).toBe(USER_B);  // notif goes to RECEIVER
    expect(notifArgs.data.type).toBe('NEW_MESSAGE');
    expect(notifArgs.data.referenceId).toBe(USER_A);  // points back to sender
  });

  it('BEST-EFFORT: getIO() throwing does NOT abort the message create — message still returned', async () => {
    vi.mocked(getIO).mockImplementationOnce(() => { throw new Error('socket not initialised'); });

    // Message must still resolve even when socket setup fails.
    await expect(MessageService.sendMessage(USER_A, USER_B, 'hi')).resolves.toMatchObject({ id: 'msg-1' });
  });

  it('BEST-EFFORT: notification.create failure does NOT abort message create (try/catch wraps both)', async () => {
    vi.mocked(prisma.notification.create).mockRejectedValueOnce(new Error('DB down'));
    await expect(MessageService.sendMessage(USER_A, USER_B, 'hi')).resolves.toMatchObject({ id: 'msg-1' });
  });

  it('PUSH: sendPushToUser called with capped body text (>80 chars truncated to 77 + "...")', async () => {
    const longText = 'A'.repeat(120);
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({ id: 'n1' } as never);

    await MessageService.sendMessage(USER_A, USER_B, longText);
    expect(sendPushToUser).toHaveBeenCalledOnce();
    const [recvId, payload] = vi.mocked(sendPushToUser).mock.calls[0];
    expect(recvId).toBe(USER_B);
    expect((payload as any).body).toBe('A'.repeat(77) + '...');
    expect((payload as any).body.length).toBe(80);
    expect((payload as any).url).toBe(`/chat/${USER_A}`);
  });

  it('PUSH: body fallback "📷 Image" when message text is empty (image-only send)', async () => {
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({ id: 'n1' } as never);
    await MessageService.sendMessage(USER_A, USER_B, '', 'r2://a.jpg');
    const [, payload] = vi.mocked(sendPushToUser).mock.calls[0];
    expect((payload as any).body).toBe('📷 Image');
  });

  it('BEST-EFFORT (Rule B compliant — Session 88 S4): push send failure logs + Sentry-captures but does NOT propagate', async () => {
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({ id: 'n1' } as never);
    vi.mocked(sendPushToUser).mockRejectedValueOnce(new Error('push gateway down'));

    // The message resolves successfully even though push rejects.
    await expect(MessageService.sendMessage(USER_A, USER_B, 'hi')).resolves.toMatchObject({ id: 'msg-1' });

    // The .catch() chain runs asynchronously — give it a microtask tick to fire.
    await new Promise(resolve => setImmediate(resolve));
    const Sentry = await import('@sentry/node');
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('push title uses sender.name when present; "Naya message" fallback when sender.name is null', async () => {
    // mockReset() (NOT clearAllMocks) drains the queued mockResolvedValueOnce
    // returns inherited from the parent beforeEach — without it, the first
    // findUnique would pull the beforeEach's Alice (with `name: 'Alice'`)
    // and the null-name override below would never reach the service call.
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(canChat).mockReset();
    vi.mocked(prisma.message.create).mockReset();

    vi.mocked(getIO).mockReturnValue({ to: vi.fn(() => ({ emit: vi.fn() })) } as never);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ ...activeUser(USER_A, 'customer'), name: null } as never)
      .mockResolvedValueOnce(activeUser(USER_B) as never);
    vi.mocked(canChat).mockReturnValueOnce(true);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'm1' } as never);
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({ id: 'n1' } as never);

    await MessageService.sendMessage(USER_A, USER_B, 'hi');
    const [, payload] = vi.mocked(sendPushToUser).mock.calls[0];
    expect((payload as any).title).toBe('Naya message');
  });
});
