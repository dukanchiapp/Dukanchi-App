import { Request, Response } from 'express';
import { sendAskNearby, respondToAskNearby, getMyRequests, checkHourlyLimit } from './ask-nearby.service';

export class AskNearbyController {
  static async send(req: Request, res: Response) {
    const userId = (req as any).user.userId;

    if (!checkHourlyLimit(userId, 5)) {
      return res.status(429).json({ error: 'Thodi der baad try karo — limit exceed ho gayi' });
    }

    const { query, radiusKm, latitude, longitude, areaLabel } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 200) {
      return res.status(400).json({ error: 'query must be 3-200 characters' });
    }
    const radius = Number(radiusKm);
    if (!radius || radius < 1 || radius > 20) {
      return res.status(400).json({ error: 'radiusKm must be 1-20' });
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!lat || !lng || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ error: 'Valid latitude and longitude required' });
    }

    try {
      const result = await sendAskNearby(userId, query.trim(), radius, lat, lng, areaLabel?.trim());
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }

  static async respond(req: Request, res: Response) {
    const ownerId = (req as any).user.userId;
    const { responseId, answer } = req.body;

    if (!responseId || typeof responseId !== 'string') {
      return res.status(400).json({ error: 'responseId required' });
    }
    if (answer !== 'yes' && answer !== 'no') {
      return res.status(400).json({ error: 'answer must be yes or no' });
    }

    try {
      const result = await respondToAskNearby(ownerId, responseId, answer);
      return res.json(result);
    } catch (err: any) {
      return res.status(err.status || 500).json({ error: err.message || 'Server error' });
    }
  }

  static async myRequests(req: Request, res: Response) {
    const userId = (req as any).user.userId;
    try {
      const data = await getMyRequests(userId);
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Server error' });
    }
  }
}
