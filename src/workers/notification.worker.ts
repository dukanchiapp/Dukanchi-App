import { Worker } from "bullmq";
import { prisma } from "../config/prisma";
import { bullRedisConnection } from "../config/bullmq";
import { getIO } from "../config/socket";
import { logger } from "../lib/logger";

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

            await prisma.notification.createMany({
              data: chunk.map(f => ({
                userId: f.userId,
                type: 'NEW_POST',
                content: `${storeName} just published a new post!`,
                referenceId: postId,
              })),
              skipDuplicates: true,
            });

            // Emit inline from chunk data — no extra findMany round-trip
            for (const f of chunk) {
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
