import webpush from 'web-push';
import admin from 'firebase-admin';
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

// ── Web Push (VAPID) ──────────────────────────────────────────────────────────

async function sendWebPushToUser(
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
        logger.warn({ err, userId }, 'Web push send failed');
      }
    }
  }
}

// ── FCM (Firebase Cloud Messaging) ───────────────────────────────────────────

let fcmInitialized = false;
function ensureFcmInit(): boolean {
  if (fcmInitialized) return true;
  if (!env.FIREBASE_ADMIN_KEY_JSON) return false;
  try {
    const serviceAccount = JSON.parse(env.FIREBASE_ADMIN_KEY_JSON);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });
    }
    fcmInitialized = true;
    return true;
  } catch (err) {
    logger.error({ err }, 'FCM init failed — check FIREBASE_ADMIN_KEY_JSON env var');
    return false;
  }
}

async function sendFcmToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!ensureFcmInit()) return;

  const tokens = await prisma.fcmToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;

  for (const t of tokens) {
    try {
      await admin.messaging().send({
        token: t.token,
        notification: { title: payload.title, body: payload.body },
        data: {
          url: payload.url || '/messages',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'dukanchi_messages',
            sound: 'default',
          },
        },
      });
    } catch (err: any) {
      if (
        err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token'
      ) {
        await prisma.fcmToken.delete({ where: { id: t.id } }).catch(() => {});
      } else {
        logger.warn({ err, userId, tokenId: t.id }, 'FCM send failed');
      }
    }
  }
}

// ── Dual-stack dispatcher ─────────────────────────────────────────────────────

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  // Run both channels in parallel — failure in one doesn't block the other
  await Promise.allSettled([
    sendWebPushToUser(userId, payload),
    sendFcmToUser(userId, payload),
  ]);
}
