import { prisma } from '../../config/prisma';
import { getIO } from '../../config/socket';
import { logger } from '../../lib/logger';
import { sendPushToUser } from '../../services/push.service';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// In-memory rate limit: userId → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkHourlyLimit(userId: string, max: number = 10): { allowed: boolean; remainingMs: number; count: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    const resetAt = now + 3_600_000;
    rateLimitMap.set(userId, { count: 1, resetAt });
    return { allowed: true, remainingMs: resetAt - now, count: 1, resetAt };
  }
  if (entry.count >= max) {
    return { allowed: false, remainingMs: entry.resetAt - now, count: entry.count, resetAt: entry.resetAt };
  }
  entry.count++;
  return { allowed: true, remainingMs: entry.resetAt - now, count: entry.count, resetAt: entry.resetAt };
}

export function getHourlyLimitStatus(userId: string, max: number = 10): { count: number; max: number; resetAt: number; remainingMs: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    return { count: 0, max, resetAt: now + 3_600_000, remainingMs: 3_600_000 };
  }
  return { count: entry.count, max, resetAt: entry.resetAt, remainingMs: Math.max(0, entry.resetAt - now) };
}

export async function sendAskNearby(
  customerId: string,
  query: string,
  radiusKm: number,
  latitude: number,
  longitude: number,
  areaLabel?: string,
  images: string[] = [],
) {
  // Bounding box pre-filter — reduces full-table scan to small geographic slice
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(latitude * (Math.PI / 180)));
  const stores = await prisma.store.findMany({
    where: {
      latitude:  { gte: latitude  - latDelta,  lte: latitude  + latDelta  },
      longitude: { gte: longitude - lngDelta, lte: longitude + lngDelta },
    },
    select: {
      id: true,
      ownerId: true,
      storeName: true,
      latitude: true,
      longitude: true,
    },
  });

  // Haversine refinement — removes bounding box corners outside the true radius
  const nearby = stores.filter(
    s => s.latitude && s.longitude && haversineKm(latitude, longitude, s.latitude, s.longitude) <= radiusKm,
  );

  if (nearby.length === 0) {
    return { found: 0, message: 'Is area mein koi matching store nahi mila' };
  }

  const nearbyIds = nearby.map(s => s.id);

  const matchingProducts = await prisma.product.findMany({
    where: {
      storeId: { in: nearbyIds },
      productName: { contains: query, mode: 'insensitive' },
    },
    select: { storeId: true },
    distinct: ['storeId'],
  });

  // If no direct product matches, use AI Category Routing
  if (matchingProducts.length === 0 && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Categorize this product query: "${query}". Return ONLY the category name exactly from this list: Food, Electronics, Fashion, Grocery, Beauty, Health, Jewellery, Real Estate, Stationery, Auto, Services, Pets, Sports, Hardware, Toys, Gifts. If none match, return "Other".` }] }]
          })
        }
      );
      if (geminiRes.ok) {
        const geminiData = await geminiRes.json() as any;
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        const detectedCategory = text.replace(/[^a-zA-Z\s]/g, '').trim();
        if (detectedCategory && detectedCategory !== 'Other') {
          const categoryStores = await prisma.store.findMany({
            where: {
              id: { in: nearbyIds },
              category: { equals: detectedCategory, mode: 'insensitive' }
            },
            select: { id: true }
          });
          matchingProducts.push(...categoryStores.map(s => ({ storeId: s.id })));
          logger.info({ query, detectedCategory, storeCount: categoryStores.length }, '[ASK_NEARBY] AI Category Routing matched');
        }
      }
    } catch (err) {
      logger.error({ err }, '[ASK_NEARBY] AI Category recognition failed');
    }
  }

  const matchingStoreIds = new Set(matchingProducts.map(p => p.storeId));
  const matched = nearby.filter(s => matchingStoreIds.has(s.id)).slice(0, 15);

  if (matched.length === 0) {
    return { found: 0, message: 'Is area mein koi matching store nahi mila' };
  }

  // Create request record
  const request = await prisma.askNearbyRequest.create({
    data: { customerId, query, radiusKm, latitude, longitude, areaLabel, images: images || [] },
  });

  // Batch-insert all response records in a single query
  await prisma.askNearbyResponse.createMany({
    data: matched.map(store => ({ requestId: request.id, storeId: store.id, ownerId: store.ownerId })),
    skipDuplicates: true,
  });

  // Fetch created responses to get their IDs for socket payloads
  const responses = await prisma.askNearbyResponse.findMany({
    where: { requestId: request.id },
    select: { id: true, storeId: true, ownerId: true },
  });

  const io = getIO();
  const customer = await prisma.user.findUnique({ where: { id: customerId }, select: { name: true } });

  for (const r of responses) {
    io.to(r.ownerId).emit('ask_nearby_request', {
      requestId: request.id,
      responseId: r.id,
      query,
      customerName: customer?.name || 'Customer',
      customerId,
      latitude,
      longitude,
      areaLabel: areaLabel || null,
      radiusKm,
    });

    sendPushToUser(r.ownerId, {
      title: 'Customer looking for stock! 📦',
      body: `${customer?.name || 'A customer'} is asking: "${query}". Tap to respond.`,
      url: '/messages',
    }).catch(err => logger.error({ err, ownerId: r.ownerId }, 'Failed to send ask-nearby push'));
  }

  logger.info({ requestId: request.id, sentTo: matched.length }, '[ASK_NEARBY] sent');

  return {
    requestId: request.id,
    sentTo: matched.length,
    storeNames: matched.map(s => s.storeName),
  };
}

export async function respondToAskNearby(
  ownerId: string,
  responseId: string,
  answer: 'yes' | 'no',
) {
  const response = await prisma.askNearbyResponse.findUnique({
    where: { id: responseId },
    include: { request: true, store: { select: { storeName: true } } },
  });

  if (!response) throw Object.assign(new Error('Not found'), { status: 404 });
  if (response.ownerId !== ownerId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  if (response.status !== 'pending') throw Object.assign(new Error('Already responded'), { status: 400 });

  await prisma.askNearbyResponse.update({
    where: { id: responseId },
    data: { status: answer, respondedAt: new Date() },
  });

  if (answer === 'yes') {
    const { customerId, query } = response.request;

    // Find or create conversation by sending the first auto-message
    await prisma.message.create({
      data: {
        senderId: ownerId,
        receiverId: customerId,
        message: `Haan! '${query}' available hai hamare paas. Aao ya chat karein! 🏪`,
      },
    });

    await prisma.askNearbyResponse.update({
      where: { id: responseId },
      data: { conversationId: customerId },
    });

    const io = getIO();
    io.to(customerId).emit('ask_nearby_confirmed', {
      storeId: response.storeId,
      storeName: response.store.storeName,
      conversationId: ownerId,
    });

    logger.info({ responseId, storeId: response.storeId, customerId }, '[ASK_NEARBY] confirmed');
  }

  return { status: 'updated' };
}

export async function getMyRequests(customerId: string) {
  return prisma.askNearbyRequest.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      responses: {
        where: { status: 'yes' },
        select: {
          id: true,
          storeId: true,
          conversationId: true,
          store: { select: { storeName: true, logoUrl: true } },
        },
      },
    },
  });
}

export async function getPendingRequests(ownerId: string) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.askNearbyResponse.findMany({
    where: { 
      ownerId,
      OR: [
        { status: 'pending' },
        { status: 'no', respondedAt: { gte: yesterday } }
      ]
    },
    orderBy: { request: { createdAt: 'desc' } },
    take: 10,
    include: {
      request: {
        select: {
          query: true,
          radiusKm: true,
          areaLabel: true,
          latitude: true,
          longitude: true,
          customerId: true,
          customer: { select: { name: true } }
        }
      }
    }
  });
}
