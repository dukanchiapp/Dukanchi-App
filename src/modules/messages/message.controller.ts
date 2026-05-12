import { Request, Response } from "express";
import { MessageService, ChatRejectionError } from "./message.service";
import { unavailableError } from "../../middlewares/user-status";
import { logger } from "../../lib/logger";

export class MessageController {
  static async getMessages(req: Request, res: Response) {
    try {
      const authenticatedUserId = (req as any).user.userId;
      const { otherUserId } = req.params;
      const { before, limit = '100' } = req.query as any;
      const result = await MessageService.getMessages(
        authenticatedUserId,
        otherUserId,
        before,
        parseInt(limit)
      );
      return res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch messages');
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  static async getConversations(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const convos = await MessageService.getConversations(userId);
      return res.json(convos);
    } catch (error) {
      return res.status(500).json({ error: "Failed to fetch conversations" });
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const senderId = (req as any).user.userId;
      const { receiverId, message, imageUrl } = req.body;

      const savedMessage = await MessageService.sendMessage(senderId, receiverId, message, imageUrl);
      return res.json(savedMessage);
    } catch (error: any) {
      // Day 2.5 cascade: one or both parties unavailable.
      if (error instanceof ChatRejectionError) {
        if (error.subject === "sender") {
          // Defense-in-depth: middleware should already have caught this.
          // Use the same 401 + status discriminator shape as the auth layer.
          return res.status(401).json(unavailableError(error.reason));
        }
        // Recipient-specific mapping — gives chat UI enough signal to render a
        // helpful message ("This account is being deleted" vs "User not found").
        switch (error.reason) {
          case "deleted_expired":
            return res.status(404).json({ error: "Recipient not found", status: "deleted_expired" });
          case "deleted_pending":
            return res.status(410).json({
              error: "Recipient account is being deleted and cannot receive new messages.",
              status: "deleted_pending",
            });
          case "blocked":
            return res.status(403).json({ error: "Recipient account is blocked", status: "blocked" });
        }
      }

      if (error.message === "User not found") return res.status(404).json({ error: "User not found" });
      if (error.message === "Chat not permitted between these roles") return res.status(403).json({ error: "Chat not permitted between these roles" });

      logger.error({ err: error }, "Failed to send message");
      return res.status(500).json({ error: "Failed to send message" });
    }
  }
}
