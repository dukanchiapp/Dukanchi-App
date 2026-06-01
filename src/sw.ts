/// <reference lib="webworker" />
//
// Service Worker — ND-A1 fix (Session 102a).
//
// Migrated from the prior dual-SW state where:
//   - public/sw.js (hand-rolled) carried `push` + `notificationclick` handlers
//   - VitePWA `generateSW` overwrote public/sw.js at build with a Workbox SW
//     that had NO push handler → web push silently DEAD in production
//
// This file is now the single source of truth, compiled by VitePWA in
// `injectManifest` mode. It exports nothing — side-effect only — and
// Workbox's build-time placeholder `self.__WB_MANIFEST` is substituted
// with the precache manifest before the file is emitted to dist/sw.js.
//
// Push handlers below are ported VERBATIM (logic only — types adapted)
// from the original public/sw.js so PWA push delivery behaviour is
// identical to the dead-but-correct pre-migration code.
//
// Native Capacitor / FCM pathway is UNAFFECTED — it uses
// @capacitor/push-notifications + native intents, not this SW.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Take control immediately on first install + on every new SW version.
// Matches the prior hand-rolled SW's `skipWaiting()` + `clients.claim()`
// behaviour (public/sw.js install + activate listeners).
self.skipWaiting();
clientsClaim();

// Evict the legacy `dukanchi-v11` cache (and any other older caches) on
// first activation of this SW. Replaces the manual `caches.keys()` loop
// from the prior public/sw.js activate handler.
cleanupOutdatedCaches();

// Precache build assets — VitePWA injectManifest replaces __WB_MANIFEST
// at build time with the actual content-hash-revisioned asset list.
precacheAndRoute(self.__WB_MANIFEST);

// ── Navigation strategy — NETWORK-FIRST (Session 128.25) ────────────────
//
// Previously this was CACHE-FIRST: every navigation returned a cached
// /index.html, so the server's `app.get('/')` (which routes expired-cookie
// visitors to landing.html per v76) was NEVER consulted on returning visits.
// That defeated the entire expired-cookie→landing fix for any user whose
// browser already had this SW installed.
//
// Now: try the network first (3s timeout) so the server's routing wins
// while the user is online. Cache successful navigations in `dk-navigation`
// (7-day expiration, 20 entries) for offline fallback. If both the network
// AND the runtime cache miss, fall back to the precached SPA shell
// `/index.html` so a fully-offline visit still renders something — that's
// the SAME shell the pre-fix cache-first path served, so offline UX is
// unchanged.
//
// Denylist preserves the pre-fix list: admin panel, JSON API, uploads.
const navHandler = new NetworkFirst({
  cacheName: 'dk-navigation',
  networkTimeoutSeconds: 3,
  plugins: [
    new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 }),
  ],
});

registerRoute(
  new NavigationRoute(
    async (params) => {
      try {
        return await navHandler.handle(params);
      } catch (err) {
        // Network down AND no runtime cache hit. Fall back to the precached
        // SPA shell so the offline experience still renders.
        const cached = await caches.match('/index.html');
        if (cached) return cached;
        // Last resort: re-throw → browser shows native offline error.
        throw err;
      }
    },
    {
      denylist: [/^\/admin-panel(\/|$)/, /^\/api\//, /^\/uploads\//],
    },
  ),
);

// Google Fonts CSS — CacheFirst, 365 days, 10 entries.
// Port of the prior `runtimeCaching` entry for fonts.googleapis.com.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// Google Fonts WOFF2 files — CacheFirst, 365 days, 10 entries.
// Port of the prior `runtimeCaching` entry for fonts.gstatic.com.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// ── PUSH HANDLERS — verbatim port from public/sw.js:59-78 ──────────────
//
// Original logic preserved exactly (only TS adaptations). showNotification
// options (title default 'Dukanchi', body, icon, badge, data) are
// identical. The try/catch around event.data.json() handles malformed
// payloads silently per the prior contract.
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Dukanchi', {
        body: data.body || '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: data.data || {},
      }),
    );
  } catch (e) {
    /* swallow malformed JSON — matches prior public/sw.js behaviour */
  }
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
