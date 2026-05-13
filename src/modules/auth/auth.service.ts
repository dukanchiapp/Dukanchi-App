import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { pubClient } from "../../config/redis";
import {
  evaluateUserStatus,
  UnavailableReason,
} from "../../middlewares/user-status";
import { generateRefreshToken } from "../../services/refreshToken.service";
import { ACCESS_TOKEN_TTL_SECONDS } from "../../lib/redis-keys";

const ADMIN_STATS_KEY = 'admin:stats';

/**
 * Mint a fresh access token — Day 5 / Session 92.
 *
 * Payload includes:
 *   - userId, role (existing)
 *   - jti (UUID v4) — enables logout-driven access-token blacklist via
 *     accessBlacklistKey(jti). Legacy tokens (pre-Day-5) lacked jti and
 *     can't be blacklisted; this gap closes naturally as old tokens
 *     expire (15-min TTL).
 *   - type: 'access' — symmetric defense vs refreshToken.service's
 *     type: 'refresh'. authenticateToken middleware rejects tokens with
 *     type === 'refresh' (lenient on missing type for legacy compat).
 *   - teamMemberId (optional) — preserved for team-member impersonation
 *     sessions so per-message socket gates still validate membership.
 *
 * Algorithm pinned to HS256 (Day 3.1 whitelist).
 */
export function signAccessToken(args: {
  userId: string;
  role: string;
  teamMemberId?: string;
}): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const payload: Record<string, unknown> = {
    userId: args.userId,
    role: args.role,
    jti,
    type: "access",
  };
  if (args.teamMemberId) payload.teamMemberId = args.teamMemberId;

  const token = jwt.sign(payload, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
  return { token, jti };
}

/**
 * Error subclass thrown by login / signup when the target user is unavailable
 * (blocked, deleted_pending, deleted_expired). The controller catches by
 * shape (`error.unavailableReason`) and maps to the canonical 401 body via
 * unavailableError() from user-status.ts.
 *
 * Day 2.5 / Session 88 — service-layer defense-in-depth for the auth-middleware
 * gate. Keeps the controller's error-handling simple (single field check,
 * no message-string matching).
 */
export class UnavailableUserError extends Error {
  unavailableReason: UnavailableReason;
  constructor(reason: UnavailableReason) {
    super(`User unavailable: ${reason}`);
    this.name = "UnavailableUserError";
    this.unavailableReason = reason;
  }
}

// Helper: convert a Prisma User row's (isBlocked, deletedAt) into a status
// object the evaluator can read, then run the decision.
const evaluateRow = (row: { isBlocked: boolean; deletedAt: Date | null }) =>
  evaluateUserStatus({
    isBlocked: row.isBlocked,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    blockedReason: null,
  });

export class AuthService {
  static async signup(data: any) {
    const { name, phone, password, role, location } = data;

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      // Three cases based on deletedAt — see D1 policy (30-day grace).
      if (!existingUser.deletedAt) {
        // (a) Active user with this phone — straight duplicate.
        throw new Error("This phone number already exists");
      }
      const expired = existingUser.deletedAt.getTime() <= Date.now();
      if (!expired) {
        // (b) Within grace period — guide user toward /restore instead of
        //     letting them silently create a new account that orphans data.
        throw new UnavailableUserError("deleted_pending");
      }
      // (c) Past grace period — D1 spec says phone should be FREE here, but
      //     the hard-delete worker hasn't been built yet (queued for the
      //     last Day 2.5 sub-phase). The old row still occupies the unique
      //     phone slot, so a fresh prisma.user.create would fail at the DB
      //     level with P2002. Until the worker exists, refuse with the same
      //     opaque message as (a). Future-you: when the worker is in place,
      //     this branch becomes unreachable (the past-grace row will be
      //     physically gone by the time signup is attempted).
      // TODO(hard-delete-worker): remove this branch once the cleanup worker
      //     ships. Until then, past-grace phone numbers stay "taken".
      throw new Error("This phone number already exists");
    }

    // Salt rounds sourced from env.BCRYPT_ROUNDS (default 12) — Subtask 3.4.
    // bcrypt encodes the cost per-hash, so bumping the env later is safe.
    const hashedPassword = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: { name, phone, password: hashedPassword, role, location }
    });

    // Day 5: issue access (15min, JWT_SECRET) + refresh (30d, JWT_REFRESH_SECRET).
    // Refresh token starts a new family for this user's signup session.
    const { token: accessToken } = signAccessToken({ userId: user.id, role: user.role });
    const { token: refreshToken } = await generateRefreshToken(user.id, user.role);

    try { await pubClient.del(ADMIN_STATS_KEY); } catch { /* Redis unavailable — non-fatal */ }

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  static async login(data: any) {
    const { phone, password } = data;

    // Check registered User account FIRST — a phone that exists in the User table
    // always belongs to that user, even if it also appears in TeamMember.
    // Checking TeamMember first would hijack the user's identity.
    const user = await prisma.user.findUnique({ where: { phone } });

    if (user) {
      // Verify password BEFORE checking availability — wrong-password attempts
      // get an opaque "Invalid credentials" so attackers can't probe blocked/
      // deleted account state by submitting a wrong password.
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) throw new Error("Invalid credentials");

      // Service-layer availability check (defense-in-depth — the auth middleware
      // already gates token-bearing requests, but login itself doesn't go
      // through that middleware so the check lives here).
      // Single source of truth = evaluateUserStatus, same decision branches as
      // the middleware. Covers blocked / deleted_pending / deleted_expired.
      const check = evaluateRow(user);
      if (check.unavailable) {
        throw new UnavailableUserError(check.reason);
      }

      const { token: accessToken } = signAccessToken({ userId: user.id, role: user.role });
      const { token: refreshToken } = await generateRefreshToken(user.id, user.role);
      const { password: _, ...userWithoutPassword } = user;
      return { user: userWithoutPassword, accessToken, refreshToken };
    }

    // No User account found — try TeamMember login
    const teamMember = await prisma.teamMember.findUnique({
      where: { phone },
      include: { store: { include: { owner: true } } }
    });

    if (teamMember) {
      const validPassword = await bcrypt.compare(password, teamMember.passwordHash);
      if (!validPassword) throw new Error("Invalid credentials");

      // TeamMember login issues a JWT that impersonates the store OWNER —
      // so the owner's availability state gates the team member's session.
      // (TeamMember itself has no soft-delete column; the owner does.)
      const ownerCheck = evaluateRow(teamMember.store.owner);
      if (ownerCheck.unavailable) {
        throw new UnavailableUserError(ownerCheck.reason);
      }

      // Team-member tokens impersonate the owner (userId = ownerId) but carry
      // teamMemberId so per-message socket gates can still verify membership.
      const ownerId = teamMember.store.ownerId;
      const ownerRole = teamMember.store.owner.role;
      const { token: accessToken } = signAccessToken({
        userId: ownerId,
        role: ownerRole,
        teamMemberId: teamMember.id,
      });
      const { token: refreshToken } = await generateRefreshToken(ownerId, ownerRole, {
        teamMemberId: teamMember.id,
      });
      const { password: _, ...userWithoutPassword } = teamMember.store.owner;
      return { user: userWithoutPassword, accessToken, refreshToken, isTeamMember: true };
    }

    throw new Error("Invalid credentials");
  }

  /**
   * @deprecated Day 5 / Session 92 — superseded by the refresh-token
   * rotation flow in `src/services/refreshToken.service.ts`. The
   * /api/auth/refresh route now reads the refresh cookie directly and
   * uses `rotateFromVerifiedPayload`. This method is kept for the
   * migration window only; no internal callers remain. Safe to remove
   * after Day 8 deploy + a few weeks of stability.
   *
   * Still respects Day 2.5's deleted_pending carve-out (acceptDeletedPending).
   * If you need this elsewhere, prefer wiring through the refresh-token
   * service instead — it gives you rotation, theft detection, and a
   * proper revocation surface for free.
   */
  static async issueTokenForUser(
    userId: string,
    opts: { acceptDeletedPending?: boolean } = {},
  ): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isBlocked: true, deletedAt: true },
    });
    if (!user) return null;

    const check = evaluateRow(user);
    if (check.unavailable) {
      const permitted =
        check.reason === "deleted_pending" && opts.acceptDeletedPending === true;
      if (!permitted) return null;
    }

    const { token } = signAccessToken({ userId: user.id, role: user.role });
    return token;
  }
}
