import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { AccountService } from "./account.service";
import { logger } from "../../lib/logger";

export class AccountController {
  static async requestDeletion(req: Request, res: Response) {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const reason: string | undefined = req.body?.reason;
    try {
      const result = await AccountService.requestDeletion(userId, reason);

      Sentry.addBreadcrumb({
        category: "account",
        message: "Account deletion requested",
        level: "info",
        data: { userId, hasReason: !!reason, deletedAt: result.deletedAt.toISOString() },
      });

      return res.json({
        success: true,
        deletionRequestedAt: result.deletionRequestedAt,
        deletedAt: result.deletedAt,
        gracePeriodDays: 30,
      });
    } catch (error) {
      logger.error({ err: error, userId }, "Account deletion request failed");
      return res.status(500).json({ error: "Failed to request account deletion" });
    }
  }

  static async restore(req: Request, res: Response) {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    try {
      const result = await AccountService.restore(userId);
      if (!result) return res.status(404).json({ error: "User not found" });
      if ("alreadyActive" in result) {
        return res.status(400).json({ error: "Account is not pending deletion" });
      }
      if ("expired" in result) {
        return res.status(410).json({ error: "Grace period expired — account cannot be restored" });
      }

      Sentry.addBreadcrumb({
        category: "account",
        message: "Account deletion cancelled (restored)",
        level: "info",
        data: { userId },
      });

      return res.json({ success: true, restored: true });
    } catch (error) {
      logger.error({ err: error, userId }, "Account restore failed");
      return res.status(500).json({ error: "Failed to restore account" });
    }
  }
}
