import { Request, Response } from "express";
import { AuthService, UnavailableUserError } from "./auth.service";
import { unavailableError } from "../../middlewares/user-status";
import { logger } from "../../lib/logger";

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const result = await AuthService.signup(req.body);

      const isHttps = req.secure ||
        req.headers['x-forwarded-proto'] === 'https' ||
        (req.get('host') || '').includes('ngrok');
      res.cookie('dk_token', result.token, {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      // Include token in body so native (Capacitor) clients can store it.
      // Web clients ignore this — cookie auth works automatically.
      return res.json({ success: true, user: result.user, token: result.token });
    } catch (error: any) {
      // Phone associated with an account in 30-day deletion grace — guide
      // the caller to /restore rather than letting them silently fail.
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

      const isHttps = req.secure ||
        req.headers['x-forwarded-proto'] === 'https' ||
        (req.get('host') || '').includes('ngrok');
      const cookieOptions = {
        httpOnly: true,
        secure: isHttps,
        sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      };

      if (result.user.role === 'admin') {
        // Admin sessions use a dedicated cookie so they never bleed into the main app
        // (both apps share the localhost domain in dev; different domains in prod)
        res.cookie('dk_admin_token', result.token, cookieOptions);
      } else {
        res.cookie('dk_token', result.token, cookieOptions);
      }

      // Include token in body so native (Capacitor) clients can store it.
      // Web clients ignore this — cookie auth works automatically.
      return res.json({ success: true, user: result.user, token: result.token });
    } catch (error: any) {
      // Service-layer availability check (Day 2.5) — matches the 401 +
      // `status` discriminator shape returned by the auth middleware for
      // the same reasons. Single source of truth via unavailableError().
      if (error instanceof UnavailableUserError) {
        return res.status(401).json(unavailableError(error.unavailableReason));
      }
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: error.message });
      }
      // Legacy "blocked" message-string path — unreachable now that the
      // service throws UnavailableUserError instead, but kept as a safety
      // net in case any caller still constructs the old-style error.
      if (error.message.includes("blocked")) {
        return res.status(403).json({ error: error.message });
      }
      logger.error({ err: error }, "Login error");
      return res.status(500).json({ error: "Login failed" });
    }
  }

  static async logout(req: Request, res: Response) {
    const isHttps = req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      (req.get('host') || '').includes('ngrok');
    const clearOpts = { httpOnly: true, secure: isHttps, sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax', path: '/' };
    res.clearCookie('dk_token', clearOpts);
    res.clearCookie('dk_admin_token', clearOpts);
    return res.json({ ok: true });
  }

  static async refresh(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      // Permissive: a user in their 30-day deletion grace must be able to
      // refresh their session so they can call /api/account/restore beyond
      // the original 7-day JWT TTL. blocked + deleted_expired are still
      // rejected (returns null) by issueTokenForUser regardless of opts.
      const newToken = await AuthService.issueTokenForUser(userId, { acceptDeletedPending: true });
      if (!newToken) return res.status(401).json({ error: 'User not found or unavailable' });

      const isHttps = req.secure ||
        req.headers['x-forwarded-proto'] === 'https' ||
        (req.get('host') || '').includes('ngrok');
      const cookieOptions = {
        httpOnly: true,
        secure: isHttps,
        sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      };
      res.cookie('dk_token', newToken, cookieOptions);
      return res.json({ success: true, token: newToken });
    } catch (error: any) {
      logger.error({ err: error }, 'Token refresh failed');
      return res.status(500).json({ error: 'Refresh failed' });
    }
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
