import { prisma } from '../../config/prisma';
import { getIO } from '../../config/socket';
import { logger } from '../../lib/logger';

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

export function checkHourlyLimit(userId: string, max: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export async function sendAskNearby(
  customerId: string,
  query: string,
  radiusKm: number,
  latitude: number,
  longitude: number,
  areaLabel?: string,
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

  // Filter by product match (ILIKE)
  const matchingProducts = await prisma.product.findMany({
    where: {
      storeId: { in: nearbyIds },
      productName: { contains: query, mode: 'insensitive' },
    },
    select: { storeId: true },
    distinct: ['storeId'],
  });

  const matchingStoreIds = new Set(matchingProducts.map(p => p.storeId));
  const matched = nearby.filter(s => matchingStoreIds.has(s.id)).slice(0, 15);

  if (matched.length === 0) {
    return { found: 0, message: 'Is area mein koi matching store nahi mila' };
  }

  // Create request record
  const request = await prisma.askNearbyRequest.create({
    data: { customerId, query, radiusKm, latitude, longitude, areaLabel },
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
      areaLabel: areaLabel || null,
      radiusKm,
    });
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
