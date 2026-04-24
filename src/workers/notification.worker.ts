import { Worker } from "bullmq";
import { prisma } from "../config/prisma";
import { bullRedisConnection } from "../config/bullmq";
import { getIO } from "../config/socket";

export function startNotificationWorker() {
  const notificationWorker = new Worker('Notifications', async job => {
    if (job.name === 'publishPostNotifications') {
      const { postId, storeId, storeName } = job.data;
      const storeWithFollowers = await prisma.store.findUnique({
        where: { id: storeId },
        include: { followers: true }
      });
      if (storeWithFollowers && storeWithFollowers.followers.length > 0) {
        // Chunk createMany in batches of 1000
        const allFollowers = storeWithFollowers.followers;
        const CHUNK = 1000;
        for (let i = 0; i < allFollowers.length; i += CHUNK) {
          const chunk = allFollowers.slice(i, i + CHUNK);
          await prisma.notification.createMany({
            data: chunk.map(f => ({
              userId: f.userId,
              type: 'NEW_POST',
              content: `${storeName} just published a new post!`,
              referenceId: postId
            }))
          });
        }

        try {
          const io = getIO();
          const newNotifs = await prisma.notification.findMany({
            where: { referenceId: postId, type: 'NEW_POST' }
          });
          for (const notif of newNotifs) {
            io.to(notif.userId).emit('newNotification', notif);
          }
        } catch (e) {
          console.warn("Socket.io emit failed in worker", e);
        }
      }
    }

    if (job.name === 'autoReply') {
      const { senderId, receiverId, storeName, senderName, storePhone, storeAddress } = job.data;
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
          console.warn("Socket.io emit failed in worker", e);
        }
      } catch (e) {
        console.error("Auto-reply job failed:", e);
      }
    }
  }, { connection: bullRedisConnection });

  notificationWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error ${err.message}`);
  });

  console.log("Notification worker started.");
  return notificationWorker;
}
