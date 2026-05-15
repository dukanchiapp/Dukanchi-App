/**
 * JWT helpers for tests — Day 2.7 / Session 91 / Phase 1 infrastructure.
 *
 * Each helper signs a token with `jsonwebtoken` directly (same library
 * production code uses). Mirrors the `algorithm: 'HS256'` + 7d expiry
 * default that production uses, with explicit overrides for tests that
 * need to verify edge cases (wrong algorithm, expired token).
 *
 * Pattern reference: src/middlewares/jwt-algorithm-whitelist.test.ts —
 * the existing JWT contract test that signs tokens directly.
 */
import jwt from "jsonwebtoken";

/**
 * The default test secret. Matches the pattern used in
 * auth.middleware.test.ts (32+ chars, simple ASCII).
 */
export const TEST_JWT_SECRET = "test-jwt-secret-32-chars-long-padding";

/**
 * Sign a standard production-shape JWT (HS256, 7d expiry).
 * Use this when the test is exercising the "happy path" verify.
 */
export function signTestJWT(
  payload: Record<string, any>,
  secret: string = TEST_JWT_SECRET,
): string {
  return jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "7d" });
}

/**
 * Sign an HS512 token — used to verify the Day 3.1 algorithm whitelist
 * rejects non-HS256 tokens even when the secret is correct.
 */
export function signWrongAlgJWT(
  payload: Record<string, any>,
  secret: string = TEST_JWT_SECRET,
): string {
  return jwt.sign(payload, secret, { algorithm: "HS512", expiresIn: "7d" });
}

/**
 * Sign an already-expired token (1s past `iat`).
 * Used to verify the verify path's `TokenExpiredError` handling.
 */
export function signExpiredJWT(
  payload: Record<string, any>,
  secret: string = TEST_JWT_SECRET,
): string {
  // iat=0 + expiresIn=1 → exp=1, definitively in the past
  return jwt.sign({ ...payload, iat: 0 }, secret, {
    algorithm: "HS256",
    expiresIn: 1,
  });
}
