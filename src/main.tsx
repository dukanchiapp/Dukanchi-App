// Observability inits — Day 4 / Session 90.
// Both gracefully no-op when their respective env vars (VITE_SENTRY_DSN,
// VITE_POSTHOG_KEY) are unset. Imported FIRST so they're ready before
// any React component runs (Sentry instruments React errors via its
// integration registration, which needs to happen pre-render).
import { initFrontendSentry } from './lib/sentry-frontend';
import { initPostHog } from './lib/posthog';
initFrontendSentry();
initPostHog();

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Futuristic v2 design tokens (--f-* namespace, glass primitives, animations).
// Additive — consumed by the futuristic redesign screens; no effect on
// existing screens until they adopt the --f-* system.
import './futuristic.css';
// Bright Skin (Session 128.13) — drop-in component classes + animations.
// Loaded LAST so its :root + [data-theme="yellow"] block overrides any earlier
// --b-* values from futuristic.css. <html data-theme="yellow"> activates the
// yellow theme. See dukanchi-bright-skin/IMPLEMENT.md for the source of truth.
import './bright-skin.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  const isProduction = import.meta.env.PROD;
  const isNgrok = window.location.hostname.includes('.ngrok-free.dev') ||
    window.location.hostname.includes('.ngrok.io') ||
    window.location.hostname.includes('.ngrok.app');

  // Register SW in production OR when accessed via ngrok (HTTPS)
  // Skip in localhost dev to avoid cache issues
  if (isProduction || isNgrok) {
    // Session 128.25 — autoUpdate flow. Snapshot whether a controller exists
    // BEFORE registering. If yes, a subsequent controllerchange means a NEW
    // SW activated (returning visitor + new deploy) — reload to pick up the
    // fresh bundle. If no controller at load (first install ever), the page
    // is already on the latest bundle — no reload needed. Pairs with sw.ts's
    // self.skipWaiting() + clientsClaim() so new SW activates promptly
    // without devtools/manual cache clear.
    const hadControllerOnLoad = !!navigator.serviceWorker.controller;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.log('SW registration failed:', err));
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      // First install (no prior controller) — page already on latest bundle.
      if (!hadControllerOnLoad) return;
      refreshing = true;
      window.location.reload();
    });

    // Session 128.26 — Auto-update on resume.
    // The browser doesn't automatically check for new SW versions if the app
    // stays alive in the background (unless a navigation occurs). By explicitly
    // calling update() when the app comes back to the foreground, the browser
    // fetches sw.js. If it changed, skipWaiting() takes over and the
    // controllerchange event (above) fires to instantly reload the page.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (const reg of regs) {
            reg.update().catch(err => console.log('SW update check failed:', err));
          }
        });
      }
    });
  } else {
    // localhost dev — unregister any existing SW and clear caches
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
    });
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
  }
}
