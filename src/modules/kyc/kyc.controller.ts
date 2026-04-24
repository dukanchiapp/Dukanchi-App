import { Request, Response } from "express";
import { KycService } from "./kyc.service";

export class KycController {
  static async submitKyc(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await KycService.submitKyc(userId, req.body);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit KYC" });
    }
  }

  static async getKycStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await KycService.getKycStatus(userId);
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch KYC status" });
    }
  }
}
