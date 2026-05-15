import { Request, Response } from 'express';
import { analyzeProductImage, transcribeAndStructureVoice, generateStoreDescription } from '../../services/geminiVision';

// Simple in-memory rate limiter: userId:feature → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, feature: string, maxPerMinute: number): boolean {
  const key = `${userId}:${feature}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

const QUOTA_MSG = { error: 'Thodi der baad try karo — AI abhi busy hai' };

export class AiController {
  static async analyzeImage(req: Request, res: Response) {
    const userId = (req as any).user.userId;
    if (!checkRateLimit(userId, 'analyze-image', 10)) {
      return res.status(429).json(QUOTA_MSG);
    }

    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length === 0) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }
    if (!mimeType || !String(mimeType).startsWith('image/')) {
      return res.status(400).json({ error: 'Valid image mimeType is required' });
    }

    const result = await analyzeProductImage(imageBase64, mimeType);
    return res.json(result);
  }

  static async transcribeVoice(req: Request, res: Response) {
    const userId = (req as any).user.userId;
    if (!checkRateLimit(userId, 'transcribe-voice', 10)) {
      return res.status(429).json(QUOTA_MSG);
    }

    const { audioBase64, mimeType } = req.body;
    if (!audioBase64 || typeof audioBase64 !== 'string' || audioBase64.length === 0) {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }
    const allowed = ['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg'];
    if (!mimeType || !allowed.includes(String(mimeType))) {
      return res.status(400).json({ error: `mimeType must be one of: ${allowed.join(', ')}` });
    }

    const result = await transcribeAndStructureVoice(audioBase64, mimeType);
    return res.json(result);
  }

  static async generateStoreDesc(req: Request, res: Response) {
    const userId = (req as any).user.userId;
    if (!checkRateLimit(userId, 'store-desc', 5)) {
      return res.status(429).json(QUOTA_MSG);
    }

    const { storeName, category, userContext } = req.body;
    if (!storeName || typeof storeName !== 'string' || storeName.trim().length === 0) {
      return res.status(400).json({ error: 'storeName is required' });
    }
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return res.status(400).json({ error: 'category is required' });
    }

    const result = await generateStoreDescription(
      storeName.trim(),
      category.trim(),
      typeof userContext === 'string' ? userContext : undefined,
    );
    return res.json(result);
  }
}
