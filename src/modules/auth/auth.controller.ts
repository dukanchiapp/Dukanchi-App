import { Request, Response } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const result = await AuthService.signup(req.body);
      
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('dk_token', result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      res.json({ success: true, user: result.user });
    } catch (error: any) {
      if (error.message === "This phone number already exists") {
        return res.status(400).json({ error: error.message });
      }
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const result = await AuthService.login(req.body);

      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('dk_token', result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });

      res.json({ success: true, user: result.user });
    } catch (error: any) {
      if (error.message === "Invalid credentials") {
        return res.status(401).json({ error: error.message });
      }
      if (error.message.includes("blocked")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  }

  static async logout(req: Request, res: Response) {
    res.clearCookie('dk_token', { path: '/' });
    res.json({ ok: true });
  }

  static async me(req: any, res: Response) {
    try {
      const { prisma } = await import("../../config/prisma");
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Me route error:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  }
}
