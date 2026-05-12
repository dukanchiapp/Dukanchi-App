import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import { canChat } from "../middlewares/auth.middleware";
import { isUserUnavailable, evaluateUserStatus } from "../middlewares/user-status";
import { notificationQueue } from "./bullmq";
import { env } from "./env";

const JWT_SECRET = env.JWT_SECRET;

export function setupSocketListeners(io: Server) {
  // Day 2.5 / Session 88: socket auth now matches HTTP auth — verifies JWT
  // AND checks user availability (blocked, deleted_pending, deleted_expired).
  //
  // Before this change, a soft-deleted user's WebSocket connection could
  // outlive their account deletion request by up to 7 days (JWT TTL). HTTP
  // requests would 401 but socket messages would still flow. Closing that
  // gap here. Per-message defense-in-depth follows below in sendMessage.
  io.use(async (socket: Socket, next) => {
    let token = socket.handshake.auth?.token;

    if (!token && socket.handshake.headers.cookie) {
      const match = socket.handshake.headers.cookie.match(/dk_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err: any) {
      console.warn('[SOCKET] auth rejected: JWT invalid —', err?.message ?? err);
      return next(new Error('Authentication error: Invalid token'));
    }

    if (!decoded?.userId) {
      console.warn('[SOCKET] auth rejected: JWT missing userId');
      return next(new Error('Authentication error: Invalid token'));
    }

    // User availability gate — same predicate as HTTP middleware
    const check = await isUserUnavailable(decoded.userId);
    if (check.unavailable) {
      console.warn(`[SOCKET] auth rejected: user=${decoded.userId} reason=${check.reason}`);
      return next(new Error(`Authentication error: ${check.reason}`));
    }

    (socket as any).user = decoded;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).user.userId;

    // Automatically join the user to a room of their own ID to receive private messages
    socket.join(userId);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SOCKET] connect user=${userId} sid=${socket.id}`);
    }

    socket.on('disconnect', (reason) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SOCKET] disconnect user=${userId} reason=${reason}`);
      }
    });

    socket.on("sendMessage", async (data) => {
      try {
        const { receiverId, message } = data;
        const senderId = userId;

        const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
        const sender = await prisma.user.findUnique({ where: { id: senderId } });

        if (!receiver || !sender) {
          console.warn(`[SOCKET] sendMessage drop: user not found (sender=${!!sender} receiver=${!!receiver})`);
          return;
        }

        // Day 2.5 defense-in-depth: io.use middleware admitted us at connect
        // time, but a user may have soft-deleted (or been blocked) WHILE
        // their socket was alive. Re-check both parties on every message.
        // Uses the cached userStatus path so the cost is one Redis GET per
        // user per minute (cache TTL = 60s).
        const senderCheck = evaluateUserStatus({
          isBlocked: sender.isBlocked,
          deletedAt: sender.deletedAt?.toISOString() ?? null,
          blockedReason: null,
        });
        const receiverCheck = evaluateUserStatus({
          isBlocked: receiver.isBlocked,
          deletedAt: receiver.deletedAt?.toISOString() ?? null,
          blockedReason: null,
        });
        if (senderCheck.unavailable || receiverCheck.unavailable) {
          console.warn(
            `[SOCKET] sendMessage drop: ` +
              `sender=${senderCheck.unavailable ? senderCheck.reason : "ok"} ` +
              `receiver=${receiverCheck.unavailable ? receiverCheck.reason : "ok"}`,
          );
          return; // Silent drop — see Rule B note below
        }

        if (!canChat(sender.role, receiver.role)) {
          console.warn(`[SOCKET] sendMessage drop: chat not permitted (${sender.role} → ${receiver.role})`);
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
