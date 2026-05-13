import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { pubClient } from "../config/redis";
import { env } from "../config/env";

const makeRedisStore = (prefix: string) => new RedisStore({
  sendCommand: (...args: string[]) => pubClient.sendCommand(args),
  prefix,
});

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
});
