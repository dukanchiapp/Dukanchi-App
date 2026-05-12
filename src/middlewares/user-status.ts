import * as Sentry from "@sentry/node";
import { prisma } from "../config/prisma";
import { pubClient } from "../config/redis";
import { logger } from "../lib/logger";

/**
 * User-status cache + helpers — foundation for the soft-delete cascade.
 *
 * Replaces the old `isUserBlocked` inline helper in auth.middleware.ts with a
 * richer view that knows about BOTH blocking and soft-deletion. The cache is
 * a single Redis key per user holding a JSON object so a single GET returns
 * the full availability picture (no second round-trip to differentiate
 * "blocked" vs "deleted" for error-message UX).
 *
 * Cache invalidation is callers' responsibility — see invalidateUserStatusCache().
 * Hot paths (admin block/unblock, account delete/restore) must call it.
 *
 * Day 2.5 / Session 88 hardening.
 */

// 60-second TTL — same policy as the previous `blocked:${userId}` cache, so
// staleness behaviour is unchanged for existing flows.
const USER_STATUS_TTL = 60;

/**
 * Cached shape stored under userStatus:${userId}.
 * `deletedAt` is ISO-string (or null) for JSON-friendly storage.
 * `blockedReason` reserved for future admin-block-reason metadata; null today.
 */
export type UserStatus = {
  isBlocked: boolean;
  deletedAt: string | null;
  blockedReason: string | null;
};

/**
 * Result discriminator for isUserUnavailable():
 *   - 'blocked'           — admin block (isBlocked=true)
 *   - 'deleted_pending'   — within grace period (deletedAt > NOW())
 *   - 'deleted_expired'   — grace period over or user vanished from DB
 *
 * Callers decide whether 'deleted_pending' is acceptable:
 *   - strict auth (verifyAndAttach)        → reject all three reasons
 *   - permissive auth (authenticateAllowDeleted, used only by /restore) →
 *                                            accept 'deleted_pending', reject the other two
 */
export type UnavailableReason = "blocked" | "deleted_pending" | "deleted_expired";

const cacheKey = (userId: string) => `userStatus:${userId}`;
// Sentinel value stored when the User row does not exist — distinguishes a
// negative cache hit from a true Redis miss (which returns null from .get()).
const NOT_FOUND_SENTINEL = "__not_found__";

/**
 * Read-through cached lookup. Returns null if the user row does not exist.
 * Caches both positive AND negative results (UUIDs don't collide so a
 * cached "not found" is safe for the TTL window).
 *
 * Redis failures fall through to DB cleanly and are logged at warn level
 * (Anti-Silent-Failure Rule B compliance — no silent swallowing).
 */
export async function getUserStatus(userId: string): Promise<UserStatus | null> {
  const key = cacheKey(userId);

  // Try cache first
  try {
    const cached = await pubClient.get(key);
    if (cached !== null) {
      if (cached === NOT_FOUND_SENTINEL) return null;
      return JSON.parse(cached.toString()) as UserStatus;
    }
  } catch (err) {
    logger.warn({ err, userId }, "userStatus cache GET failed — falling through to DB");
  }

  // DB fallback
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { isBlocked: true, deletedAt: true },
  });

  const status: UserStatus | null = row
    ? {
        isBlocked: row.isBlocked,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        blockedReason: null,
      }
    : null;

  // Best-effort write-back; failures are non-fatal (next request just hits DB again)
  try {
    const value = status === null ? NOT_FOUND_SENTINEL : JSON.stringify(status);
    await pubClient.set(key, value, { EX: USER_STATUS_TTL });
  } catch (err) {
    logger.warn({ err, userId }, "userStatus cache SET failed — non-fatal");
  }

  return status;
}

/**
 * Composite availability check. Returns a discriminated union so callers can
 * surface the right error message without a second DB call.
 *
 * If the user row is missing (hard-deleted), we treat it as 'deleted_expired'
 * so a stale JWT pointing at a vanished user cannot pass.
 */
export type UnavailabilityCheck =
  | { unavailable: false; status: UserStatus }
  | { unavailable: true; reason: UnavailableReason; status: UserStatus | null };

export async function isUserUnavailable(userId: string): Promise<UnavailabilityCheck> {
  const status = await getUserStatus(userId);
  return evaluateUserStatus(status);
}

/**
 * Pure decision: given a user's status (or null if missing), return whether
 * they're unavailable and why.
 *
 * Use this directly when you already have the User row loaded (e.g. login
 * service has just `findUnique`'d by phone) — avoids the redundant cache+DB
 * round-trip of isUserUnavailable.
 *
 * The decision branches MUST stay byte-equivalent to the auth middleware's
 * view so service-layer defense-in-depth lines up with the route-layer gate.
 */
export function evaluateUserStatus(status: UserStatus | null): UnavailabilityCheck {
  if (status === null) {
    // User vanished (hard-deleted) — reject as expired.
    return { unavailable: true, reason: "deleted_expired", status: null };
  }
  if (status.isBlocked) {
    return { unavailable: true, reason: "blocked", status };
  }
  if (status.deletedAt !== null) {
    const expired = new Date(status.deletedAt).getTime() <= Date.now();
    return {
      unavailable: true,
      reason: expired ? "deleted_expired" : "deleted_pending",
      status,
    };
  }
  return { unavailable: false, status };
}

/**
 * Canonical JSON body for a 401 unavailable-user response. Used by:
 *   - auth middleware (verifyAndAttach, on cache/middleware-side checks)
 *   - auth controller (login error handler, on service-side checks)
 *
 * Keeping the shape in this single file ensures both layers return identical
 * `{ error, status }` payloads for the same reason — frontend can rely on
 * `status` as the machine-readable discriminator.
 */
export const unavailableError = (
  reason: UnavailableReason,
): { error: string; status: UnavailableReason } => {
  switch (reason) {
    case "blocked":
      return { error: "Account blocked", status: "blocked" };
    case "deleted_pending":
      return {
        error: "Account scheduled for deletion. Restore via /api/account/restore.",
        status: "deleted_pending",
      };
    case "deleted_expired":
      return { error: "Account deleted", status: "deleted_expired" };
  }
};

/**
 * Standard owner-visibility filter for public-facing Prisma queries.
 *
 * Combines THREE gates that any "is this owner currently visible to other
 * users?" check must include:
 *   1. `role`             — role allowlist (caller decides which roles)
 *   2. `isBlocked: false` — admin block excludes
 *   3. `deletedAt: null`  — soft-delete excludes (pending OR expired)
 *
 * Returns the inner object to spread into a Prisma `owner: { ... }` clause:
 *
 *   prisma.store.findMany({
 *     where: { owner: visibleOwnerFilter(['retailer']) }
 *   })
 *
 * USE this in any Prisma query where a deleted or blocked owner's content
 * should not appear: store listings, search, product catalogs, feed.
 *
 * DO NOT use for:
 *   - admin views (admin needs to see deleted users for compliance audit)
 *   - self-data queries (auth middleware already gates the caller)
 *   - history reads where the D2 anonymize policy applies instead (e.g.
 *     saved-posts list keeps deleted-owner posts visible with anonymized
 *     author label rather than hiding entirely)
 *
 * Sites relying on this helper today (grep 'visibleOwnerFilter' to audit
 * the enforcement surface area):
 *   - search.service.ts (10 sites — Step 6 / Session 88)
 *
 * Future refactor backlog (Phase E or later) — these files have the same
 * inline pattern from Step 5 and would benefit from migration:
 *   - store.service.ts (4 sites: getStores, getStoreById, getStorePosts, getProducts)
 *   - post.service.ts  (1 site: getFeed)
 *
 * Day 2.5 / Session 88 — answer to D3 + D-Step6-A. The drift between this
 * file and store.service/post.service (search.service was missing isBlocked
 * altogether pre-Day-2.5) is exactly the silent-failure mode this helper
 * prevents.
 */
export const visibleOwnerFilter = (roles: string[]) => ({
  role: { in: roles },
  isBlocked: false,
  deletedAt: null,
});

/**
 * Invalidate the cache for a user. Call this on EVERY write that changes:
 *   - isBlocked          (admin block/unblock)
 *   - deletedAt          (account /delete + /restore)
 *   - (future) blockedReason
 *
 * Idempotent; safe to call even if no cache entry exists.
 *
 * NEVER THROWS. Redis failures are caught, logged at warn level (Rule B),
 * AND surfaced to Sentry for operator visibility. The TTL backstop (60s)
 * means correctness is restored automatically even if invalidation fails —
 * but stale auth checks during the gap matter for security so we want
 * visibility. Callers do not need their own try/catch.
 */
export async function invalidateUserStatusCache(userId: string): Promise<void> {
  try {
    await pubClient.del(cacheKey(userId));
  } catch (err) {
    logger.warn(
      { err, userId },
      "userStatus cache DEL failed — non-fatal (will TTL-expire within 60s)",
    );
    // Capture for visibility — invalidation failures mean auth middleware
    // may see stale user state for up to TTL seconds, so this deserves an
    // alert even though we don't throw.
    Sentry.captureException(err, {
      tags: { component: "userStatus.invalidate" },
      extra: { userId },
    });
  }
}
