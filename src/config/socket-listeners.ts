import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { canChat } from "../middlewares/auth.middleware";
import { notificationQueue } from "./bullmq";

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export function setupSocketListeners(io: Server) {
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) return next(new Error('Authentication error: Invalid token'));
      // Attach user information to the socket for later use
      (socket as any).user = decoded;
      next();
    });
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).user.userId;
    
    // Automatically join the user to a room of their own ID to receive private messages
    socket.join(userId);
    
    socket.on("sendMessage", async (data) => {
      try {
        const { receiverId, message } = data;
        const senderId = userId;
        
        const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
        const sender = await prisma.user.findUnique({ where: { id: senderId } });
        
        if (!receiver || !sender || !canChat(sender.role, receiver.role)) {
          console.error("Chat permission denied for", sender?.role, "to", receiver?.role);
          return; // Silent drop of unauthorized message
        }
        
        const savedMessage = await prisma.message.create({
          data: { senderId, receiverId, message, imageUrl: data.imageUrl || null }
        });
        
        io.to(receiverId).emit("newMessage", savedMessage);
        io.to(senderId).emit("newMessage", savedMessage); // echo back to sender

        // Auto-reply: first message from a customer to a retailer triggers a BullMQ delayed job
        if (receiver?.role === 'retailer' && sender?.role === 'customer') {
          const previousMessages = await prisma.message.count({ where: { senderId, receiverId } });
          if (previousMessages === 1) {
            const store = await prisma.store.findFirst({ where: { ownerId: receiverId } });
            if (store) {
              await notificationQueue.add('autoReply', {
                senderId,
                receiverId,
                storeName: store.storeName,
                senderName: sender.name,
                storePhone: store.phone,
                storeAddress: store.address,
              }, { delay: 1000 });
            }
          }
        }
      } catch (error) {
        console.error("Failed to save message:", error);
      }
    });
    
    socket.on("disconnect", () => {});
  });
}
