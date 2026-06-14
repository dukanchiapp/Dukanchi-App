import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

/**
 * Session 128.40 — bot-render integration + LD-JSON parity test.
 *
 * Covers:
 *  - WhatsApp UA hitting GET /store/:id → response is the bot HTML containing
 *    the store name + LD-JSON LocalBusiness payload.
 *  - Chrome UA hitting the same path → middleware calls next() → SPA stub
 *    handler fires (proves the fall-through contract).
 *  - LD-JSON parity: phoneVisible=false → telephone is NOT present in the
 *    rendered payload. phoneVisible=true → telephone IS present.
 *  - Cache: second WhatsApp request for the same store ID does NOT hit the
 *    Prisma mock (cache HIT).
 *  - invalidateStoreBotCache: after invalidation, the next request DOES hit
 *    Prisma again (cache MISS → re-render).
 */

vi.mock('../config/prisma', () => ({
  prisma: {
    store: { findUnique: vi.fn() },
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: { get: vi.fn(), set: vi.fn(), del: vi.fn(), on: vi.fn() },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { prisma } from '../config/prisma';
import {
  botRenderStore,
  invalidateStoreBotCache,
  _resetBotRenderCacheForTests,
} from '../middlewares/bot-render.middleware';
import { buildStoreLdJson, type SeoStore } from '../lib/seo-html';

function buildApp(): express.Express {
  const app = express();
  app.get('/store/:id', botRenderStore, (_req, res) => {
    // Fall-through stub — proves non-bot UAs reach the SPA path.
    res.type('html').send('<html><body data-marker="spa-fallthrough">SPA shell</body></html>');
  });
  return app;
}

const STORE_ID = 'a1b2c3d4-aaaa-bbbb-cccc-d1d2d3d4d5d6';

const baseStore = {
  id: STORE_ID,
  storeName: 'Honest Hardware',
  description: 'Tools, fasteners, and contractor supplies in Bandra West.',
  category: 'Tools',
  address: '123 Linking Road, Bandra West',
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400050',
  phone: '+919876543210',
  phoneVisible: true,
  latitude: 19.0596,
  longitude: 72.8295,
  logoUrl: 'https://r2.example/logo.jpg',
  coverUrl: 'https://r2.example/cover.jpg',
  averageRating: 4.6,
  reviewCount: 23,
};

beforeEach(() => {
  vi.clearAllMocks();
  _resetBotRenderCacheForTests();
});

// ── 1. WhatsApp UA → bot HTML ──────────────────────────────────────────────
describe('GET /store/:id with WhatsApp UA', () => {
  it('returns HTML containing store name + LocalBusiness LD-JSON', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce(baseStore as never);
    const res = await request(buildApp())
      .get(`/store/${STORE_ID}`)
      .set('User-Agent', 'WhatsApp/2.23.20.0');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toMatch(/max-age=300/);
    expect(res.text).toContain('Honest Hardware');
    expect(res.text).toContain('"@type":"LocalBusiness"');
    expect(res.text).toContain('"telephone":"+919876543210"');
    expect(res.text).toContain('<link rel="canonical" href="https://dukanchi.com/store/');
  });

  it('returns 404 + fallback HTML when the store does not exist', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce(null as never);
    const res = await request(buildApp())
      .get(`/store/${STORE_ID}`)
      .set('User-Agent', 'WhatsApp/2.23.20.0');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Store not found');
    // Crawler still gets a real meta block + canonical, NOT a 500 page.
    expect(res.text).toContain('<link rel="canonical"');
  });
});

// ── 2. Chrome UA → fall-through to SPA stub ────────────────────────────────
describe('GET /store/:id with Chrome UA', () => {
  it('does NOT call Prisma + falls through to the SPA stub', async () => {
    const res = await request(buildApp())
      .get(`/store/${STORE_ID}`)
      .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36');
    expect(res.status).toBe(200);
    expect(res.text).toContain('data-marker="spa-fallthrough"');
    expect(prisma.store.findUnique).not.toHaveBeenCalled();
  });
});

// ── 3. Cache HIT after first MISS ──────────────────────────────────────────
describe('Cache behaviour for /store/:id', () => {
  it('second WhatsApp request does NOT re-call Prisma (cache HIT)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce(baseStore as never);
    const ua = 'WhatsApp/2.23.20.0';
    await request(buildApp()).get(`/store/${STORE_ID}`).set('User-Agent', ua);
    await request(buildApp()).get(`/store/${STORE_ID}`).set('User-Agent', ua);
    expect(prisma.store.findUnique).toHaveBeenCalledOnce();
  });

  it('invalidateStoreBotCache forces a fresh Prisma read on the next request', async () => {
    vi.mocked(prisma.store.findUnique)
      .mockResolvedValueOnce(baseStore as never)
      .mockResolvedValueOnce({ ...baseStore, storeName: 'Updated Name' } as never);
    const ua = 'WhatsApp/2.23.20.0';
    const first = await request(buildApp()).get(`/store/${STORE_ID}`).set('User-Agent', ua);
    expect(first.text).toContain('Honest Hardware');

    invalidateStoreBotCache(STORE_ID);

    const second = await request(buildApp()).get(`/store/${STORE_ID}`).set('User-Agent', ua);
    expect(second.text).toContain('Updated Name');
    expect(prisma.store.findUnique).toHaveBeenCalledTimes(2);
  });
});

// ── 4. LD-JSON parity — phoneVisible gate ──────────────────────────────────
describe('buildStoreLdJson — PII discipline', () => {
  it('emits telephone when phoneVisible is true (default)', () => {
    const ld = buildStoreLdJson(baseStore as SeoStore);
    expect(ld.telephone).toBe('+919876543210');
  });

  it('OMITS telephone when phoneVisible is false', () => {
    const ld = buildStoreLdJson({ ...baseStore, phoneVisible: false } as SeoStore);
    expect(ld.telephone).toBeUndefined();
  });

  it('emits aggregateRating only when reviewCount >= 5', () => {
    const high = buildStoreLdJson(baseStore as SeoStore);
    expect(high.aggregateRating).toBeDefined();

    const low = buildStoreLdJson({ ...baseStore, reviewCount: 4 } as SeoStore);
    expect(low.aggregateRating).toBeUndefined();
  });

  it('never emits owner identity (no name/ownerId in payload regardless of input)', () => {
    const ld = buildStoreLdJson(baseStore as SeoStore);
    const flat = JSON.stringify(ld);
    expect(flat).not.toMatch(/owner/i);
    expect(flat).not.toMatch(/ownerId/);
  });

  it('falls back to the brand icon for .webp store images (WhatsApp unfurler safety)', () => {
    const ld = buildStoreLdJson({ ...baseStore, image: 'https://r2.example/cover.webp' } as SeoStore);
    expect(ld.image).toBe('https://dukanchi.com/icons/icon-512x512.png');
  });
});
