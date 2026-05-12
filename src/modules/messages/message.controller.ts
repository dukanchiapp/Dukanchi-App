import { Request, Response } from "express";
import { MessageService } from "./message.service";
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
      if (error.message === "User not found") return res.status(404).json({ error: "User not found" });
      if (error.message === "Chat not permitted between these roles") return res.status(403).json({ error: "Chat not permitted between these roles" });
      
      logger.error({ err: error }, "Failed to send message");
      return res.status(500).json({ error: "Failed to send message" });
    }
  }
}
