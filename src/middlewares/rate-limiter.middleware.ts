import rateLimit, { type Store, type ClientRateLimitInfo, type Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import * as Sentry from "@sentry/node";
import { pubClient } from "../config/redis";
import { env } from "../config/env";
import { logger } from "../lib/logger";

/**
 * C2 (Session 128.30): fail-OPEN rate-limit store wrapper.
 *
 * Without this, a Redis blip makes RedisStore.increment() reject →
 * express-rate-limit calls next(err) → HTTP 500 on EVERY /api request: a full
 * API outage caused by the rate-limiter itself. This wrapper SWALLOWS any
 * underlying store error and ALLOWS the request (increment → { totalHits: 0 }),
 * emitting a loud (throttled) warn + Sentry message so the degraded window is
 * observable.
 *
 * DELIBERATE TRADEOFF: during a Redis outage we prioritise AVAILABILITY (stay
 * up, briefly unprotected) over abuse-protection — a short unprotected window
 * beats a hard outage, and the loud log makes it visible. Normal operation is
 * UNCHANGED: when Redis is healthy the real counts pass straight through and
 * limiting works exactly as before (see the passthrough in `increment`).
 *
 * Exported for direct unit testing of both the passthrough and fail-open paths.
 */
export function failOpen(inner: Store, label: string): Store {
  let lastWarn = 0;
  const WARN_THROTTLE_MS = 30 * 1000; // avoid a log flood during a sustained outage

  const reportDegraded = (op: string, err: unknown) => {
    const now = Date.now();
    if (now - lastWarn < WARN_THROTTLE_MS) return;
    lastWarn = now;
    logger.warn(
      { err, limiter: label, op },
      "rate-limiter degraded: Redis unavailable, failing open (requests allowed unthrottled)",
    );
    try {
      Sentry.captureMessage("rate-limiter degraded: Redis unavailable, failing open", {
        level: "warning",
        tags: { component: "rate-limiter", limiter: label },
      });
    } catch {
      /* Sentry not initialised in some contexts — never block the request on it */
    }
  };

  return {
    localKeys: (inner as { localKeys?: boolean }).localKeys,
    init(options: Options) {
      try {
        inner.init?.(options);
      } catch (err) {
        reportDegraded("init", err);
      }
    },
    async increment(key: string): Promise<ClientRateLimitInfo> {
      try {
        return await inner.increment(key);
      } catch (err) {
        reportDegraded("increment", err);
        // Under-limit result → request ALLOWED. resetTime undefined is fine —
        // express-rate-limit falls back to windowMs for the RateLimit-* headers.
        return { totalHits: 0, resetTime: undefined };
      }
    },
    async decrement(key: string): Promise<void> {
      try {
        await inner.decrement(key);
      } catch (err) {
        reportDegraded("decrement", err);
      }
    },
    async resetKey(key: string): Promise<void> {
      try {
        await inner.resetKey(key);
      } catch (err) {
        reportDegraded("resetKey", err);
      }
    },
    async resetAll(): Promise<void> {
      try {
        await inner.resetAll?.();
      } catch (err) {
        reportDegraded("resetAll", err);
      }
    },
  };
}

const makeRedisStore = (prefix: string): Store =>
  failOpen(
    new RedisStore({
      sendCommand: (...args: string[]) => pubClient.sendCommand(args),
      prefix,
    }),
    prefix,
  );

export const authLimiter = rateLimit({
  store: makeRedisStore('rl:auth:'),
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 20 : 100,
  message: { error: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
  store: makeRedisStore('rl:upload:'),
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many uploads. Please slow down." },
  // Day 2.6 ND #2: standardHeaders emits the industry-standard RateLimit-*
  // and Retry-After headers (RFC 6585 §4 / draft-ietf-httpapi-ratelimit-headers).
  // Without these, clients can't back off correctly when they hit 429.
  // legacyHeaders=false suppresses the older X-RateLimit-* duplicates.
  standardHeaders: true,
  legacyHeaders: false,
});

export const messageLimiter = rateLimit({
  store: makeRedisStore('rl:message:'),
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "You're sending messages too quickly. Please slow down." },
});

export const generalLimiter = rateLimit({
  store: makeRedisStore('rl:general:'),
  windowMs: 60 * 1000,
  max: 300,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
  // Session 128.36: skip /api/auth/* — those routes have their own
  // authLimiter (max 20/15min). Without this skip, both limiters fire on the
  // same request → express-rate-limit logs the documented ERR_ERL_DOUBLE_COUNT
  // warning (observed in prod Sentry on the scanner traffic at 66.241.125.180).
  // Express strips the '/api' mount prefix inside this middleware, so req.path
  // is post-mount → '/auth/login' (NOT '/api/auth/login').
  skip: (req) => req.path.startsWith('/auth/'),
});
