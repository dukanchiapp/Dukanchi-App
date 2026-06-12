import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Router } from 'express';

/**
 * Backend resilience suite — SC1 (bounded fuzzy-search vocabulary) +
 * C2 (rate-limiter fails OPEN when Redis is down). (fix/backend-resilience)
 *
 * No real DB / Redis (Rule F).
 */

const { TEST_JWT_SECRET } = vi.hoisted(() => ({
  TEST_JWT_SECRET: 'test-jwt-secret-32-chars-long-padding',
}));

// Needed by rate-limiter.middleware (env.NODE_ENV) + the config/redis import.
vi.mock('../config/env', () => ({
  env: { JWT_SECRET: TEST_JWT_SECRET, NODE_ENV: 'test', REDIS_URL: 'redis://localhost:6379' },
  getAllowedOrigins: () => ['http://localhost'],
  isNgrokOrigin: () => false,
}));

// pubClient mock. NOTE: sendCommand RESOLVES here — the C2 tests simulate the
// Redis outage at the Store level (via a throwing fake inner store passed to
// failOpen), which is the precise seam failOpen wraps. Making sendCommand
// resolve avoids a test-only dangling rejection: importing rate-limiter.middleware
// constructs the 4 real limiters, whose RedisStore.init preloads a Lua script
// via sendCommand; since no test ever calls .increment() on those four, that
// promise would never be awaited (in production, request traffic awaits it).
vi.mock('../config/redis', () => ({
  pubClient: {
    // Returns a sha string — RedisStore preloads its Lua scripts via SCRIPT
    // LOAD (expects a string reply) at construction for all 4 limiters. A
    // non-string reply throws "unexpected reply from redis client". No test
    // calls .increment() on the real limiters, so the sha value is otherwise
    // unused (the C2 outage is simulated via throwing fake inner stores).
    sendCommand: vi.fn().mockResolvedValue('test-script-sha'),
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

import rateLimit, { type Store, type ClientRateLimitInfo } from 'express-rate-limit';
import { failOpen } from '../middlewares/rate-limiter.middleware';
import { makeTestApp } from '../test-helpers/app-factory';
import { logger } from '../lib/logger';

// ── SC1: BOUNDED FUZZY-SEARCH VOCABULARY ─────────────────────────────────────
describe('resilience › SC1 fuzzy-search vocabulary is bounded', () => {
  beforeEach(() => {
    // Fresh module state per test (vocabulary=[], lastRefresh=0) so the
    // REFRESH_INTERVAL throttle never blocks a test. fuzzySearch has no module
    // imports (prisma is passed as an arg), so a clean dynamic import is safe.
    vi.resetModules();
  });

  it('caps vocabulary at MAX_VOCAB even with a ~60k-token catalog + applies `take`', async () => {
    const mod = await import('../services/fuzzySearch');

    // 10k products × ~6 unique tokens each → ~60k distinct tokens >> MAX_VOCAB.
    const bigProducts = Array.from({ length: 10000 }, (_, i) => ({
      productName: `alpha${i} beta${i} gamma${i}`,
      brand: `brand${i}`,
      category: `cat${i}`,
      description: null,
    }));
    const prisma = {
      product: { findMany: vi.fn().mockResolvedValue(bigProducts) },
      store: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await mod.refreshVocabulary(prisma);

    expect(mod.getVocabularySize()).toBeGreaterThan(0);
    expect(mod.getVocabularySize()).toBeLessThanOrEqual(mod.MAX_VOCAB);
    // Defensive read caps passed to Prisma (bounded DB read).
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: expect.any(Number) }),
    );
    expect(prisma.store.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: expect.any(Number) }),
    );
  });

  it('small catalog → vocabulary present and spell-correction still works', async () => {
    const mod = await import('../services/fuzzySearch');
    const prisma = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          { productName: 'samsung galaxy', brand: 'samsung', category: 'electronics', description: null },
        ]),
      },
      store: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await mod.refreshVocabulary(prisma);

    expect(mod.getVocabularySize()).toBeGreaterThan(0);
    expect(mod.getVocabularySize()).toBeLessThanOrEqual(mod.MAX_VOCAB);
    // "samsng" → "samsung" (Levenshtein 1) — the bounded vocab still corrects.
    const { corrected, didCorrect } = mod.correctSpelling('samsng');
    expect(corrected).toContain('samsung');
    expect(didCorrect).toBe(true);
  });
});

// ── C2: RATE-LIMITER FAILS OPEN ──────────────────────────────────────────────
describe('resilience › C2 rate-limiter failOpen wrapper (unit)', () => {
  beforeEach(() => vi.clearAllMocks());

  const fakeInner = (overrides: Partial<Store> = {}): Store =>
    ({
      init: vi.fn(),
      increment: vi.fn(),
      decrement: vi.fn(),
      resetKey: vi.fn(),
      resetAll: vi.fn(),
      ...overrides,
    }) as unknown as Store;

  it('passthrough: when the inner store succeeds, the real count flows through (limiting unchanged)', async () => {
    const resetTime = new Date('2026-01-01T00:00:00Z');
    const info: ClientRateLimitInfo = { totalHits: 7, resetTime };
    const inner = fakeInner({ increment: vi.fn().mockResolvedValue(info) });

    const store = failOpen(inner, 'rl:test:');
    const result = await store.increment('client-key');

    expect(result).toEqual({ totalHits: 7, resetTime });
    expect(logger.warn).not.toHaveBeenCalled(); // healthy path → no degradation log
  });

  it('fail-open: when the inner store throws, increment returns under-limit AND warns', async () => {
    const inner = fakeInner({
      increment: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    });

    const store = failOpen(inner, 'rl:test:');
    const result = await store.increment('client-key');

    // Request ALLOWED (totalHits 0 < any max).
    expect(result).toEqual({ totalHits: 0, resetTime: undefined });
    // Degradation is observable.
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ limiter: 'rl:test:', op: 'increment' }),
      expect.stringMatching(/failing open/i),
    );
  });

  it('fail-open: decrement / resetKey swallow errors (never throw)', async () => {
    const inner = fakeInner({
      decrement: vi.fn().mockRejectedValue(new Error('down')),
      resetKey: vi.fn().mockRejectedValue(new Error('down')),
    });
    const store = failOpen(inner, 'rl:test:');
    await expect(store.decrement('k')).resolves.toBeUndefined();
    await expect(store.resetKey('k')).resolves.toBeUndefined();
  });
});

describe('resilience › C2 rate-limiter fails open over HTTP (Redis down)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a limited route returns 200 (NOT 500) when the store throws (Redis unavailable)', async () => {
    // A limiter whose store always throws — exactly what makeRedisStore →
    // failOpen(RedisStore) degrades to during a Redis outage. WITHOUT failOpen,
    // express-rate-limit would call next(err) and the route would 500. We use a
    // throwing fake inner store (not the real RedisStore) to keep the assertion
    // deterministic and free of RedisStore's internal Lua-script retry noise.
    const throwingInner = {
      init: vi.fn(),
      increment: vi.fn().mockRejectedValue(new Error('Redis unavailable (test)')),
      decrement: vi.fn().mockResolvedValue(undefined),
      resetKey: vi.fn().mockResolvedValue(undefined),
      resetAll: vi.fn().mockResolvedValue(undefined),
    } as unknown as Store;

    const limiter = rateLimit({
      store: failOpen(throwingInner, 'rl:test:'),
      windowMs: 60 * 1000,
      max: 5,
      message: { error: 'Too many requests.' },
    });

    const router = Router();
    router.get('/ping', (_req, res) => res.json({ ok: true }));
    const app = makeTestApp({ middleware: [limiter], routes: { '/api': router } });

    const res = await request(app).get('/api/ping');

    expect(res.status).toBe(200); // allowed — fail-open, NOT a 500
    expect(res.body.ok).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ limiter: 'rl:test:' }),
      expect.stringMatching(/failing open/i),
    );
  });
});
