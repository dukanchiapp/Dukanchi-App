/**
 * Redis key patterns + TTL constants — Day 5 / Session 92.
 *
 * Centralizes refresh-token-related Redis key schemes so the auth layer,
 * test mocks, and future cleanup tools all agree on the same names. The
 * scheme is documented inline so future-anyone reading this file gets
 * the threat model without having to read the service code.
 *
 * Threat model — refresh token rotation with reuse detection:
 *
 *   1. Login mints a refresh token jti=A in family F. Server writes:
 *        rt:active:{userId}:A   (TTL = REFRESH_TOKEN_TTL_SECONDS)
 *        rt:family:F            (set add: A)
 *
 *   2. Client presents A to /api/auth/refresh. Server rotates:
 *        rt:blacklist:A         (TTL = REFRESH_TOKEN_TTL_SECONDS)
 *        DEL rt:active:{userId}:A
 *        Mints jti=B in same family F:
 *          rt:active:{userId}:B (TTL = REFRESH_TOKEN_TTL_SECONDS)
 *          rt:family:F          (set add: B)
 *
 *   3. If A is presented AGAIN (theft signal — attacker has the old
 *      token, legit client has B). Server detects via rt:blacklist:A
 *      hit, then revokes the ENTIRE family:
 *        for each jti in SMEMBERS rt:family:F:
 *          rt:blacklist:{jti}  (TTL = REFRESH_TOKEN_TTL_SECONDS)
 *          DEL rt:active:{userId}:{jti}
 *
 *   This forces both the attacker AND the legit user back to login —
 *   preferable to silent compromise.
 *
 *   4. Logout: revoke current refresh jti + add current access jti to
 *      access:blacklist (short TTL since access tokens are short-lived).
 *
 * Key prefix conventions:
 *   - rt:*       → refresh token surface (long TTL, 30d)
 *   - access:*   → access token surface (short TTL, 15m)
 *
 * TTL choices match the JWT exp claim, so a key cannot outlive its
 * token's natural validity (storage hygiene).
 */

/** Refresh token lifetime: 30 days (industry standard for "remember me"). */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Access token lifetime: 15 minutes (industry standard for short-lived). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/**
 * Active refresh token marker. Presence = token is valid (not yet rotated
 * or revoked). Set on token issuance; deleted on rotation / revocation.
 *
 * Why userId in the key: avoids cross-user jti collisions (UUIDs are
 * statistically unique but defense-in-depth costs nothing) AND lets us
 * batch-list-and-delete all tokens for a user (KEYS rt:active:{userId}:*)
 * during admin actions like password-change. KEYS is not used in hot
 * paths — only in admin / housekeeping operations.
 */
export const rtActiveKey = (userId: string, jti: string): string =>
  `rt:active:${userId}:${jti}`;

/**
 * Blacklisted refresh token jti. Presence = token was rotated or revoked
 * and must never be accepted again. TTL matches the natural token expiry
 * so the entry self-cleans (no manual cleanup needed).
 */
export const rtBlacklistKey = (jti: string): string => `rt:blacklist:${jti}`;

/**
 * Refresh token family set. Members = all jti's that belong to the same
 * login session (created on initial login, extended on each rotation).
 *
 * If reuse is detected on any jti in the family, the entire family is
 * blacklisted in one sweep — see threat model above.
 */
export const rtFamilyKey = (familyId: string): string => `rt:family:${familyId}`;

/**
 * Blacklisted access token jti (logout). Presence = token must be rejected
 * even though its signature verifies and expiry hasn't passed. TTL = 15 min
 * matches access-token expiry, so the entry self-cleans.
 *
 * NOTE: This is the ONLY revocation mechanism for access tokens (stateless
 * JWTs are otherwise un-revocable). The blacklist check adds one Redis GET
 * to the hot path of every authed request. If that latency ever becomes
 * a concern, the alternative is to shorten access-token TTL further
 * (e.g., 5 min) and accept the slightly-elevated refresh frequency.
 */
export const accessBlacklistKey = (jti: string): string =>
  `access:blacklist:${jti}`;
