/**
 * Frontend Sentry init — Day 4 / Session 90 / Edit 6.
 *
 * Browser-side Sentry SDK initialization with GRACEFUL DEGRADATION:
 *   - Reads VITE_SENTRY_DSN from build-time env (Vite import.meta.env)
 *   - If unset → init is a no-op; subsequent Sentry.* calls become no-ops too
 *   - No crashes, no errors, no user-visible behavior change
 *
 * Separate from src/lib/sentry.ts which is the BACKEND Node init. Frontend
 * uses @sentry/react (browser SDK + React error boundary helper); backend
 * uses @sentry/node + @sentry/profiling-node. Different DSNs are recommended
 * so frontend and backend projects can be quota-tracked independently.
 *
 * Privacy posture:
 *   - replaysSessionSampleRate: 0 (off by default — session replay is
 *     privacy-invasive; we opt-in later with masking config when needed)
 *   - replaysOnErrorSampleRate: 1.0 (100% capture on error — only fires
 *     when something already went wrong, so the trade-off is favorable)
 *   - tracesSampleRate: 0.1 in prod / 1.0 in dev (matches backend)
 */
import * as Sentry from "@sentry/react";

export function initFrontendSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    // Graceful no-op — log to console for dev visibility only.
    // (vite.config.ts strips console.log in prod builds via terser pure_funcs.)
    if (import.meta.env.DEV) {
      console.info("[observability] Frontend Sentry disabled — VITE_SENTRY_DSN not set");
    }
    return;
  }

  const isProduction = import.meta.env.PROD;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Release tag: when @sentry/vite-plugin is active at build time AND
    // SENTRY_AUTH_TOKEN is set, the plugin injects the release automatically
    // (via __SENTRY_RELEASE__ define). When the plugin is inactive (token
    // missing — graceful degradation path), we omit the release field —
    // Sentry handles this gracefully (events still arrive, just without a
    // release tag in the UI). Leaving the release to plugin-injected
    // auto-discovery keeps this file dependency-free.
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Privacy: mask all text content and media; only structure is captured.
        // Replay is OFF by default (sample rate 0) — these flags only matter
        // if the rate is bumped later.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Strip query strings (may contain PII / search terms / coordinates)
    beforeSend(event) {
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          event.request.url = u.origin + u.pathname;
        } catch {
          /* malformed URL — leave as-is */
        }
      }
      return event;
    },
  });
}

/**
 * Wire user identity to Sentry's scope. Call after successful login.
 * Pass null on logout to clear.
 *
 * Mirrors the backend pattern in app.ts:161 (Sentry.setUser per-request).
 * Frontend retains the user across navigations via Sentry's persistent scope.
 */
export function setSentryUser(user: { id: string; role?: string } | null): void {
  if (user === null) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: user.id, ...(user.role && { role: user.role }) });
}

// Re-export the Sentry namespace so callers can use Sentry.captureException etc.
// directly without importing from @sentry/react in many files.
export { Sentry };
