import { Request, Response } from "express";
import { KycService } from "./kyc.service";

export class KycController {
  static async submitKyc(req: Request, res: Response) {
    if ((req as any).user.role === 'admin') {
      return res.status(403).json({ error: "Admin accounts cannot submit KYC" });
    }
    try {
      const userId = (req as any).user.userId;
      const user = await KycService.submitKyc(userId, req.body);
      return res.json(user);
    } catch (error) {
      return res.status(500).json({ error: "Failed to submit KYC" });
    }
  }

  static async getKycStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await KycService.getKycStatus(userId);
      return res.json(user);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch KYC status" });
    }
  }
}
