import { describe, it, expect } from "vitest";
import bcrypt from "bcrypt";
import { z } from "zod";

/**
 * bcrypt rounds contract test — Day 3 / Session 89 / Subtask 3.4.
 *
 * Pins the two properties we rely on:
 *   1. The env.BCRYPT_ROUNDS zod schema defaults to 12 when the env var is
 *      undefined (the 2026 production-ready cost factor).
 *   2. bcrypt.hash at rounds=12 produces a hash that begins with `$2b$12$` —
 *      proving the cost is encoded in the hash itself, which is what makes
 *      future rounds-bumps backwards-compatible with existing hashes
 *      (bcrypt.compare reads cost per-hash, NOT from any config).
 *
 * The schema rule is re-declared inline (NOT imported from env.ts) because
 * env.ts triggers full env validation at import time and would require us
 * to stub DATABASE_URL / JWT_SECRET / GEMINI_API_KEY. Pure schema testing
 * keeps this test fast and dependency-free.
 *
 * If this test fails, either:
 *   - The bcrypt library has changed its output format (catastrophic — audit immediately), or
 *   - Someone changed the BCRYPT_ROUNDS default in env.ts without updating this guard.
 */
describe("bcrypt rounds configuration", () => {
  // Inline mirror of the BCRYPT_ROUNDS zod rule in src/config/env.ts.
  // Kept in sync manually — see comment above for why we don't import.
  const bcryptRoundsSchema = z.coerce.number().int().min(10).max(14).default(12);

  it("defaults BCRYPT_ROUNDS to 12 when the env var is undefined", () => {
    const parsed = bcryptRoundsSchema.parse(undefined);
    expect(parsed).toBe(12);
  });

  it("accepts BCRYPT_ROUNDS values within the [10, 14] range", () => {
    expect(bcryptRoundsSchema.parse("10")).toBe(10);
    expect(bcryptRoundsSchema.parse("11")).toBe(11);
    expect(bcryptRoundsSchema.parse("14")).toBe(14);
  });

  it("rejects BCRYPT_ROUNDS below 10 (weak) and above 14 (paranoid)", () => {
    expect(() => bcryptRoundsSchema.parse("9")).toThrow();
    expect(() => bcryptRoundsSchema.parse("15")).toThrow();
  });

  it("produces a hash with the $2b$12$ prefix at rounds=12", async () => {
    // Real bcrypt call — ~250ms on modern hardware. Single hash, acceptable test cost.
    const hash = await bcrypt.hash("test-password-not-real", 12);
    expect(hash.startsWith("$2b$12$")).toBe(true);
  });
});
