/**
 * Frontend PostHog init — Day 4 / Session 90 / Edit 8.
 *
 * Browser-side PostHog SDK initialization with GRACEFUL DEGRADATION:
 *   - Reads VITE_POSTHOG_KEY + VITE_POSTHOG_HOST from build-time env
 *   - If VITE_POSTHOG_KEY unset → init is a no-op; capture()/identify()/reset()
 *     also become no-ops via posthog-js's built-in disabled-state
 *   - No crashes, no errors, no user-visible behavior change
 *
 * EU instance default (eu.i.posthog.com) — DPDP-friendly, closer to India,
 * GDPR-grade privacy. Override via VITE_POSTHOG_HOST if needed.
 *
 * Backend posthog-node is intentionally NOT installed — audit confirmed
 * current event set is fully frontend-emit-able (no queue completions,
 * cron jobs, or webhook handlers needing server-side capture).
 *
 * Privacy posture:
 *   - autocapture: ON (default) — clicks, form submissions, pageviews
 *   - capture_pageview: ON — SPA route changes via History API
 *   - disable_session_recording: TRUE — session replay is privacy-invasive;
 *     we opt-in later with explicit masking config when needed
 *   - persistence: 'localStorage' — survives page reloads but cleared
 *     on browser-level "clear site data"
 */
import posthog from "posthog-js";

let _enabled = false;

export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

  if (!key) {
    if (import.meta.env.DEV) {
      console.info("[observability] PostHog disabled — VITE_POSTHOG_KEY not set");
    }
    return;
  }

  posthog.init(key, {
    api_host: host,
    persistence: "localStorage",
    autocapture: true,
    capture_pageview: true,
    disable_session_recording: true,
    // Don't capture in dev unless user opts in via posthog._loaded check
    // (helps avoid event noise during local dev; can be toggled later).
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        ph.opt_out_capturing();
        console.info("[observability] PostHog initialized but opted-out in dev");
      } else {
        _enabled = true;
      }
    },
  });

  if (import.meta.env.PROD) _enabled = true;
}

/**
 * Identify the current user. Call after successful login.
 * Pass null on logout to reset (anonymous distinct_id thereafter).
 */
export function identifyUser(
  user: { id: string; role?: string; signupDate?: string } | null,
): void {
  if (!_enabled) return;
  if (user === null) {
    posthog.reset();
    return;
  }
  posthog.identify(user.id, {
    ...(user.role && { role: user.role }),
    ...(user.signupDate && { signup_date: user.signupDate }),
  });
}

/**
 * Capture a named event with optional properties. No-op when disabled or in dev.
 * Property naming convention: snake_case (PostHog standard).
 *
 * Privacy reminder: NEVER pass raw user text content (search queries, chat
 * messages, post captions). Pass derived metrics instead (length, count,
 * boolean flags). Audit anything you add here.
 */
export function captureEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
): void {
  if (!_enabled) return;
  posthog.capture(event, properties);
}

// Re-export the raw posthog instance for advanced uses (feature flags etc.).
export { posthog };
