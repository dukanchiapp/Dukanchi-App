import { Request, Response } from "express";
import { AuthService } from "./auth.service";
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
      res.json({ success: true, user: result.user, token: result.token });
    } catch (error: any) {
      if (error.message === "This phone number already exists") {
        return res.status(400).json({ error: error.message });
      }
      logger.error({ err: error }, "Signup error");
      res.status(500).json({ error: "Failed to create user" });
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
      res.json({ success: true, user: result.user, token: result.token });
    } catch (error: any) {
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: error.message });
      }
      if (error.message.includes("blocked")) {
        return res.status(403).json({ error: error.message });
      }
      logger.error({ err: error }, "Login error");
      res.status(500).json({ error: "Login failed" });
    }
  }

  static async logout(req: Request, res: Response) {
    const isHttps = req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      (req.get('host') || '').includes('ngrok');
    const clearOpts = { httpOnly: true, secure: isHttps, sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax', path: '/' };
    res.clearCookie('dk_token', clearOpts);
    res.clearCookie('dk_admin_token', clearOpts);
    res.json({ ok: true });
  }

  static async refresh(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });

      const newToken = await AuthService.issueTokenForUser(userId);
      if (!newToken) return res.status(401).json({ error: 'User not found or blocked' });

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
      res.json({ success: true, token: newToken });
    } catch (error: any) {
      logger.error({ err: error }, 'Token refresh failed');
      res.status(500).json({ error: 'Refresh failed' });
    }
  }

  static async me(req: any, res: Response) {
    try {
      const { prisma } = await import("../../config/prisma");
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      logger.error({ err: error }, "Me route error");
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  }
}
