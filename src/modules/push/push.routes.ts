import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

const router = Router();

router.get('/vapid-public-key', (_req, res) => {
  return res.json({ publicKey: env.VAPID_PUBLIC_KEY || null });
});

router.post('/subscribe', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Subscribe failed' });
  }
});

router.delete('/unsubscribe', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    }
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Unsubscribe failed' });
  }
});

router.post('/fcm/register', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { token, platform } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token required' });
    }
    const platformValue = ['android', 'ios', 'web'].includes(platform) ? platform : 'android';
    await prisma.fcmToken.upsert({
      where: { token },
      update: { userId, platform: platformValue, updatedAt: new Date() },
      create: { userId, token, platform: platformValue },
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('FCM register failed', err);
    return res.status(500).json({ error: 'register failed' });
  }
});

router.delete('/fcm/unregister', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (token) {
      await prisma.fcmToken.deleteMany({ where: { token } });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('FCM unregister failed', err);
    return res.status(500).json({ error: 'unregister failed' });
  }
});

export default router;
