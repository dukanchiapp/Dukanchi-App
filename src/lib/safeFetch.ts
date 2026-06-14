/**
 * Session 128.38 — bounded external HTTP wrapper + race-deadline helper.
 *
 * ── Why ─────────────────────────────────────────────────────────────────
 * External calls (Gemini, postalpincode, nominatim) have no SLA and can hang
 * for tens of seconds under load. Without a deadline, a single slow upstream
 * pins a Node worker thread on a held DB pool slot — under volume that
 * cascades into pool exhaustion and 502s. failOpen() (Session 128.30) gave us
 * the same property for the rate-limiter; this gives us the property for
 * outbound HTTP and SDK calls.
 *
 * ── What's deliberately NOT here ────────────────────────────────────────
 * Six external-HTTP callsites already wrap their fetches with
 * `signal: AbortSignal.timeout(...)` (Subtask 3.5). They're not touched in
 * this session — migrating them to `safeFetch` is mechanical follow-up work,
 * not a behaviour change worth coupling. New external calls SHOULD use
 * `safeFetch` so we get one breadcrumb shape, one retry policy, and one
 * Sentry tag namespace.
 *
 * ── Contract ────────────────────────────────────────────────────────────
 * - On success → returns the Response object verbatim (caller does .json()).
 * - On timeout / network / retry-eligible-after-retries → returns a tagged
 *   error object: { ok:false, reason, label, attempts, status? }.
 *   Callers MUST narrow via `'reason' in res` before treating as Response.
 * - Sentry breadcrumb on every terminal failure (with the supplied label) so
 *   prod can answer "which call timed out, how often, after how many retries".
 *
 * ── Race-deadline helper ────────────────────────────────────────────────
 * `withDeadline(promise, ms, label)` exists for SDKs (e.g. @google/genai)
 * that don't expose their own AbortController. Same observability: throws
 * a tagged DeadlineExceededError that callers catch and turn into a
 * fallback path — never a 500.
 */
import * as Sentry from '@sentry/node';
import { logger } from './logger';

export type SafeFetchErrorReason =
  | 'timeout'    // AbortController fired
  | 'network'    // fetch() rejected (DNS, connect, TLS, broken pipe)
  | 'http';      // 5xx / 429 after retries exhausted

export interface SafeFetchError {
  ok: false;
  reason: SafeFetchErrorReason;
  label: string;
  attempts: number;
  status?: number;       // populated when reason === 'http'
  message?: string;      // for logs / Sentry — never user-facing
}

export interface SafeFetchOpts {
  /** Wall-clock deadline PER ATTEMPT. Default 5000ms. */
  timeoutMs?: number;
  /** Additional retries after the first attempt (so total = 1 + retries). Default 0. */
  retries?: number;
  /** Short slug used in Sentry tags + breadcrumb category. Required. */
  label: string;
  /** Override backoff sequence (ms between attempts). Default [300, 900]. */
  backoffMs?: number[];
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_BACKOFF_MS = [300, 900];

/** Treat 429 + 5xx as retry-eligible at the HTTP layer. */
function isHttpRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function reportTerminalFailure(err: SafeFetchError): void {
  logger.warn(
    { reason: err.reason, label: err.label, attempts: err.attempts, status: err.status, message: err.message },
    `safeFetch[${err.label}] terminal failure after ${err.attempts} attempt(s) — caller should fall back`,
  );
  try {
    Sentry.captureMessage(`safeFetch.${err.label}.${err.reason}`, {
      level: 'warning',
      tags: { component: 'safeFetch', label: err.label, reason: err.reason },
      extra: { attempts: err.attempts, status: err.status, message: err.message },
    });
  } catch {
    /* Sentry not initialised in some test contexts — never block on it */
  }
}

/**
 * Bounded fetch: wraps the global fetch with a per-attempt timeout +
 * retry/backoff for transient failures. See contract above.
 */
export async function safeFetch(
  url: string,
  init: RequestInit | undefined,
  opts: SafeFetchOpts,
): Promise<Response | SafeFetchError> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = Math.max(0, opts.retries ?? 0);
  const backoff = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  const label = opts.label;

  let lastErr: SafeFetchError = {
    ok: false,
    reason: 'network',
    label,
    attempts: 0,
    message: 'no attempts ran',
  };

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Merge caller-provided signal (if any) with ours: abort if EITHER fires.
    const callerSignal = init?.signal;
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) return res;

      // Non-OK HTTP: 4xx (non-429) is terminal; 5xx + 429 are retry-eligible.
      if (!isHttpRetryable(res.status) || attempt > retries) {
        lastErr = { ok: false, reason: 'http', label, attempts: attempt, status: res.status, message: `HTTP ${res.status}` };
        if (!isHttpRetryable(res.status)) {
          // Don't report 4xx as Sentry warnings — those are caller errors
          // (bad request, etc.) not infrastructure problems. Still return the
          // error object so the caller can branch.
          return lastErr;
        }
        reportTerminalFailure(lastErr);
        return lastErr;
      }
      // Retry-eligible HTTP — fall through to backoff
      lastErr = { ok: false, reason: 'http', label, attempts: attempt, status: res.status, message: `HTTP ${res.status}` };
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
      lastErr = {
        ok: false,
        reason: isTimeout ? 'timeout' : 'network',
        label,
        attempts: attempt,
        message: err instanceof Error ? err.message : String(err),
      };
      if (attempt > retries) {
        reportTerminalFailure(lastErr);
        return lastErr;
      }
    }

    // Backoff before next attempt (only if we have retries left).
    if (attempt <= retries) {
      const delayMs = backoff[Math.min(attempt - 1, backoff.length - 1)];
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Loop fell through with all retries exhausted (retry-eligible HTTP path).
  reportTerminalFailure(lastErr);
  return lastErr;
}

/**
 * Thrown by `withDeadline` when the wrapped promise doesn't resolve in time.
 * Distinct from the standard AbortError so SDK callers can `instanceof`-check
 * without ambiguity.
 */
export class DeadlineExceededError extends Error {
  constructor(public readonly label: string, public readonly ms: number) {
    super(`Deadline exceeded for ${label} (${ms}ms)`);
    this.name = 'DeadlineExceededError';
  }
}

/**
 * Race a promise against a deadline. For SDKs that don't expose AbortSignal.
 * On deadline expiry: throws DeadlineExceededError + emits Sentry breadcrumb.
 *
 * IMPORTANT: this does NOT cancel the underlying work — the SDK call continues
 * in the background until it resolves/rejects on its own. That's acceptable
 * for our use case (Gemini Vision) because the alternative (no deadline) is
 * worse, and the SDK's own network layer eventually times out. If you find
 * yourself reaching for this on a hot path with no SDK-level timeout, plumb a
 * native AbortController through instead.
 */
export async function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineExceededError(label, ms)), ms);
  });
  try {
    return await Promise.race([promise, deadline]);
  } catch (err) {
    if (err instanceof DeadlineExceededError) {
      logger.warn({ label, ms }, `withDeadline[${label}] exceeded ${ms}ms — caller should fall back`);
      try {
        Sentry.captureMessage(`withDeadline.${label}.exceeded`, {
          level: 'warning',
          tags: { component: 'withDeadline', label },
          extra: { ms },
        });
      } catch { /* Sentry optional */ }
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
