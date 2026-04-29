import { Router } from "express";
import { MessageController } from "./message.controller";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { messageLimiter } from "../../middlewares/rate-limiter.middleware";
import { validate } from "../../../validators/validate";
import { sendMessageSchema } from "../../../validators/schemas";

const router = Router();

// /api/messages
router.get("/conversations", authenticateToken, MessageController.getConversations);
router.get("/:otherUserId", authenticateToken, MessageController.getMessages);
router.post("/", authenticateToken, messageLimiter, validate(sendMessageSchema), MessageController.sendMessage);

export const messageRoutes = router;
