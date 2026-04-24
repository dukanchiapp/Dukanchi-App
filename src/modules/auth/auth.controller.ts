import { Request, Response } from "express";
import { AuthService } from "./auth.service";

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const result = await AuthService.signup(req.body);
      res.json(result);
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
      res.json(result);
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
}
