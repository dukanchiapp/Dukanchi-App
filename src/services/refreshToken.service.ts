/**
 * Refresh Token Service — Day 5 / Session 92.
 *
 * Implements the industry-standard refresh-token rotation pattern with
 * reuse detection. See src/lib/redis-keys.ts for the inline threat model
 * + key scheme documentation.
 *
 * Public surface (5 functions):
 *   - generateRefreshToken(userId, role, familyId?) — issue token (login + rotate)
 *   - verifyRefreshToken(token)                      — validate + check active
 *   - rotateRefreshToken(oldToken)                   — one-time-use rotation
 *   - detectReuseAndRevokeFamily(userId, familyId)   — theft-signal handler
 *   - revokeRefreshToken(jti, userId)                — logout
 *
 * Errors are surfaced via the typed `RefreshTokenError` class so the
 * controller can discriminate on `err.code` rather than message-string
 * matching. The `REUSE_DETECTED` variant carries `{ jti, familyId, userId }`
 * in `context` so the controller can hand off to detectReuseAndRevokeFamily
 * without re-decoding the token.
 *
 * Algorithm pinned to HS256 throughout — matches Day 3.1 whitelist on
 * jwt.verify (sign + verify must agree). `type: 'refresh'` claim in the
 * payload prevents an access token from being mistakenly accepted on the
 * refresh path (and vice versa, if access tokens add `type: 'access'` in
 * Phase 3).
 */
import jwt from "jsonwebtoken";
import crypto from "crypto";
import * as Sentry from "@sentry/node";
import { pubClient } from "../config/redis";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import {
  rtActiveKey,
  rtBlacklistKey,
  rtFamilyKey,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../lib/redis-keys";

// ── Types ───────────────────────────────────────────────────────────────────

export type RefreshTokenErrorCode =
  | "INVALID_TOKEN" // signature failed (bad secret, malformed JWT, wrong algorithm)
  | "MALFORMED_TOKEN" // signature OK but payload missing required claims
  | "NOT_ACTIVE" // signature OK, not blacklisted, but no rt:active marker (TTL expired / never existed)
  | "REUSE_DETECTED"; // signature OK, but jti is in rt:blacklist (theft signal — controller MUST call detectReuseAndRevokeFamily)

export class RefreshTokenError extends Error {
  code: RefreshTokenErrorCode;
  context?: { jti?: string; familyId?: string; userId?: string };

  constructor(
    code: RefreshTokenErrorCode,
    message: string,
    context?: RefreshTokenError["context"],
  ) {
    super(message);
    this.code = code;
    this.context = context;
    this.name = "RefreshTokenError";
  }
}

export interface RefreshTokenPayload {
  userId: string;
  role: string;
  jti: string;
  familyId: string;
  /**
   * Optional team-member impersonation claim — present when this refresh
   * token belongs to a team-member login session. The corresponding
   * access token must carry the same teamMemberId so per-message socket
   * gates (Day 2.5) can still validate membership.
   */
  teamMemberId?: string;
}

// ── Internal helpers ────────────────────────────────────────────────────────

interface DecodedRefresh {
  userId?: string;
  role?: string;
  jti?: string;
  familyId?: string;
  teamMemberId?: string;
  type?: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT verify + payload-shape validation. Throws RefreshTokenError on:
 *   - invalid signature / wrong algorithm / expired (INVALID_TOKEN)
 *   - signature OK but missing required claims (MALFORMED_TOKEN)
 *   - signature OK but type !== 'refresh' (MALFORMED_TOKEN — defends against
 *     access tokens being passed as refresh tokens)
 *
 * Note: does NOT check active/blacklist state. That's verifyRefreshToken's
 * job — this is just the cryptographic + structural validation.
 */
function decodeAndValidateShape(token: string): RefreshTokenPayload {
  let decoded: DecodedRefresh;
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ["HS256"],
    }) as DecodedRefresh;
  } catch (err: any) {
    // Rule A: log the failure with structured event before re-throwing
    logger.warn(
      { event: "refresh_token.verify.invalid", err: err?.message ?? String(err) },
      "Refresh token signature verification failed",
    );
    throw new RefreshTokenError("INVALID_TOKEN", "Invalid refresh token");
  }

  if (
    !decoded.userId ||
    !decoded.role ||
    !decoded.jti ||
    !decoded.familyId ||
    decoded.type !== "refresh"
  ) {
    logger.warn(
      {
        event: "refresh_token.verify.malformed",
        hasUserId: !!decoded.userId,
        hasRole: !!decoded.role,
        hasJti: !!decoded.jti,
        hasFamilyId: !!decoded.familyId,
        type: decoded.type,
      },
      "Refresh token payload missing required claims or wrong type",
    );
    throw new RefreshTokenError(
      "MALFORMED_TOKEN",
      "Refresh token payload incomplete or wrong type",
    );
  }

  return {
    userId: decoded.userId,
    role: decoded.role,
    jti: decoded.jti,
    familyId: decoded.familyId,
    ...(decoded.teamMemberId ? { teamMemberId: decoded.teamMemberId } : {}),
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a refresh token. Used by both login (fresh familyId) and
 * rotation (existing familyId continues the chain).
 *
 * Side effects:
 *   - SET rt:active:{userId}:{jti} = "1" with TTL = REFRESH_TOKEN_TTL_SECONDS
 *   - SADD rt:family:{familyId} {jti}
 *   - EXPIRE rt:family:{familyId} REFRESH_TOKEN_TTL_SECONDS  (refreshed
 *     each time so the family set lives as long as the latest member)
 *
 * Returns { token, jti, familyId } so the controller can:
 *   - send `token` as a Set-Cookie value
 *   - log `jti` and `familyId` for audit
 */
export async function generateRefreshToken(
  userId: string,
  role: string,
  opts: { familyId?: string; teamMemberId?: string } = {},
): Promise<{ token: string; jti: string; familyId: string }> {
  const newJti = crypto.randomUUID();
  const useFamilyId = opts.familyId ?? crypto.randomUUID();
  const newFamily = !opts.familyId;

  const payload: Record<string, unknown> = {
    userId,
    role,
    jti: newJti,
    familyId: useFamilyId,
    type: "refresh",
  };
  if (opts.teamMemberId) payload.teamMemberId = opts.teamMemberId;

  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });

  // Mark active in Redis (TTL matches JWT exp so storage self-cleans).
  // Family-set membership records this jti as part of the rotation chain
  // so reuse detection can revoke siblings atomically.
  await Promise.all([
    pubClient.set(rtActiveKey(userId, newJti), "1", {
      EX: REFRESH_TOKEN_TTL_SECONDS,
    }),
    pubClient.sAdd(rtFamilyKey(useFamilyId), newJti),
  ]);
  // Re-stamp family TTL so the set outlives its newest member.
  await pubClient.expire(rtFamilyKey(useFamilyId), REFRESH_TOKEN_TTL_SECONDS);

  logger.info(
    {
      event: "refresh_token.issued",
      userId,
      role,
      jti: newJti,
      familyId: useFamilyId,
      newFamily,
    },
    newFamily ? "Refresh token family started" : "Refresh token rotated into existing family",
  );

  return { token, jti: newJti, familyId: useFamilyId };
}

/**
 * Verify a refresh token end-to-end: signature → shape → active state.
 *
 * Throws RefreshTokenError. The REUSE_DETECTED variant means the
 * controller MUST call detectReuseAndRevokeFamily(userId, familyId) to
 * blacklist the rest of the family — the theft signal indicates an
 * attacker has the legitimate user's old token.
 *
 * Returns the decoded payload on success.
 */
export async function verifyRefreshToken(
  token: string,
): Promise<RefreshTokenPayload> {
  const payload = decodeAndValidateShape(token); // throws INVALID_TOKEN / MALFORMED_TOKEN
  const { userId, jti, familyId } = payload;

  // Check if this jti is still active (not yet rotated or revoked).
  const isActive = await pubClient.get(rtActiveKey(userId, jti));

  if (!isActive) {
    // Two reasons rt:active could be absent:
    //   (a) Naturally expired (Redis TTL elapsed) or never existed
    //   (b) Was rotated/revoked — in which case rt:blacklist:{jti} exists
    // (b) is the theft signal: a token that PASSED signature + shape +
    // type checks but has been retired. Differentiate via rt:blacklist GET.
    const blacklistMarker = await pubClient.get(rtBlacklistKey(jti));
    if (blacklistMarker) {
      // Surface to Sentry as a warning — this is a security event,
      // not a routine 401. Caller will revoke the family.
      Sentry.captureMessage("refresh_token.reuse_detected", {
        level: "warning",
        tags: { component: "auth", event: "refresh_token_reuse" },
        extra: { userId, jti, familyId, blacklistMarker },
      });
      logger.warn(
        {
          event: "refresh_token.reuse_detected",
          userId,
          jti,
          familyId,
          blacklistMarker,
        },
        "REUSE DETECTED — refresh token used after rotation/revocation",
      );
      throw new RefreshTokenError(
        "REUSE_DETECTED",
        "Refresh token reuse detected",
        { userId, jti, familyId },
      );
    }
    // No blacklist entry and no active entry = naturally gone. Routine 401.
    logger.warn(
      { event: "refresh_token.not_active", userId, jti, familyId },
      "Refresh token not active (expired or never existed)",
    );
    throw new RefreshTokenError("NOT_ACTIVE", "Refresh token not active");
  }

  return payload;
}

/**
 * One-time-use rotation. Verifies the old token, retires it, and issues
 * a new token in the SAME family.
 *
 * Side effects:
 *   - SET rt:blacklist:{oldJti} = "rotated" with TTL = REFRESH_TOKEN_TTL_SECONDS
 *   - DEL rt:active:{userId}:{oldJti}
 *   - SET rt:active:{userId}:{newJti} (via generateRefreshToken)
 *   - SADD rt:family:{familyId} {newJti} (via generateRefreshToken)
 *
 * Returns the full context — controller uses userId/role to also issue
 * a fresh access token in the same response.
 */
export async function rotateRefreshToken(oldToken: string): Promise<{
  newToken: string;
  newJti: string;
  familyId: string;
  userId: string;
  role: string;
  teamMemberId?: string;
}> {
  // verifyRefreshToken throws REUSE_DETECTED if appropriate — caller handles.
  const payload = await verifyRefreshToken(oldToken);
  return rotateFromVerifiedPayload(payload);
}

/**
 * Service = state transitions, Controller = policy decisions (Q4 in
 * Phase 2 report). This entry point is used by the controller when it
 * needs to insert a user-availability check BETWEEN verify and rotate
 * (e.g., to preserve Day 2.5's deleted_pending carve-out: refresh
 * succeeds for in-grace users so they can reach /restore).
 *
 * Pre-condition: payload was just returned by verifyRefreshToken
 * (signature checked, active, type='refresh'). Caller is responsible
 * for any additional policy gates before invoking this.
 */
export async function rotateFromVerifiedPayload(
  payload: RefreshTokenPayload,
): Promise<{
  newToken: string;
  newJti: string;
  familyId: string;
  userId: string;
  role: string;
  teamMemberId?: string;
}> {
  const { userId, role, jti: oldJti, familyId, teamMemberId } = payload;

  // Retire the old token: blacklist + remove from active.
  // Order matters (Q3 confirmed in Phase 2 review): blacklist FIRST so
  // a concurrent request seeing rt:active gone but checking rt:blacklist
  // still gets REUSE_DETECTED instead of a false NOT_ACTIVE. The 1ms-ish
  // race window between the two ops is documented for Phase 6 manual
  // smoke; atomic MULTI/EXEC deferred to future hardening.
  await pubClient.set(rtBlacklistKey(oldJti), "rotated", {
    EX: REFRESH_TOKEN_TTL_SECONDS,
  });
  await pubClient.del(rtActiveKey(userId, oldJti));

  // Issue new token in the SAME family (familyId passed in).
  const { token: newToken, jti: newJti } = await generateRefreshToken(
    userId,
    role,
    { familyId, ...(teamMemberId ? { teamMemberId } : {}) },
  );

  logger.info(
    {
      event: "refresh_token.rotated",
      userId,
      role,
      oldJti,
      newJti,
      familyId,
      ...(teamMemberId ? { teamMemberId } : {}),
    },
    "Refresh token rotated successfully",
  );

  return {
    newToken,
    newJti,
    familyId,
    userId,
    role,
    ...(teamMemberId ? { teamMemberId } : {}),
  };
}

/**
 * Reuse-detection handler — called by the controller AFTER verifyRefreshToken
 * throws REUSE_DETECTED. Blacklists every jti in the family and clears the
 * family set, forcing both attacker and legit user back to login.
 *
 * Why blacklist the whole family: the attacker has presented an old token
 * that we already retired, meaning the legitimate user is now using a
 * descendant (or HAS used one — depends on timing). Either party could be
 * the attacker. Safest move: invalidate everything tied to this session.
 *
 * Returns { revokedCount } for audit logging by the caller.
 */
export async function detectReuseAndRevokeFamily(
  userId: string,
  familyId: string,
): Promise<{ revokedCount: number }> {
  const familyKey = rtFamilyKey(familyId);
  const allJtis = await pubClient.sMembers(familyKey);

  // Blacklist every jti, remove every active marker. Parallelize for speed;
  // partial-success is acceptable here — even if one Redis op fails, the
  // attacker's window shrinks (the user gets bumped to login on the next
  // request that hits an invalidated jti).
  await Promise.all([
    ...allJtis.flatMap((jti) => [
      pubClient.set(rtBlacklistKey(jti), "family_revoked", {
        EX: REFRESH_TOKEN_TTL_SECONDS,
      }),
      pubClient.del(rtActiveKey(userId, jti)),
    ]),
    // Drop the family set itself — no more tracking needed for this lineage.
    pubClient.del(familyKey),
  ]);

  Sentry.captureMessage("refresh_token.family_revoked", {
    level: "warning",
    tags: { component: "auth", event: "refresh_token_family_revoked" },
    extra: { userId, familyId, revokedCount: allJtis.length, revokedJtis: allJtis },
  });
  logger.warn(
    {
      event: "refresh_token.family_revoked",
      userId,
      familyId,
      revokedCount: allJtis.length,
      revokedJtis: allJtis,
    },
    "Refresh token family revoked due to reuse detection",
  );

  return { revokedCount: allJtis.length };
}

/**
 * Voluntary revoke (logout). Blacklists the jti + clears active marker.
 * Does NOT revoke the family — the user chose to log out from THIS device,
 * other devices keep their sessions.
 */
export async function revokeRefreshToken(
  jti: string,
  userId: string,
): Promise<void> {
  await Promise.all([
    pubClient.set(rtBlacklistKey(jti), "logout", {
      EX: REFRESH_TOKEN_TTL_SECONDS,
    }),
    pubClient.del(rtActiveKey(userId, jti)),
  ]);

  logger.info(
    { event: "refresh_token.revoked", userId, jti, reason: "logout" },
    "Refresh token revoked (logout)",
  );
}
