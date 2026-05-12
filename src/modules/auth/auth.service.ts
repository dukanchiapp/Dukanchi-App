import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { pubClient } from "../../config/redis";
import {
  evaluateUserStatus,
  UnavailableReason,
} from "../../middlewares/user-status";

const ADMIN_STATS_KEY = 'admin:stats';

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

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({
      data: { name, phone, password: hashedPassword, role, location }
    });

    const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });

    try { await pubClient.del(ADMIN_STATS_KEY); } catch { /* Redis unavailable — non-fatal */ }

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
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

      const token = jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
      const { password: _, ...userWithoutPassword } = user;
      return { user: userWithoutPassword, token };
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

      const token = jwt.sign(
        { userId: teamMember.store.ownerId, role: teamMember.store.owner.role, teamMemberId: teamMember.id },
        env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '7d' }
      );
      const { password: _, ...userWithoutPassword } = teamMember.store.owner;
      return { user: userWithoutPassword, token, isTeamMember: true };
    }

    throw new Error("Invalid credentials");
  }

  /**
   * Issue a fresh 7-day JWT for an existing user. Used by /api/auth/refresh.
   * Returns null if the user is unavailable.
   *
   * STRICT BY DEFAULT — refuses any unavailable user (blocked, deleted_pending,
   * deleted_expired, missing).
   *
   * The /api/auth/refresh route uses authenticateAllowDeleted (permissive)
   * middleware AND passes { acceptDeletedPending: true } here so users in
   * their 30-day grace period can refresh their token to reach /restore
   * beyond the original 7-day JWT TTL. blocked + deleted_expired remain
   * hard rejects regardless of opts (defense-in-depth alongside the
   * middleware).
   *
   * No other call site should pass acceptDeletedPending: true — the carve-out
   * exists solely so /restore stays reachable.
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
      // Permissive carve-out: deleted_pending is allowed through ONLY when
      // explicitly opted in (matches authenticateAllowDeleted's policy).
      const permitted =
        check.reason === "deleted_pending" && opts.acceptDeletedPending === true;
      if (!permitted) return null;
    }

    // Algorithm pinned to HS256 (Day 3 / Session 89) — matches verify-side
    // whitelist in auth.middleware.ts + socket-listeners.ts. Default was
    // already HS256, but explicit signals intent and protects against future
    // library default changes.
    return jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
  }
}
