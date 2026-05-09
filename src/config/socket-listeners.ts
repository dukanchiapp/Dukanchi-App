import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { canChat } from "../middlewares/auth.middleware";
import { notificationQueue } from "./bullmq";
import { env } from "./env";

const JWT_SECRET = env.JWT_SECRET;

export function setupSocketListeners(io: Server) {
  io.use((socket: Socket, next) => {
    const handshakeId = Math.random().toString(36).slice(2, 8);
    const hasAuthToken = !!socket.handshake.auth?.token;
    const hasCookieHeader = !!socket.handshake.headers.cookie;
    const cookieHeaderSnippet = (socket.handshake.headers.cookie || '').slice(0, 80);
    const origin = socket.handshake.headers.origin || '(no origin)';

    console.log(`[SOCKET-AUTH][${handshakeId}] handshake start — origin=${origin}, hasAuthToken=${hasAuthToken}, hasCookieHeader=${hasCookieHeader}, cookieHeader="${cookieHeaderSnippet}..."`);

    let token = socket.handshake.auth?.token;
    let tokenSource = 'auth.token';

    if (!token && socket.handshake.headers.cookie) {
      const match = socket.handshake.headers.cookie.match(/dk_token=([^;]+)/);
      if (match) {
        token = match[1];
        tokenSource = 'cookie';
      }
    }

    if (!token) {
      console.error(`[SOCKET-AUTH][${handshakeId}] ❌ NO TOKEN found — auth.token missing AND dk_token cookie missing. Rejecting.`);
      return next(new Error('Authentication error: Token missing'));
    }

    console.log(`[SOCKET-AUTH][${handshakeId}] ✓ token found via ${tokenSource}, length=${token.length}`);

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        console.error(`[SOCKET-AUTH][${handshakeId}] ❌ JWT verify FAILED:`, err.message);
        return next(new Error('Authentication error: Invalid token'));
      }
      (socket as any).user = decoded;
      console.log(`[SOCKET-AUTH][${handshakeId}] ✅ AUTH OK — userId=${decoded.userId}, role=${decoded.role}`);
      next();
    });
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).user.userId;

    // Automatically join the user to a room of their own ID to receive private messages
    socket.join(userId);
    console.log(`[SOCKET-CONN] ✅ user ${userId} connected, joined room ${userId}, socket=${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET-CONN] 🔌 user ${userId} disconnected — reason=${reason}, socket=${socket.id}`);
    });

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
    
  });
}
