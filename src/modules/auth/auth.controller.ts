/**
 * Auth controller — Day 5 / Session 92.
 *
 * Owns the HTTP↔service↔cookie surface for /api/auth/*. The actual token
 * minting logic lives in:
 *   - signAccessToken (auth.service.ts) — short-lived JWT
 *   - generateRefreshToken, verifyRefreshToken, rotateFromVerifiedPayload,
 *     revokeRefreshToken, detectReuseAndRevokeFamily (refreshToken.service.ts)
 *     — refresh rotation + theft detection
 *
 * Controller responsibilities (per Service/Controller split confirmed in
 * Phase 2 review): policy decisions (cookie routing, user-status carve-out
 * checks, response shaping). Service responsibilities: state transitions
 * (Redis writes, JWT minting/verifying).
 *
 * Cookie scheme:
 *   - Customer/retailer/etc: `dk_token` (15min access) + `dk_refresh` (30d, path=/api/auth)
 *   - Admin:                 `dk_admin_token` + `dk_admin_refresh` (same)
 *   - Refresh cookie path is scoped to /api/auth so it's only sent on
 *     refresh/logout, reducing CSRF surface across the rest of the API.
 *   - sameSite='strict' for app refresh cookie; 'none' for admin (which is
 *     cross-origin in production). Trade-off: admin loses sameSite-based
 *     CSRF defense; gains cross-origin operation. App keeps both.
 *
 * Native-client compat (Capacitor):
 *   - Login + refresh responses include `accessToken` + `refreshToken` in
 *     the body so native clients can persist them in localStorage. Web
 *     clients ignore the body and use cookies. (Day 5 spec said don't
 *     expose tokens in /refresh body, but our native architecture relies
 *     on body fields — documented as ND.)
 */
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthService, UnavailableUserError, signAccessToken } from "./auth.service";
import { unavailableError, isUserUnavailable } from "../../middlewares/user-status";
import { logger } from "../../lib/logger";
import { pubClient } from "../../config/redis";
import {
  generateRefreshToken,
  verifyRefreshToken,
  rotateFromVerifiedPayload,
  detectReuseAndRevokeFamily,
  revokeRefreshToken,
  RefreshTokenError,
} from "../../services/refreshToken.service";
import {
  accessBlacklistKey,
  ACCESS_TOKEN_TTL_SECONDS,
} from "../../lib/redis-keys";

// ── Helpers ─────────────────────────────────────────────────────────────────

const ACCESS_COOKIE_MAX_AGE_MS = ACCESS_TOKEN_TTL_SECONDS * 1000;
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function detectIsHttps(req: Request): boolean {
  return (
    req.secure ||
    req.headers["x-forwarded-proto"] === "https" ||
    (req.get("host") || "").includes("ngrok")
  );
}

/**
 * Set BOTH cookies (access + refresh) routed by role. Centralizes the
 * dual-cookie scheme so every issuance path (signup / login / refresh)
 * stays in sync.
 *
 * Fixes ND #2 from Day 5 audit: prior implementation always set dk_token
 * even for admin role. This helper routes by `role === 'admin'` to the
 * correct cookie pair every time.
 */
function setAuthCookies(
  res: Response,
  isHttps: boolean,
  role: string,
  accessToken: string,
  refreshToken: string,
): void {
  const isAdmin = role === "admin";
  const accessName = isAdmin ? "dk_admin_token" : "dk_token";
  const refreshName = isAdmin ? "dk_admin_refresh" : "dk_refresh";

  // Access cookie — broad path so authenticated API requests carry it.
  res.cookie(accessName, accessToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    maxAge: ACCESS_COOKIE_MAX_AGE_MS,
    path: "/",
  });

  // Refresh cookie — path-scoped to /api/auth so it's NOT sent on every
  // request, reducing CSRF surface. sameSite=strict for app users (same-
  // origin) gives free CSRF defense on the refresh endpoint itself.
  // Admin is cross-origin so needs sameSite='none' (HTTPS) regardless.
  const refreshSameSite: "strict" | "none" | "lax" = isAdmin
    ? isHttps ? "none" : "lax"
    : isHttps ? "strict" : "lax";

  res.cookie(refreshName, refreshToken, {
    httpOnly: true,
    secure: isHttps,
    sameSite: refreshSameSite,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    path: "/api/auth",
  });
}

/**
 * Clear BOTH cookies for both surfaces (app + admin) defensively. We
 * don't know which surface the caller was authenticated against, so clear
 * everything. clearCookie is idempotent for cookies that don't exist.
 */
function clearAuthCookies(res: Response, isHttps: boolean): void {
  const baseOpts = {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
  };
  res.clearCookie("dk_token", { ...baseOpts, path: "/" });
  res.clearCookie("dk_admin_token", { ...baseOpts, path: "/" });
  res.clearCookie("dk_refresh", { ...baseOpts, path: "/api/auth" });
  res.clearCookie("dk_admin_refresh", { ...baseOpts, path: "/api/auth" });
}

/**
 * Best-effort access-token blacklist for logout. Decodes (NOT verifies) the
 * current access cookie to extract jti. Sets accessBlacklistKey(jti) so
 * subsequent requests with this token are rejected by authenticateToken.
 *
 * - Decoded WITHOUT verify because we want to blacklist even if the token
 *   is borderline-expired (15 min — race between client and server).
 * - Legacy tokens (pre-Day-5) lack jti and can't be blacklisted via this
 *   path; they'll expire naturally within their 7-day TTL.
 * - All failures are logged and swallowed — logout MUST succeed even if
 *   blacklist write fails (the cookie clear is the user-visible action).
 */
async function blacklistAccessTokenIfPresent(
  accessToken: string | undefined,
): Promise<void> {
  if (!accessToken) return;
  try {
    const decoded = jwt.decode(accessToken) as { jti?: string } | null;
    if (!decoded?.jti) {
      logger.info(
        { event: "logout.access_blacklist.skipped", reason: "no_jti" },
        "Skipping access blacklist — token has no jti (likely legacy)",
      );
      return;
    }
    await pubClient.set(accessBlacklistKey(decoded.jti), "logout", {
      EX: ACCESS_TOKEN_TTL_SECONDS,
    });
    logger.info(
      { event: "logout.access_blacklist.set", jti: decoded.jti },
      "Access token jti blacklisted for logout",
    );
  } catch (err) {
    logger.warn(
      { event: "logout.access_blacklist.failed", err },
      "Access token blacklist failed — proceeding with cookie clear anyway",
    );
  }
}

// ── Controller ──────────────────────────────────────────────────────────────

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const result = await AuthService.signup(req.body);
      const isHttps = detectIsHttps(req);

      setAuthCookies(
        res,
        isHttps,
        result.user.role,
        result.accessToken,
        result.refreshToken,
      );

      // Native (Capacitor) clients read tokens from body to persist in
      // localStorage. Web clients ignore body fields. The `token` alias
      // preserves backward-compat with native code that hasn't yet shipped
      // the Day 5 refresh-token-aware client.
      return res.json({
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        token: result.accessToken,
      });
    } catch (error: any) {
      if (error instanceof UnavailableUserError) {
        return res.status(401).json(unavailableError(error.unavailableReason));
      }
      if (error.message === "This phone number already exists") {
        return res.status(400).json({ error: error.message });
      }
      logger.error({ err: error }, "Signup error");
      return res.status(500).json({ error: "Failed to create user" });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const result = await AuthService.login(req.body);
      const isHttps = detectIsHttps(req);

      setAuthCookies(
        res,
        isHttps,
        result.user.role,
        result.accessToken,
        result.refreshToken,
      );

      return res.json({
        success: true,
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        token: result.accessToken,
        ...(result.isTeamMember ? { isTeamMember: true } : {}),
      });
    } catch (error: any) {
      if (error instanceof UnavailableUserError) {
        return res.status(401).json(unavailableError(error.unavailableReason));
      }
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: error.message });
      }
      if (error.message?.includes("blocked")) {
        return res.status(403).json({ error: error.message });
      }
      logger.error({ err: error }, "Login error");
      return res.status(500).json({ error: "Login failed" });
    }
  }

  static async logout(req: Request, res: Response) {
    const isHttps = detectIsHttps(req);

    // 1. Blacklist the current access token (if any) so it can't be used
    //    again even before its 15-min expiry. Best-effort — never blocks
    //    the cookie-clear that follows.
    const accessToken =
      req.cookies?.dk_token ||
      req.cookies?.dk_admin_token ||
      req.headers["authorization"]?.split(" ")[1];
    await blacklistAccessTokenIfPresent(accessToken);

    // 2. Revoke the refresh token (if any). This removes it from the active
    //    set and blacklists its jti so subsequent rotation attempts fail.
    //    Does NOT revoke the whole family — other devices keep their sessions.
    const refreshToken = req.cookies?.dk_refresh || req.cookies?.dk_admin_refresh;
    if (refreshToken) {
      try {
        const payload = await verifyRefreshToken(refreshToken);
        await revokeRefreshToken(payload.jti, payload.userId);
      } catch (err) {
        // Already expired / invalid / blacklisted — log and continue.
        // Logout must still clear the user's cookies.
        logger.info(
          {
            event: "logout.refresh_revoke.skipped",
            err: err instanceof RefreshTokenError ? err.code : "unknown",
          },
          "Refresh token revoke skipped (token already invalid or expired)",
        );
      }
    }

    // 3. Clear all four possible auth cookies (app + admin × access + refresh).
    clearAuthCookies(res, isHttps);
    return res.json({ ok: true });
  }

  static async refresh(req: Request, res: Response) {
    const isHttps = detectIsHttps(req);

    // Read refresh token — three sources, in priority order:
    //   1. dk_admin_refresh cookie (admin panel, set on admin login)
    //   2. dk_refresh cookie (PWA web — set on customer/retailer login)
    //   3. X-Refresh-Token header (native Capacitor clients — cookies
    //      unreliable in WebView; native sends the refresh token from
    //      localStorage as an explicit header)
    // The header path is redacted in pinoHttp + logger so it never lands
    // in structured logs (defense in depth — Day 5 / Phase 4 Q6).
    const headerRefreshToken = req.headers["x-refresh-token"];
    const refreshToken =
      req.cookies?.dk_admin_refresh ||
      req.cookies?.dk_refresh ||
      (typeof headerRefreshToken === "string" ? headerRefreshToken : undefined);

    if (!refreshToken) {
      return res
        .status(401)
        .json({ error: "Refresh token missing", code: "NO_REFRESH_TOKEN" });
    }

    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch (err) {
      if (err instanceof RefreshTokenError) {
        // REUSE_DETECTED is the theft signal — revoke the entire family
        // (forces both attacker and legit user back to login).
        if (err.code === "REUSE_DETECTED" && err.context) {
          await detectReuseAndRevokeFamily(
            err.context.userId!,
            err.context.familyId!,
          );
        }
        // For any refresh-token failure, clear cookies defensively so the
        // client can't keep trying with a known-bad token.
        clearAuthCookies(res, isHttps);
        return res
          .status(401)
          .json({ error: "Refresh token invalid", code: err.code });
      }
      logger.error({ err }, "Unexpected error verifying refresh token");
      return res.status(500).json({ error: "Refresh failed" });
    }

    // Day 2.5 carve-out preserved: deleted_pending users CAN refresh so
    // they remain able to reach /api/account/restore beyond the original
    // access-token TTL. blocked + deleted_expired are still rejected.
    const status = await isUserUnavailable(payload.userId);
    if (status.unavailable && status.reason !== "deleted_pending") {
      // Hard rejection — also revoke this refresh token so it can't be
      // replayed (the user account is gone or blocked).
      await revokeRefreshToken(payload.jti, payload.userId);
      clearAuthCookies(res, isHttps);
      return res.status(401).json(unavailableError(status.reason));
    }

    // Rotate: blacklist old jti, mint new refresh in same family + new access.
    const rotation = await rotateFromVerifiedPayload(payload);
    const { token: newAccessToken } = signAccessToken({
      userId: rotation.userId,
      role: rotation.role,
      ...(rotation.teamMemberId ? { teamMemberId: rotation.teamMemberId } : {}),
    });

    setAuthCookies(
      res,
      isHttps,
      rotation.role,
      newAccessToken,
      rotation.newToken,
    );

    // Native clients need tokens in the body to update localStorage.
    // Day 5 spec said "don't expose tokens in /refresh body" — documented
    // as ND because our Capacitor architecture relies on body fields. The
    // pinoHttp redact paths (Day 4) already prevent these from being
    // logged.
    return res.json({
      ok: true,
      accessToken: newAccessToken,
      refreshToken: rotation.newToken,
      token: newAccessToken,
    });
  }

  static async me(req: any, res: Response) {
    try {
      const { prisma } = await import("../../config/prisma");
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      logger.error({ err: error }, "Me route error");
      return res.status(500).json({ error: "Failed to fetch user profile" });
    }
  }
}

