import { prisma } from "../../config/prisma";
import { getIO } from "../../config/socket";
import { canChat } from "../../middlewares/auth.middleware";

export class MessageService {
  static async getMessages(userId: string, otherUserId: string, before?: string, limit: number = 100) {
    const take = Math.min(limit, 100);

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId }
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    });

    const hasMore = messages.length > take;
    if (hasMore) messages.pop();
    messages.reverse(); // ascending order for display

    return { messages, hasMore, nextCursor: hasMore ? messages[0]?.id : null };
  }

  static async sendMessage(senderId: string, receiverId: string, messageText: string, imageUrl?: string) {
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    
    if (!sender || !receiver) throw new Error("User not found");
    if (!canChat(sender.role, receiver.role)) throw new Error("Chat not permitted between these roles");

    const savedMessage = await prisma.message.create({
      data: { senderId, receiverId, message: messageText || '', imageUrl: imageUrl || null }
    });

    try {
      const io = getIO();
      io.to(receiverId).emit("newMessage", savedMessage);
      io.to(senderId).emit("newMessage", savedMessage);
    } catch (err) {
      console.warn("Socket.io emit failed (might not be initialized in this context)", err);
    }

    return savedMessage;
  }
}
