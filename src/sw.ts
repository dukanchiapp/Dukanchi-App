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
import { CacheFirst } from 'workbox-strategies';
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

// SPA navigation fallback — denylist mirrors the prior
// vite.config.ts `workbox.navigateFallbackDenylist` block. Paths that
// must never be served from the SPA's cached index.html:
//   - /admin-panel/* — separate Express-served admin SPA
//   - /api/*         — JSON API; never an HTML fallback
//   - /uploads/*     — static uploads served directly by Express
registerRoute(
  new NavigationRoute(
    async () => {
      const cached = await caches.match('/index.html');
      return cached ?? fetch('/index.html');
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
