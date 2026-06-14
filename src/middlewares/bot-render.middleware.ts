import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { LRUCache } from 'lru-cache';
import { prisma } from '../config/prisma';
import { logger } from '../lib/logger';
import {
  buildBaseHtml,
  landingMeta,
  searchMeta,
  mapMeta,
  legalMeta,
  storeMeta,
  storeNotFoundMeta,
} from '../lib/seo-html';
import { isBotOrUnfurler } from './bot-detect.middleware';

/**
 * Session 128.40 — bot-rendering middleware.
 *
 * For each public route, intercept requests from documented crawlers / link
 * unfurlers (see bot-detect.middleware.ts) and serve a static HTML doc with
 * route-specific meta + LD-JSON. Real-user requests fall through to the SPA
 * via `next()` — zero behaviour change for them.
 *
 * NOT mounted on /signup, /login, /profile, /messages, /chat/*,
 * /retailer/dashboard, /settings, /support, /admin-panel/* — auth + admin
 * routes are not for crawlers.
 *
 * Cache (Phase 4): the /store/:id handler keeps the rendered HTML in an
 * in-memory LRU keyed by storeId, 5-min TTL, 500-entry cap. Invalidated by
 * StoreService.updateStore via botRenderCache.delete().
 *
 * Cache-Control: public, max-age=300 — short enough that store edits land
 * for the next viral share within 5 min, long enough to soak the spike when
 * one share fans out to thousands of unfurlers in a few seconds.
 */

const CACHE_MAX_AGE_SECONDS = 300;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

// Exported so StoreService can invalidate on write. Bounded by entries+TTL —
// failOpen-style: if the cache misbehaves, the worst case is one extra DB hit
// per store-render. NOT exported for arbitrary mutation; callers SHOULD use
// the `invalidateStoreBotCache(storeId)` helper below.
const botRenderCache = new LRUCache<string, string>({
  max: CACHE_MAX_ENTRIES,
  ttl: CACHE_TTL_MS,
});

/**
 * Call after any write that mutates a store's user-visible fields. Wired
 * from StoreService.updateStore + AdminService bulkImport-update path so the
 * bot HTML re-renders within one request after a content change.
 */
export function invalidateStoreBotCache(storeId: string): void {
  if (botRenderCache.has(storeId)) {
    botRenderCache.delete(storeId);
    logger.info({ storeId }, '[BOT_RENDER] cache invalidated');
  }
}

/** Test/debug only. NOT for production. */
export function _resetBotRenderCacheForTests(): void {
  botRenderCache.clear();
}

function send(res: Response, html: string, status = 200) {
  res
    .status(status)
    .type('html')
    .set('cache-control', `public, max-age=${CACHE_MAX_AGE_SECONDS}`)
    .send(html);
}

// ── Static-meta handlers (landing / search / map / legal) ──

function makeStaticHandler(metaFn: () => ReturnType<typeof landingMeta>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isBotOrUnfurler(req)) return next();
    const meta = metaFn();
    const html = buildBaseHtml({
      title: meta.title,
      description: meta.description,
      canonical: meta.canonical,
      image: meta.image,
      type: meta.type,
      ldJson: meta.ldJson,
    });
    return send(res, html);
  };
}

export const botRenderLanding: RequestHandler = makeStaticHandler(landingMeta);
export const botRenderSearch: RequestHandler = makeStaticHandler(searchMeta);
export const botRenderMap: RequestHandler = makeStaticHandler(mapMeta);

// ── Legal: 5 slugs, one shared handler. ──
export const botRenderLegal: RequestHandler = (req, res, next) => {
  if (!isBotOrUnfurler(req)) return next();
  const slug = String(req.params.slug ?? '');
  const meta = legalMeta(slug);
  if (!meta) return next(); // Unknown slug — let the SPA handle the 404 path
  const html = buildBaseHtml({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    image: meta.image,
    type: meta.type,
    ldJson: meta.ldJson,
  });
  return send(res, html);
};

// ── /store/:id — dynamic, cached. ──
export const botRenderStore: RequestHandler = async (req, res, next) => {
  if (!isBotOrUnfurler(req)) return next();

  const id = String(req.params.id ?? '').trim();
  if (!id) return next();

  // Cache HIT — serve immediately. Log at debug-level so prod isn't noisy
  // but the line is visible during the smoke (info-level grep below).
  const cached = botRenderCache.get(id);
  if (cached) {
    logger.info({ storeId: id }, '[BOT_RENDER] cache HIT');
    return send(res, cached);
  }

  // Cache MISS — lean read-only query. Only the fields seo-html.ts uses.
  let store;
  try {
    store = await prisma.store.findUnique({
      where: { id },
      select: {
        id: true,
        storeName: true,
        description: true,
        category: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        phone: true,
        phoneVisible: true,
        latitude: true,
        longitude: true,
        logoUrl: true,
        coverUrl: true,
        averageRating: true,
        reviewCount: true,
      },
    });
  } catch (err) {
    logger.warn({ err, storeId: id }, '[BOT_RENDER] store lookup failed — serving 404 fallback');
    const meta = storeNotFoundMeta(id);
    const html = buildBaseHtml({
      title: meta.title,
      description: meta.description,
      canonical: meta.canonical,
      type: meta.type,
    });
    return send(res, html, 404);
  }

  if (!store) {
    const meta = storeNotFoundMeta(id);
    const html = buildBaseHtml({
      title: meta.title,
      description: meta.description,
      canonical: meta.canonical,
      type: meta.type,
    });
    return send(res, html, 404);
  }

  const image = store.coverUrl ?? store.logoUrl ?? undefined;
  const meta = storeMeta({ ...store, image });
  const html = buildBaseHtml({
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    image: meta.image,
    type: meta.type,
    ldJson: meta.ldJson,
  });
  botRenderCache.set(id, html);
  logger.info({ storeId: id }, '[BOT_RENDER] cache MISS — rendered + cached');
  return send(res, html);
};
