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
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.log('SW registration failed:', err));
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
