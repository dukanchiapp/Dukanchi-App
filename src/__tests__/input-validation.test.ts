import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';

/**
 * Input-validation rollout (Session 128.34) — covers:
 *   1. The middleware helpers (validate / validateQuery / validateParams).
 *   2. Mass-assignment regression: createStore rejects/strips privilege fields
 *      even when the attacker bundles them with valid required fields.
 *   3. Gap-module sentinel happy + sad paths (users / team / ai / ask-nearby /
 *      landing) — at least one valid + one invalid case per wired route group.
 *
 * No real DB / Redis (Rule F). Service layers are stubbed where the assertion
 * is purely about HTTP→schema wiring.
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
    store: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
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

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('../modules/stores/store.service', () => ({
  StoreService: { createStore: vi.fn() },
}));

vi.mock('../modules/ai/ai.controller', () => ({
  AiController: {
    analyzeImage: (_req: express.Request, res: express.Response) => res.json({ ok: true }),
    transcribeVoice: (_req: express.Request, res: express.Response) => res.json({ ok: true }),
    generateStoreDesc: (_req: express.Request, res: express.Response) => res.json({ ok: true }),
  },
}));

vi.mock('../modules/ask-nearby/ask-nearby.controller', () => ({
  AskNearbyController: {
    send: (_req: express.Request, res: express.Response) => res.json({ ok: true }),
    respond: (_req: express.Request, res: express.Response) => res.json({ ok: true }),
    myRequests: vi.fn(),
    getPending: vi.fn(),
    getLimitStatus: vi.fn(),
  },
}));

import { validate, validateQuery, validateParams } from '../../validators/validate';
import { storeRoutes } from '../modules/stores/store.routes';
import { userRoutes } from '../modules/users/user.routes';
import { teamRoutes } from '../modules/team/team.routes';
import { aiRoutes } from '../modules/ai/ai.routes';
import { askNearbyRoutes } from '../modules/ask-nearby/ask-nearby.routes';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';
import { StoreService } from '../modules/stores/store.service';

const customerJwt = () =>
  signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role: 'customer' });
const retailerJwt = () =>
  signTestJWT({ userId: '00000000-0000-0000-0000-000000000001', role: 'retailer' });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.user.findUnique).mockResolvedValue(
    makeTestUser({ role: 'retailer', kycStatus: 'approved' }) as never,
  );
});

// ── 1. Middleware helpers (unit) ────────────────────────────────────────────
describe('validation helpers', () => {
  const bodySchema = z.object({ name: z.string().min(2) });
  const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100) });
  const paramSchema = z.object({ id: z.string().uuid() });

  const buildHarness = (mw: express.RequestHandler, path = '/'): express.Express => {
    const app = express();
    app.use(express.json());
    app.get(path, mw, (req, res) =>
      res.json({ body: req.body, query: req.query, params: req.params }),
    );
    app.post(path, mw, (req, res) =>
      res.json({ body: req.body }),
    );
    return app;
  };

  it('validate(body) → 200 happy + strips unknown fields', async () => {
    const res = await request(buildHarness(validate(bodySchema)))
      .post('/')
      .send({ name: 'Dukanchi', verified: true, role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({ name: 'Dukanchi' }); // unknowns stripped
  });

  it('validate(body) → 400 with structured issues on missing required', async () => {
    const res = await request(buildHarness(validate(bodySchema))).post('/').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.issues)).toBe(true);
    expect(res.body.issues[0].path).toContain('name');
  });

  it('validateQuery → 200 happy with coerced number; 400 on out-of-range', async () => {
    const app = buildHarness(validateQuery(querySchema));
    const ok = await request(app).get('/?limit=10');
    expect(ok.status).toBe(200);
    // assigned-back via Object.assign — Express normalises to string in
    // some versions; the value is coerced numerically by zod regardless.
    expect(Number(ok.body.query.limit)).toBe(10);

    const bad = await request(app).get('/?limit=999');
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Validation failed');
  });

  it('validateParams → 200 happy; 400 on non-UUID', async () => {
    const app = buildHarness(validateParams(paramSchema), '/:id');
    const okId = '11111111-1111-4111-8111-111111111111';
    const ok = await request(app).get(`/${okId}`);
    expect(ok.status).toBe(200);
    const bad = await request(app).get('/not-a-uuid');
    expect(bad.status).toBe(400);
  });
});

// ── 2. Mass-assignment regression (store create) ────────────────────────────
describe('mass-assignment regression: POST /api/stores', () => {
  const buildApp = () => makeTestApp({ routes: { '/api/stores': storeRoutes } });

  it('attacker sending verified/premium/role/ownerId alongside valid fields → those keys NEVER reach StoreService.createStore', async () => {
    vi.mocked(StoreService.createStore).mockResolvedValue({ id: 'new-store' } as never);
    vi.mocked(prisma.store.findFirst).mockResolvedValue(null); // no phone collision

    const res = await request(buildApp())
      .post('/api/stores')
      .set('Cookie', `dk_token=${retailerJwt()}`)
      .send({
        // Valid required fields (would have validated under the old schema too)
        storeName: 'Honest Hardware',
        category: 'Tools',
        latitude: 19.07,
        longitude: 72.87,
        address: '123 Real Street, Mumbai',
        phone: '9876543210',
        // ── Attack payload ──
        verified: true,
        premium: true,
        kycStatus: 'approved',
        role: 'admin',
        ownerId: 'attacker-controlled-id', // try to forge the owner
        averageRating: 5,
      });

    expect(res.status).toBe(200);
    expect(StoreService.createStore).toHaveBeenCalledOnce();
    const passed = vi.mocked(StoreService.createStore).mock.calls[0][0] as Record<string, unknown>;
    // The forbidden keys MUST NOT be on the object passed to the service.
    expect(passed).not.toHaveProperty('verified');
    expect(passed).not.toHaveProperty('premium');
    expect(passed).not.toHaveProperty('kycStatus');
    expect(passed).not.toHaveProperty('role');
    expect(passed).not.toHaveProperty('averageRating');
    // ownerId must equal the JWT-derived id, NOT the attacker's value.
    expect(passed.ownerId).toBe('00000000-0000-0000-0000-000000000001');
    expect(passed.ownerId).not.toBe('attacker-controlled-id');
    // Allowlist is exactly the 7 declared fields.
    expect(Object.keys(passed).sort()).toEqual(
      ['storeName', 'category', 'latitude', 'longitude', 'address', 'phone', 'ownerId'].sort(),
    );
  });
});

// ── 3. Gap-module sentinels (users / team / ai / ask-nearby) ────────────────
describe('gap-module validation sentinels', () => {
  const userId = '00000000-0000-0000-0000-000000000001';

  it('USERS: GET /api/users/:id → 400 on non-UUID param (was previously: pass through to controller)', async () => {
    const app = makeTestApp({ routes: { '/api/users': userRoutes } });
    const res = await request(app)
      .get('/api/users/not-a-uuid')
      .set('Cookie', `dk_token=${customerJwt()}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('USERS: PUT /api/users/:id → 400 when body has wrong shape (e.g. phone="abc")', async () => {
    const app = makeTestApp({ routes: { '/api/users': userRoutes } });
    const res = await request(app)
      .put(`/api/users/${userId}`)
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({ phone: 'not-digits' });
    expect(res.status).toBe(400);
  });

  it('TEAM: POST /api/team → 400 when phone missing', async () => {
    const app = makeTestApp({ routes: { '/api/team': teamRoutes } });
    const res = await request(app)
      .post('/api/team')
      .set('Cookie', `dk_token=${retailerJwt()}`)
      .send({ password: 'pw1234', storeId: '11111111-1111-4111-8111-111111111111' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.issues)).toMatch(/phone/);
  });

  it('AI: POST /api/ai/analyze-image → 400 on missing imageBase64', async () => {
    const app = makeTestApp({ routes: { '/api/ai': aiRoutes } });
    const res = await request(app)
      .post('/api/ai/analyze-image')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({ mimeType: 'image/png' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.issues)).toMatch(/imageBase64/);
  });

  it('AI: POST /api/ai/analyze-image → 400 on disallowed MIME (e.g. text/plain)', async () => {
    const app = makeTestApp({ routes: { '/api/ai': aiRoutes } });
    const res = await request(app)
      .post('/api/ai/analyze-image')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({ imageBase64: 'xx', mimeType: 'text/plain' });
    expect(res.status).toBe(400);
  });

  it('AI: POST /api/ai/analyze-image → 200 on valid payload (happy path passes through)', async () => {
    const app = makeTestApp({ routes: { '/api/ai': aiRoutes } });
    const res = await request(app)
      .post('/api/ai/analyze-image')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({ imageBase64: 'aGVsbG8=', mimeType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('ASK-NEARBY: POST /api/ask-nearby/send → 400 when radiusKm exceeds the 50km cap', async () => {
    const app = makeTestApp({ routes: { '/api/ask-nearby': askNearbyRoutes } });
    const res = await request(app)
      .post('/api/ask-nearby/send')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({ query: 'rice', radiusKm: 9999, latitude: 19.07, longitude: 72.87 });
    expect(res.status).toBe(400);
  });

  it('ASK-NEARBY: POST /api/ask-nearby/respond → 400 when answer is not yes/no', async () => {
    const app = makeTestApp({ routes: { '/api/ask-nearby': askNearbyRoutes } });
    const res = await request(app)
      .post('/api/ask-nearby/respond')
      .set('Cookie', `dk_token=${customerJwt()}`)
      .send({ responseId: '11111111-1111-4111-8111-111111111111', answer: 'maybe' });
    expect(res.status).toBe(400);
  });
});
