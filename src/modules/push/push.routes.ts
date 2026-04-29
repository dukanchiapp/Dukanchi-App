import { Router, Request, Response } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

const router = Router();

router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY || null });
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
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Subscribe failed' });
  }
});

router.delete('/unsubscribe', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint } });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Unsubscribe failed' });
  }
});

export default router;
