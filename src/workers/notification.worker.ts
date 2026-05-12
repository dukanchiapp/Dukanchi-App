import { Worker } from "bullmq";
import { prisma } from "../config/prisma";
import { bullRedisConnection } from "../config/bullmq";
import { getIO } from "../config/socket";
import { logger } from "../lib/logger";
import { isUserUnavailable } from "../middlewares/user-status";

export function startNotificationWorker() {
  const notificationWorker = new Worker('Notifications', async job => {
    if (job.name === 'publishPostNotifications') {
      const { postId, storeId, storeName } = job.data;
      const storeWithFollowers = await prisma.store.findUnique({
        where: { id: storeId },
        include: { followers: true }
      });

      if (storeWithFollowers && storeWithFollowers.followers.length > 0) {
        const allFollowers = storeWithFollowers.followers;
        const CHUNK = 1000;

        try {
          const io = getIO();

          for (let i = 0; i < allFollowers.length; i += CHUNK) {
            const chunk = allFollowers.slice(i, i + CHUNK);

            // Day 2.5 / Session 88: filter out followers who are now
            // unavailable (deleted_pending, deleted_expired, blocked).
            // One extra query per chunk — for 1000 followers that's still
            // a single round-trip. Avoids writing Notification rows that
            // a deleted user could never see + skips emitting to rooms
            // they shouldn't be in.
            const followerUserIds = chunk.map(f => f.userId);
            const activeFollowers = await prisma.user.findMany({
              where: {
                id: { in: followerUserIds },
                deletedAt: null,
                isBlocked: false,
              },
              select: { id: true },
            });
            const activeIds = new Set(activeFollowers.map(u => u.id));
            const activeChunk = chunk.filter(f => activeIds.has(f.userId));
            if (activeChunk.length === 0) continue;

            await prisma.notification.createMany({
              data: activeChunk.map(f => ({
                userId: f.userId,
                type: 'NEW_POST',
                content: `${storeName} just published a new post!`,
                referenceId: postId,
              })),
              skipDuplicates: true,
            });

            // Emit inline from chunk data — no extra findMany round-trip
            for (const f of activeChunk) {
              io.to(f.userId).emit('newNotification', {
                type: 'NEW_POST',
                content: `${storeName} just published a new post!`,
                referenceId: postId,
                isRead: false,
              });
            }
          }
        } catch (e) {
          logger.warn({ err: e, postId }, "Socket.io emit failed in notification worker");
        }
      }
    }

    if (job.name === 'autoReply') {
      const { senderId, receiverId } = job.data;

      // Day 2.5 / Session 88: a user may have deleted (or been blocked)
      // during the 1-second delay between message send and auto-reply
      // fanout. Skip the auto-reply if either party is now unavailable.
      // (Customer = senderId, retailer = receiverId in the original send.
      //  The auto-reply goes FROM retailer TO customer.)
      const [senderCheck, receiverCheck] = await Promise.all([
        isUserUnavailable(senderId),
        isUserUnavailable(receiverId),
      ]);
      if (senderCheck.unavailable || receiverCheck.unavailable) {
        logger.info(
          {
            senderId,
            receiverId,
            senderReason: senderCheck.unavailable ? senderCheck.reason : null,
            receiverReason: receiverCheck.unavailable ? receiverCheck.reason : null,
          },
          'autoReply skipped: party unavailable',
        );
        return;
      }

      const autoReplyText = `Hi! Thanks for reaching out. Please wait while our team connects with you.`;
      try {
        const autoReply = await prisma.message.create({
          data: { senderId: receiverId, receiverId: senderId, message: autoReplyText }
        });

        try {
          const io = getIO();
          io.to(senderId).emit("newMessage", autoReply);
          io.to(receiverId).emit("newMessage", autoReply);
        } catch (e) {
          logger.warn({ err: e }, "Socket.io emit failed in autoReply worker");
        }
      } catch (e) {
        logger.error({ err: e }, "Auto-reply job failed");
      }
    }
  }, { connection: bullRedisConnection });

  notificationWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, "BullMQ job failed");
  });

  logger.info("Notification worker started");
  return notificationWorker;
}
