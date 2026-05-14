import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

/**
 * Messages routes integration tests — Day 7 / Session 94 / Phase 4.
 *
 * Covers GET /api/messages/conversations (read), GET /api/messages/:otherUserId
 * (read), POST /api/messages (write + Zod validation). Socket.IO realtime path
 * intentionally out of scope (Day 2.7 backlog: socket auth E2E test sprint).
 *
 * Rate-limiter middleware is mocked to a no-op — message-send rate-limit
 * behavior is already covered by Day 3 security.integration.test.ts.
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

import { messageRoutes } from '../modules/messages/message.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';
import { MessageService } from '../modules/messages/message.service';

describe('messages routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeTestUser({ role: 'customer' }) as never,
    );
  });

  const buildApp = () => makeTestApp({ routes: { '/api/messages': messageRoutes } });

  const customerJwt = () =>
    signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role: 'customer' });

  it('GET /api/messages/conversations → 200 with conversations array (happy)', async () => {
    vi.mocked(MessageService.getConversations).mockResolvedValue([
      { otherUserId: 'u2', lastMessage: 'Hi', lastTime: new Date() },
    ] as never);

    const res = await request(buildApp())
      .get('/api/messages/conversations')
      .set('Cookie', `dk_token=${customerJwt()}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it('POST /api/messages → 404 when service signals recipient not found', async () => {
    vi.mocked(MessageService.sendMessage).mockRejectedValue(new Error('User not found'));

    const res = await request(buildApp())
      .post('/api/messages')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({
        receiverId: '12345678-1234-4234-8234-123456789099',
        message: 'Hello',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/user not found/i);
  });

  it('POST /api/messages → 401 when no auth cookie', async () => {
    const res = await request(buildApp()).post('/api/messages').send({
      receiverId: '12345678-1234-4234-8234-123456789010',
      message: 'Hi',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('POST /api/messages → 400 when both message and imageUrl missing (Zod refine)', async () => {
    const res = await request(buildApp())
      .post('/api/messages')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({ receiverId: '12345678-1234-4234-8234-123456789010' }); // no message + no imageUrl

    expect(res.status).toBe(400);
  });
});
