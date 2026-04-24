import { Router } from "express";
import { NotificationController } from "./notification.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";

const router = Router();

// /api/notifications
router.get("/", authenticateToken, NotificationController.getNotifications);
router.post("/read-all", authenticateToken, NotificationController.markAllAsRead);
router.post("/:id/read", authenticateToken, NotificationController.markAsRead);

export const notificationRoutes = router;
