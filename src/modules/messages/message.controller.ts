import { Request, Response } from "express";
import { MessageService } from "./message.service";
import { prisma } from "../../config/prisma";
import { canChat } from "../../middlewares/auth.middleware";

export class MessageController {
  static async getMessages(req: Request, res: Response) {
    try {
      const { userId, otherUserId } = req.params;
      const authenticatedUserId = (req as any).user.userId;
      const authenticatedUserRole = (req as any).user.role;

      if (authenticatedUserId !== userId && authenticatedUserId !== otherUserId) {
        return res.status(403).json({ error: "Unauthorized access to these messages" });
      }

      const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
      if (!otherUser || !canChat(authenticatedUserRole, otherUser.role)) {
        return res.status(403).json({ error: "Role permissions do not allow chatting with this user" });
      }

      const { before, limit = "100" } = req.query as any;
      const result = await MessageService.getMessages(userId, otherUserId, before, parseInt(limit));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  }

  static async getConversations(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const convos = await MessageService.getConversations(userId);
      res.json(convos);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const senderId = (req as any).user.userId;
      const { receiverId, message, imageUrl } = req.body;
      
      const savedMessage = await MessageService.sendMessage(senderId, receiverId, message, imageUrl);
      res.json(savedMessage);
    } catch (error: any) {
      if (error.message === "User not found") return res.status(404).json({ error: "User not found" });
      if (error.message === "Chat not permitted between these roles") return res.status(403).json({ error: "Chat not permitted between these roles" });
      
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  }
}
