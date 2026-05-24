import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import { NotificationService } from "./notification.service";
import { logger } from "../../lib/logger";

export class NotificationController {
  static async getNotifications(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const notifications = await NotificationService.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      logger.error(
        { err: error, route: req.originalUrl, userId: (req as any).user?.userId, method: req.method },
        "notification.list failed",
      );
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const notification = await NotificationService.markAsRead(req.params.id, userId);
      res.json(notification);
    } catch (error) {
      logger.error(
        { err: error, route: req.originalUrl, userId: (req as any).user?.userId, method: req.method },
        "notification.markAsRead failed",
      );
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const result = await NotificationService.markAllAsRead(userId);
      res.json(result);
    } catch (error) {
      logger.error(
        { err: error, route: req.originalUrl, userId: (req as any).user?.userId, method: req.method },
        "notification.markAllAsRead failed",
      );
      Sentry.captureException(error, {
        extra: { route: req.originalUrl, userId: (req as any).user?.userId },
      });
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  }
}
