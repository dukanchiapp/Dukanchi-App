import { Request, Response } from "express";
import { MiscService } from "./misc.service";
import { logger } from "../../lib/logger";

export class MiscController {
  static async submitComplaint(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { issueType, description } = req.body;
      const complaint = await MiscService.submitComplaint(userId, issueType, description);
      return res.json(complaint);
    } catch (error) {
      logger.error({ err: error }, "Failed to create complaint");
      return res.status(500).json({ error: "Failed to submit complaint" });
    }
  }

  static async submitReport(req: Request, res: Response) {
    try {
      const reportedByUserId = (req as any).user.userId;
      const { reason, reportedUserId, reportedStoreId } = req.body;
      const report = await MiscService.submitReport(reportedByUserId, reason, reportedUserId, reportedStoreId);
      return res.json(report);
    } catch (error: any) {
      if (error.message === "reportedUserId or reportedStoreId is required") {
        return res.status(400).json({ error: error.message });
      }
      logger.error({ err: error }, "Failed to create report");
      return res.status(500).json({ error: "Failed to submit report" });
    }
  }

  static async getStoreReviews(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20" } = req.query;
      const result = await MiscService.getStoreReviews(req.params.storeId, parseInt(page as string), parseInt(limit as string));
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch store reviews" });
    }
  }

  static async getProductReviews(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20" } = req.query;
      const result = await MiscService.getProductReviews(req.params.productId, parseInt(page as string), parseInt(limit as string));
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch product reviews" });
    }
  }

  static async createReview(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const newReview = await MiscService.createReview(userId, req.body);
      return res.json(newReview);
    } catch (error: any) {
      if (error.message === "Must review either a store or a product" || error.message === "Cannot review both store and product at once") {
        return res.status(400).json({ error: error.message });
      }
      logger.error({ err: error }, "Failed to post review");
      return res.status(500).json({ error: "Failed to save review" });
    }
  }

  static async getAppSettings(_req: Request, res: Response) {
    try {
      const settings = await MiscService.getAppSettings();
      res.set('Cache-Control', 'public, max-age=300');
      return res.json(settings);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch app settings" });
    }
  }
}
