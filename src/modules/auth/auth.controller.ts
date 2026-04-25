import { Request, Response } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const result = await AuthService.signup(req.body);
      
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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
      res.cookie('token', result.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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
    res.clearCookie('token');
    res.json({ success: true, message: "Logged out successfully" });
  }
}
