import webpush from 'web-push';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { logger } from '../lib/logger';

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    env.VAPID_MAILTO || 'mailto:support@dukanchi.in',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!env.VAPID_PUBLIC_KEY) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || '/messages' })
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        logger.warn({ err, userId }, 'Push send failed');
      }
    }
  }
}
