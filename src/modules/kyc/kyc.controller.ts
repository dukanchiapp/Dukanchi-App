import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { KycService } from "./kyc.service";
import { logger } from "../../lib/logger";

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
      logger.error(
        { err: error, route: req.originalUrl, userId: (req as any).user?.userId, method: req.method },
        "kyc.submit failed",
      );
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      return res.status(500).json({ error: "Failed to submit KYC" });
    }
  }

  static async getKycStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await KycService.getKycStatus(userId);
      return res.json(user);
    } catch (error) {
      logger.error(
        { err: error, route: req.originalUrl, userId: (req as any).user?.userId, method: req.method },
        "kyc.getStatus failed",
      );
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      return res.status(500).json({ error: "Failed to fetch KYC status" });
    }
  }
}
