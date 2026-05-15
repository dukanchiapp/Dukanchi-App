import express from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { pubClient } from "../config/redis";
import { isUserUnavailable, unavailableError } from "./user-status";
import { accessBlacklistKey } from "../lib/redis-keys";

const JWT_SECRET = env.JWT_SECRET;

// Redis-backed cache for team member existence (TTL 120s)
//
// NOTE: The former `blocked:${userId}` cache + `isUserBlocked` helper that
// lived here has been replaced by the unified userStatus cache in
// ./user-status.ts (Day 2.5 / Session 88). The TeamMember cache below is
// unchanged — TeamMember has no soft-delete column today.
const TEAM_MEMBER_TTL = 120;
const teamMemberExists = async (teamMemberId: string): Promise<boolean> => {
  const key = `team:${teamMemberId}`;
  try {
    const cached = await pubClient.get(key);
    if (cached !== null) return cached === '1';
  } catch { /* Redis unavailable — fall through to DB */ }
  const member = await prisma.teamMember.findUnique({ where: { id: teamMemberId }, select: { id: true } });
  const exists = !!member;
  try { await pubClient.set(key, exists ? '1' : '0', { EX: TEAM_MEMBER_TTL }); } catch { /* Redis unavailable — non-fatal */ }
  return exists;
};

// Verification policy: whether to allow users within their 30-day deletion
// grace window through. Only set by authenticateAllowDeleted (for /restore
// and /api/auth/refresh) — every other entry point uses { false }.
type VerifyOpts = { acceptDeletedPending: boolean };

// Shared token-verification logic.
// Reject order (each returns early — no fallthrough):
//   1. Missing token                                  → 401 Access denied
//   2. JWT verify failure / malformed payload         → 403 Invalid token
//   3. JWT carries teamMemberId but member is gone    → 403 Access revoked
//   4. User is unavailable (blocked / deleted)        → 401 with discriminator (unless permissive + deleted_pending)
//   5. Otherwise                                      → attach decoded JWT to req.user and call next()
const verifyAndAttach = async (
  token: string | undefined,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  opts: VerifyOpts,
) => {
  if (!token) return res.status(401).json({ error: "Access denied" });
  try {
    // Algorithm whitelist (Day 3 / Session 89): pinned to HS256 to prevent
    // algorithm-confusion attacks (e.g., an attacker submitting an HS512- or
    // RS256-signed token that this server would otherwise accept). jsonwebtoken
    // v9+ already rejects `alg: none` by default; this whitelist is
    // defense-in-depth for the broader algorithm-substitution attack class.
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
    if (!decoded?.userId) return res.status(403).json({ error: "Invalid token" });

    // Symmetric token-type defense — Day 5 / Session 92.
    // New access tokens carry { type: 'access' }; new refresh tokens carry
    // { type: 'refresh' } and are verified via JWT_REFRESH_SECRET (not
    // JWT_SECRET — so a refresh token can't even pass jwt.verify above).
    // But defense-in-depth: if anything ever leaks the refresh secret OR
    // if a future code change accidentally cross-wires the secrets, this
    // explicit check refuses refresh tokens on the access path.
    // Lenient on missing `type` for legacy tokens (pre-Day-5) — those
    // expire naturally within their 7-day TTL during the migration window.
    if (decoded.type && decoded.type !== "access") {
      return res.status(403).json({ error: "Invalid token type" });
    }

    // Access-token blacklist (logout revocation) — Day 5 / Session 92.
    // New tokens carry { jti: <uuid> }; logout SETs accessBlacklistKey(jti).
    // Lenient on missing jti (legacy tokens). One Redis GET per authed
    // request — acceptable cost; if it ever becomes a hot-path concern,
    // shorten access-token TTL further (see redis-keys.ts NOTE).
    if (decoded.jti) {
      try {
        const blacklisted = await pubClient.get(accessBlacklistKey(decoded.jti));
        if (blacklisted) {
          return res.status(401).json({ error: "Token revoked", code: "TOKEN_REVOKED" });
        }
      } catch { /* Redis unavailable — fail-open on blacklist check, fail-closed on auth */ }
    }

    if (decoded.teamMemberId && !(await teamMemberExists(decoded.teamMemberId)))
      return res.status(403).json({ error: "Access revoked" });

    const check = await isUserUnavailable(decoded.userId);
    if (check.unavailable) {
      // Permissive carve-out: deleted_pending (within grace period) is allowed
      // through ONLY for callers that opted in via authenticateAllowDeleted.
      // blocked + deleted_expired remain hard rejects on every path.
      if (check.reason === "deleted_pending" && opts.acceptDeletedPending) {
        (req as any).user = decoded;
        return next();
      }
      return res.status(401).json(unavailableError(check.reason));
    }

    (req as any).user = decoded;
    return next();
  } catch {
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Main-app routes — reads dk_token only; admin sessions (dk_admin_token) are invisible here
export const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.dk_token || req.headers['authorization']?.split(' ')[1];
  return verifyAndAttach(token, req, res, next, { acceptDeletedPending: false });
};

// Admin-panel routes — reads dk_admin_token; falls back to Authorization header
export const authenticateAdminToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.dk_admin_token || req.headers['authorization']?.split(' ')[1];
  return verifyAndAttach(token, req, res, next, { acceptDeletedPending: false });
};

// Shared endpoints (e.g. /api/me) that both apps call — accepts either cookie
export const authenticateAny = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.dk_token || req.cookies?.dk_admin_token || req.headers['authorization']?.split(' ')[1];
  return verifyAndAttach(token, req, res, next, { acceptDeletedPending: false });
};

// PERMISSIVE variant — accepts users in their 30-day deletion grace period
// (deletedAt > NOW()). REJECTS: blocked users, hard-deleted (vanished) users,
// users whose grace has expired (deletedAt <= NOW()).
//
// Wire this ONLY onto endpoints that must remain reachable after a user
// requested account deletion:
//   - POST /api/account/restore   (clears the deletion request)
//   - POST /api/auth/refresh      (lets in-grace users keep their session
//                                  alive for /restore beyond the original 7-day JWT)
// Every other authenticated endpoint MUST use authenticateToken (strict).
//
// (Route wiring is intentionally NOT included in this commit — see Step 3
// where /restore and /refresh are switched over.)
export const authenticateAllowDeleted = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.dk_token || req.headers['authorization']?.split(' ')[1];
  return verifyAndAttach(token, req, res, next, { acceptDeletedPending: true });
};


export const requireAdmin = (req: any, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  return next();
};

const B2B_ROLES = new Set(['retailer', 'supplier', 'brand', 'manufacturer']);

export const canChat = (role1: string, role2: string): boolean => {
  if (role1 === 'customer') return role2 === 'retailer';
  if (role2 === 'customer') return role1 === 'retailer';
  return B2B_ROLES.has(role1) && B2B_ROLES.has(role2);
};
