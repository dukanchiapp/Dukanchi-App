import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * Role-isolation suite — CHAT PERMISSION MATRIX. (test/role-isolation-matrix)
 *
 * The chat matrix is BOTH a core business rule and a security boundary.
 * These tests encode the INTENDED SPEC, not whatever the code happens to
 * return — a spec assertion that fails would mean a real isolation leak.
 *
 * Two layers:
 *   1. `canChat` (auth.middleware) — the pure function that IS the rule.
 *      Asserted exhaustively across every role pair, BOTH directions
 *      (initiator matters: supplier→customer AND customer→supplier must
 *      both be denied). This is the authoritative spec encoding.
 *   2. POST /api/messages 403 wiring — proves the controller maps the
 *      service's "Chat not permitted between these roles" throw → HTTP 403
 *      (mirrors messages.routes.test.ts which stubs MessageService; the
 *      real send path's socket/push/notification deps are out of scope and
 *      already covered by the canChat unit for the rule itself).
 *
 * Spec matrix (from the task):
 *   customer ↔ retailer                         : ALLOWED
 *   customer ↔ {supplier,brand,manufacturer}    : DENIED
 *   retailer ↔ {customer,supplier,brand,manufact}: ALLOWED
 *   {supplier,brand,manufacturer} ↔ each + retailer : ALLOWED
 *   {supplier,brand,manufacturer} ↔ customer    : DENIED
 *   admin ↔ anyone (via this fn)                : DENIED (admin chat uses other flows)
 *
 * No real DB / Redis / socket (Rule F).
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
    teamMember: { findUnique: vi.fn() },
    message: { findMany: vi.fn(), create: vi.fn() },
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

vi.mock('../middlewares/rate-limiter.middleware', () => ({
  messageLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  generalLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Stub MessageService so the 403-wiring test exercises ONLY the controller's
// error→status mapping (the real send path's socket/push/notification deps
// are out of scope; the rule itself is covered by the canChat unit below).
vi.mock('../modules/messages/message.service', () => ({
  MessageService: {
    getMessages: vi.fn(),
    getConversations: vi.fn(),
    sendMessage: vi.fn(),
  },
  ChatRejectionError: class ChatRejectionError extends Error {
    subject: string;
    reason: string;
    constructor(subject: string, reason: string) {
      super('chat rejection');
      this.subject = subject;
      this.reason = reason;
    }
  },
}));

import { canChat } from '../middlewares/auth.middleware';
import { messageRoutes } from '../modules/messages/message.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';
import { MessageService } from '../modules/messages/message.service';

type Role = 'customer' | 'retailer' | 'supplier' | 'brand' | 'manufacturer' | 'admin';
const ALL_ROLES: Role[] = ['customer', 'retailer', 'supplier', 'brand', 'manufacturer', 'admin'];
const B2B: Role[] = ['retailer', 'supplier', 'brand', 'manufacturer'];

/**
 * Reference implementation of the INTENDED spec — deliberately written
 * independently of the production code so the test can't "agree with a bug".
 * If production `canChat` diverges from this, a test fails → leak/regression.
 */
function specAllowsChat(a: Role, b: Role): boolean {
  if (a === 'customer') return b === 'retailer';
  if (b === 'customer') return a === 'retailer';
  return B2B.includes(a) && B2B.includes(b);
}

describe('role-isolation › chat permission matrix (canChat pure fn)', () => {
  // Exhaustive: every ordered pair (initiator, recipient) — both directions.
  for (const a of ALL_ROLES) {
    for (const b of ALL_ROLES) {
      const expected = specAllowsChat(a, b);
      it(`${a} → ${b} : ${expected ? 'ALLOWED' : 'DENIED'}`, () => {
        expect(canChat(a, b)).toBe(expected);
      });
    }
  }
});

describe('role-isolation › chat matrix — named spec cases', () => {
  it('customer ↔ retailer: ALLOWED both directions', () => {
    expect(canChat('customer', 'retailer')).toBe(true);
    expect(canChat('retailer', 'customer')).toBe(true);
  });

  it('customer ↔ supplier/brand/manufacturer: DENIED both directions', () => {
    for (const r of ['supplier', 'brand', 'manufacturer'] as Role[]) {
      expect(canChat('customer', r)).toBe(false); // customer initiates
      expect(canChat(r, 'customer')).toBe(false); // B2B initiates → still denied
    }
  });

  it('retailer ↔ supplier/brand/manufacturer: ALLOWED both directions', () => {
    for (const r of ['supplier', 'brand', 'manufacturer'] as Role[]) {
      expect(canChat('retailer', r)).toBe(true);
      expect(canChat(r, 'retailer')).toBe(true);
    }
  });

  it('supplier/brand/manufacturer ↔ each other: ALLOWED', () => {
    const b2bOnly: Role[] = ['supplier', 'brand', 'manufacturer'];
    for (const a of b2bOnly) {
      for (const b of b2bOnly) {
        expect(canChat(a, b)).toBe(true);
      }
    }
  });

  it('admin cannot chat with anyone via canChat (admin uses other flows)', () => {
    for (const r of ALL_ROLES) {
      expect(canChat('admin', r)).toBe(false);
      expect(canChat(r, 'admin')).toBe(false);
    }
  });
});

describe('role-isolation › chat 403 wiring (POST /api/messages)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // authenticateToken loads the sender for its availability check → return
    // an available user so auth passes and the request reaches the controller.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeTestUser({ role: 'customer' }) as never,
    );
  });

  const buildApp = () => makeTestApp({ routes: { '/api/messages': messageRoutes } });
  const jwtFor = (role: Role) =>
    signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role });
  const RECEIVER = '12345678-1234-4234-8234-123456789099';

  it('POST /api/messages → 403 when the service throws "Chat not permitted between these roles"', async () => {
    vi.mocked(MessageService.sendMessage).mockRejectedValue(
      new Error('Chat not permitted between these roles'),
    );

    const res = await request(buildApp())
      .post('/api/messages')
      .set('Cookie', `dk_token=${jwtFor('customer')}`)
      .send({ receiverId: RECEIVER, message: 'hi' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/chat not permitted/i);
  });

  it('POST /api/messages → 403 wiring holds regardless of initiator role (supplier initiator)', async () => {
    vi.mocked(MessageService.sendMessage).mockRejectedValue(
      new Error('Chat not permitted between these roles'),
    );

    const res = await request(buildApp())
      .post('/api/messages')
      .set('Cookie', `dk_token=${jwtFor('supplier')}`)
      .send({ receiverId: RECEIVER, message: 'hi' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/chat not permitted/i);
  });
});
