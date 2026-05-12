import * as Sentry from "@sentry/node";
import { prisma } from "../../config/prisma";
import { getIO } from "../../config/socket";
import { canChat } from "../../middlewares/auth.middleware";
import { evaluateUserStatus, UnavailableReason } from "../../middlewares/user-status";
import { sendPushToUser } from "../../services/push.service";
import { logger } from "../../lib/logger";

/**
 * Thrown by sendMessage when either party is unavailable. The controller
 * catches by `instanceof` and maps:
 *   subject='sender'    → 401 (defense-in-depth — middleware should have caught)
 *   subject='recipient' → 404 (expired) / 410 (pending) / 403 (blocked)
 *
 * Day 2.5 / Session 88 — service-layer guarantee that messages cannot land
 * in either party's inbox when one of them is unavailable.
 */
export class ChatRejectionError extends Error {
  constructor(
    public subject: "sender" | "recipient",
    public reason: UnavailableReason,
  ) {
    super(`Chat rejected: ${subject} is ${reason}`);
    this.name = "ChatRejectionError";
  }
}

// Helper — read user row, run the same decision branches as the auth
// middleware (single source of truth via evaluateUserStatus).
const evaluateUserRow = (row: { isBlocked: boolean; deletedAt: Date | null }) =>
  evaluateUserStatus({
    isBlocked: row.isBlocked,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    blockedReason: null,
  });

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

  static async getConversations(userId: string) {
    // Day 2.5 / Session 88: per D2 anonymize policy, we DO NOT hide
    // conversations involving deleted users — historical context is
    // preserved (matches WhatsApp/Telegram). We surface `deletedAt` on
    // each participant so the frontend can render "Deleted user" in
    // place of the name when set.
    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        sender: { select: { id: true, name: true, role: true, deletedAt: true, stores: { select: { storeName: true, logoUrl: true }, take: 1 } } },
        receiver: { select: { id: true, name: true, role: true, deletedAt: true, stores: { select: { storeName: true, logoUrl: true }, take: 1 } } },
      },
    });

    const seen = new Map<string, any>();
    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!seen.has(otherId)) {
        const other = msg.senderId === userId ? msg.receiver : msg.sender;
        seen.set(otherId, {
          userId: otherId,
          name: other.stores?.[0]?.storeName || other.name,
          logoUrl: other.stores?.[0]?.logoUrl || null,
          role: other.role,
          // Surfaced for D2 anonymize — frontend reads this to render
          // "Deleted user" label in place of name when non-null.
          deletedAt: other.deletedAt,
          lastMessage: msg.message,
          lastImageUrl: msg.imageUrl,
          timestamp: msg.createdAt,
        });
      }
    }
    return Array.from(seen.values());
  }

  static async sendMessage(senderId: string, receiverId: string, messageText: string, imageUrl?: string) {
    const sender = await prisma.user.findUnique({ where: { id: senderId } });
    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });

    if (!sender || !receiver) throw new Error("User not found");

    // Day 2.5 cascade — service-layer availability check for both parties.
    // Sender check is defense-in-depth (HTTP middleware authenticateToken
    // already rejects deleted senders). Receiver check is the PRIMARY gate —
    // the receiver isn't auth'd by middleware, so this is the only place
    // we stop messages from landing in a deleted/blocked user's inbox.
    const senderCheck = evaluateUserRow(sender);
    if (senderCheck.unavailable) {
      throw new ChatRejectionError("sender", senderCheck.reason);
    }
    const receiverCheck = evaluateUserRow(receiver);
    if (receiverCheck.unavailable) {
      throw new ChatRejectionError("recipient", receiverCheck.reason);
    }

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

    // Fire-and-forget push notification to receiver.
    //
    // S4 fix (Day 2.5 / Session 88): the previous `.catch(() => {})` here was
    // a Rule B violation — silent error swallowing on a user-initiated action.
    // Now: log via pino (structured context) and capture to Sentry for
    // operator visibility. Push failure does NOT propagate — the message is
    // already saved in DB and delivered via socket. Push is best-effort
    // (offline notification); a delivery failure on this side-channel must
    // not fail the user-facing chat request.
    const bodyText = messageText.length > 80 ? messageText.slice(0, 77) + '...' : messageText;
    sendPushToUser(receiverId, {
      title: sender.name || 'Naya message',
      body: bodyText || '📷 Image',
      url: `/chat/${senderId}`,
    }).catch((err) => {
      logger.warn(
        { err, receiverId, senderId, messageId: savedMessage.id },
        "Push notification dispatch failed (non-fatal — message already saved + socket-delivered)",
      );
      Sentry.captureException(err, {
        tags: { component: "sendMessage.push" },
        extra: { receiverId, senderId, messageId: savedMessage.id },
      });
    });

    return savedMessage;
  }
}
