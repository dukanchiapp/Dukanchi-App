/**
 * Redis mock factory — Day 2.7 / Session 91 / Phase 1 infrastructure.
 *
 * Returns shape-compatible pubClient + subClient mocks for the
 * `node-redis` client used in src/config/redis.ts. Each method is a
 * `vi.fn()` with a reasonable default (returns null/OK/1) so tests
 * pass without explicit setup; overrideable via `vi.mocked(...)`.
 *
 * Pattern derived from src/middlewares/auth.middleware.test.ts:45-50.
 * Codifies the same shape those tests construct inline.
 *
 * Usage:
 *   vi.mock("../config/redis", () => makeMockRedis());
 */
import { vi } from "vitest";

export function makeMockRedis() {
  const sharedMethods = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    // Set operations — used by refreshToken.service.ts for rt:family:* sets.
    // Day 5 / Session 92.
    sAdd: vi.fn().mockResolvedValue(1),
    sMembers: vi.fn().mockResolvedValue([] as string[]),
    sRem: vi.fn().mockResolvedValue(1),
    // sendCommand stub — used by rate-limit-redis. Returns a minimal
    // shape that satisfies the library's INCR / EXPIRE / TTL / EVAL
    // patterns when the test doesn't care about rate-limit behavior.
    // Tests that DO care should use express-rate-limit's default
    // MemoryStore instead (mock the limiter module itself).
    sendCommand: vi.fn().mockResolvedValue([1, Date.now() + 60000]),
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue("OK"),
  };

  const pubClient: any = { ...sharedMethods };
  pubClient.duplicate = vi.fn().mockReturnValue({ ...sharedMethods });

  const subClient: any = { ...sharedMethods };

  return {
    pubClient,
    subClient,
    connectRedis: vi.fn().mockResolvedValue(undefined),
  };
}
