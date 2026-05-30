import { prisma } from "../../config/prisma";
import { notificationQueue } from "../../config/bullmq";
import { pubClient } from "../../config/redis";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Session 128.6 — Time-of-day category boost ─────────────────────────────
   Cheap heuristic: surface category X when it tends to be most useful in
   hour Y. Server runs in UTC; this is best-effort (we don't know each user's
   exact TZ), but the categories overlap enough that off-by-2h is fine.
   IST is UTC+5:30, so server-hour buckets map roughly to:
   - 00:30-05:30 IST → night (pharmacy/medical/24-hour)
   - 05:30-10:30 IST → morning (grocery/dairy/salon/services)
   - 10:30-14:30 IST → midday (restaurant/cafe/services)
   - 14:30-18:30 IST → afternoon (electronics/clothing/shopping)
   - 18:30-22:30 IST → evening (restaurant/pharmacy/medical/food) */
function getTimeOfDayCategories(hour: number): Set<string> {
  if (hour >= 0 && hour < 5)  return new Set(['pharmacy', 'medical', 'hospital', '24 hours', 'petrol pump']);
  if (hour >= 5 && hour < 10) return new Set(['grocery', 'dairy', 'bakery', 'salon', 'beauty', 'services', 'tea', 'milk']);
  if (hour >= 10 && hour < 14) return new Set(['restaurant', 'cafe', 'food', 'sweets', 'services']);
  if (hour >= 14 && hour < 18) return new Set(['electronics', 'clothing', 'shopping', 'fashion', 'apparel', 'jewellery', 'hardware', 'mobile']);
  if (hour >= 18 && hour < 22) return new Set(['restaurant', 'cafe', 'food', 'pharmacy', 'medical', 'entertainment', 'sweets']);
  return new Set(['pharmacy', 'medical', 'hospital', '24 hours']);
}

export class PostService {
  static async createPost(data: any) {
    const postData: any = {
      caption: data.caption,
      imageUrl: data.imageUrl,
      isOpeningPost: data.isOpeningPost || false,
      store: { connect: { id: data.storeId } }
    };
    if (data.productId) {
      postData.product = { connect: { id: data.productId } };
    }
    if (data.price !== undefined && data.price !== null && data.price !== '') {
      postData.price = parseFloat(data.price);
    }

    const post = await prisma.post.create({ data: postData });

    const store = await prisma.store.findUnique({ where: { id: post.storeId } });
    if (store) {
      await notificationQueue.add('publishPostNotifications', {
        postId: post.id,
        storeId: store.id,
        storeName: store.storeName
      });
    }

    return post;
  }

  /* ── Session 128.6 — Smart feed ranking (Phase A + B) ────────────────────
     Personalised ranking pipeline. Fetches 3× candidates over a soft-delete-
     filtered + role-filtered + (optionally) location-boxed set, then scores
     each candidate by a weighted blend of:

       SIGNAL              WEIGHT  SOURCE
       ─────────────────── ──────  ─────────────────────────────────────────
       freshness            25%    age decay over 7 days
       distance             15%    haversine, decay over 20 km
       engagement           15%    likes + saves×2 + last-24h-likes×2 / 50
       followed             20%    binary (Phase A bumped 15→20)
       category match       10%    user's top-3 most-liked store categories
       chat affinity         5%    user has DM'd this store's owner (30 day)
       time-of-day match     5%    store category × hour-bucket (heuristic)
       pinned                5%    store owner pinned this post (signal)
       opening post          5%    first post when a store launched (history)

     After scoring:
       × seen penalty (× 0.4)     post is in Redis feed:seen:{userId} (7 day)
       diversity cap              max 2 posts per store per page
       SADD posts to seen set     fire-and-forget, 7-day TTL on key
  ───────────────────────────────────────────────────────────────────────── */
  static async getFeed(userId: string, userRole: string, options: any) {
    const { feedType, locationRange, lat, lng, page, limit } = options;
    const skip = (page - 1) * limit;
    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    let allowedRoles: string[] = [];
    if (userRole === 'customer') allowedRoles = ['retailer'];
    else if (userRole === 'retailer') allowedRoles = ['retailer', 'supplier', 'manufacturer', 'brand'];
    else if (['supplier', 'manufacturer', 'brand'].includes(userRole)) allowedRoles = ['retailer', 'supplier', 'manufacturer', 'brand'];
    else if (userRole === 'admin') allowedRoles = ['customer', 'retailer', 'supplier', 'manufacturer', 'brand', 'admin'];

    // Soft-delete cascade: feed hides posts whose store-owner is in any
    // deleted state (matches user spec item 4: "skip recommendations from
    // deleted users entirely"). Distinct from saved-posts view, which
    // anonymizes rather than hides (preserves historical engagement).
    let storeFilter: any = { owner: { role: { in: allowedRoles }, isBlocked: false, deletedAt: null } };

    if (locationRange && locationRange !== 'all' && userLat && userLng) {
      const rangeKm = parseFloat(locationRange);
      const latDelta = rangeKm / 111;
      const lngDelta = rangeKm / (111 * Math.cos(userLat * Math.PI / 180));
      storeFilter = {
        ...storeFilter,
        latitude:  { gte: userLat - latDelta,  lte: userLat + latDelta  },
        longitude: { gte: userLng - lngDelta, lte: userLng + lngDelta },
      };
    }

    let whereClause: any = { store: storeFilter };

    // ── Fetch follows once (needed for filtering AND scoring) ───────────────
    const follows = await prisma.follow.findMany({ where: { userId }, select: { storeId: true } });
    const followedStoreIds = new Set(follows.map(f => f.storeId));

    if (feedType === 'following') {
      whereClause.storeId = { in: follows.map(f => f.storeId) };
    }

    // ── Parallel: personalisation inputs + candidate fetch ──────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [recentLikedPosts, recentMessages, total, candidatePosts] = await Promise.all([
      // Last 50 liked posts (with store.category for taste vector)
      prisma.like.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { post: { select: { store: { select: { category: true } } } } },
      }),
      // Last 30 days of DM partners — chat-affinity signal
      prisma.message.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }], createdAt: { gte: thirtyDaysAgo } },
        select: { senderId: true, receiverId: true },
        take: 200,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.post.count({ where: whereClause }),
      prisma.post.findMany({
        where: whereClause,
        include: {
          store: {
            select: {
              id: true, storeName: true, logoUrl: true, latitude: true, longitude: true,
              category: true, averageRating: true, reviewCount: true, hideRatings: true,
              chatEnabled: true, ownerId: true, openingTime: true, closingTime: true,
              is24Hours: true, workingDays: true, city: true, postalCode: true,
              owner: { select: { id: true, role: true } },
              // Session 128.8: surface follower count in the Home PostCard
              // header's location row ("Bandra · 400050 · 2.3k followers").
              _count: { select: { followers: true } },
            },
          },
          product: { select: { id: true, productName: true, price: true, category: true } },
          likes: { where: { userId }, select: { id: true } },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit * 3,
      }),
    ]);

    const candidatePostIds = candidatePosts.map(p => p.id);

    // ── Per-post aggregate signals (saves, last-24h-likes) ──────────────────
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [perPostSaves, perPostRecentLikes] = candidatePostIds.length > 0
      ? await Promise.all([
          prisma.savedItem.groupBy({
            by: ['referenceId'],
            where: { type: 'post', referenceId: { in: candidatePostIds } },
            _count: { _all: true },
          }),
          prisma.like.groupBy({
            by: ['postId'],
            where: { postId: { in: candidatePostIds }, createdAt: { gte: dayAgo } },
            _count: { _all: true },
          }),
        ])
      : [[] as any[], [] as any[]];
    const saveCountByPost: Record<string, number> = {};
    perPostSaves.forEach((r: any) => { saveCountByPost[r.referenceId] = r._count._all; });
    const recentLikeCountByPost: Record<string, number> = {};
    perPostRecentLikes.forEach((r: any) => { recentLikeCountByPost[r.postId] = r._count._all; });

    // ── Resolve chatted store IDs (DM partner userId → owned storeId) ──────
    const chattedUserIds = new Set<string>();
    recentMessages.forEach((m: any) => {
      if (m.senderId !== userId) chattedUserIds.add(m.senderId);
      if (m.receiverId !== userId) chattedUserIds.add(m.receiverId);
    });
    const chattedStores = chattedUserIds.size > 0
      ? await prisma.store.findMany({
          where: { ownerId: { in: Array.from(chattedUserIds) } },
          select: { id: true },
        })
      : [];
    const chattedStoreIds = new Set(chattedStores.map((s) => s.id));

    // ── Top-3 categories from user's recent likes (taste signal) ───────────
    const categoryCounts: Record<string, number> = {};
    recentLikedPosts.forEach((l: any) => {
      const cat = l?.post?.store?.category;
      if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const topCategories = new Set(
      Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat]) => cat)
    );

    // ── Time-of-day category boost (hour-bucket → category set) ────────────
    const timeCategories = getTimeOfDayCategories(new Date().getHours());

    // ── Redis: which candidates has this user seen recently? ───────────────
    const seenSet = new Set<string>();
    if (candidatePostIds.length > 0) {
      try {
        const key = `feed:seen:${userId}`;
        const result: any = await pubClient.sMIsMember(key, candidatePostIds);
        if (Array.isArray(result)) {
          candidatePostIds.forEach((id, i) => { if (result[i]) seenSet.add(id); });
        }
      } catch { /* Redis down → no penalty, fall through */ }
    }

    // ── Score every candidate ──────────────────────────────────────────────
    const now = Date.now();
    const scored = candidatePosts.map((p) => {
      const ageHours = (now - new Date(p.createdAt).getTime()) / 3_600_000;
      const freshness = Math.max(0, 1 - ageHours / 168); // decays over 7 days

      let distScore = 0;
      if (userLat && userLng && p.store.latitude && p.store.longitude) {
        distScore = Math.max(0, 1 - haversineKm(userLat, userLng, p.store.latitude, p.store.longitude) / 20);
      }

      const totalLikes = p._count.likes;
      const totalSaves = saveCountByPost[p.id] ?? 0;
      const recentLikes = recentLikeCountByPost[p.id] ?? 0;
      // saves count 2× (intent > impression), recent-likes count 2× (trending)
      const engagement = Math.min(1, (totalLikes + totalSaves * 2 + recentLikes * 2) / 50);

      const isFollowed = followedStoreIds.has(p.storeId) ? 1 : 0;
      const isChatted  = chattedStoreIds.has(p.storeId) ? 1 : 0;
      const storeCat = (p.store.category || '').toLowerCase();
      const categoryMatch = p.store.category && topCategories.has(p.store.category) ? 1 : 0;
      const timeMatch = storeCat && timeCategories.has(storeCat) ? 1 : 0;
      const isPinned = p.isPinned ? 1 : 0;
      const isOpening = p.isOpeningPost ? 1 : 0;

      const base =
          0.25 * freshness
        + 0.15 * distScore
        + 0.15 * engagement
        + 0.20 * isFollowed
        + 0.10 * categoryMatch
        + 0.05 * isChatted
        + 0.05 * timeMatch
        + 0.05 * isPinned
        + 0.05 * isOpening;

      // Seen penalty: 60% drop if user already saw this post in last 7 days.
      const score = seenSet.has(p.id) ? base * 0.4 : base;

      return { ...p, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);

    // ── Diversity cap: at most 2 posts per store on this page ──────────────
    const perStoreCount: Map<string, number> = new Map();
    const picked: typeof scored = [];
    for (const p of scored) {
      const count = perStoreCount.get(p.storeId) ?? 0;
      if (count >= 2) continue;
      perStoreCount.set(p.storeId, count + 1);
      picked.push(p);
      if (picked.length >= limit) break;
    }

    // ── Fire-and-forget Redis: mark picked posts as seen (7-day TTL) ───────
    if (picked.length > 0) {
      const key = `feed:seen:${userId}`;
      const pickedIds = picked.map((p) => p.id);
      Promise.resolve()
        .then(async () => {
          await pubClient.sAdd(key, pickedIds);
          await pubClient.expire(key, 7 * 24 * 60 * 60);
        })
        .catch((err) => {
          // Fire-and-forget — best-effort impression tracking.
          // Sentry-only so we know if Redis is down for a long time.
          console.error('[feed.seenSet]', err?.message ?? err);
        });
    }

    return {
      posts: picked.map((p) => ({ ...p, isOwnPost: p.store.ownerId === userId })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  static async getInteractions(userId: string) {
    const [likes, saves, follows] = await Promise.all([
      prisma.like.findMany({ where: { userId }, take: 500, orderBy: { createdAt: 'desc' } }),
      prisma.savedItem.findMany({ where: { userId }, take: 500, orderBy: { createdAt: 'desc' } }),
      prisma.follow.findMany({ where: { userId }, take: 500, orderBy: { createdAt: 'desc' } }),
    ]);

    return {
      likedPostIds: likes.map(l => l.postId),
      savedPostIds: saves.filter(s => s.type === 'post').map(s => s.referenceId),
      followedStoreIds: follows.map(f => f.storeId)
    };
  }

  static async toggleLike(userId: string, postId: string) {
    const existingLike = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
      return { liked: false };
    } else {
      await prisma.like.create({ data: { userId, postId } });
      return { liked: true };
    }
  }

  static async toggleSave(userId: string, postId: string) {
    const existingSave = await prisma.savedItem.findUnique({
      where: { userId_type_referenceId: { userId, type: 'post', referenceId: postId } }
    });

    if (existingSave) {
      await prisma.savedItem.delete({ where: { id: existingSave.id } });
      return { saved: false };
    } else {
      await prisma.savedItem.create({ data: { userId, type: 'post', referenceId: postId } });
      return { saved: true };
    }
  }

  static async togglePin(postId: string, userId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { store: { select: { ownerId: true } } }
    });
    if (!post) throw new Error("Post not found");
    if (post.store.ownerId !== userId) throw new Error("Unauthorized");

    if (!post.isPinned) {
      const pinnedCount = await prisma.post.count({ where: { storeId: post.storeId, isPinned: true } });
      if (pinnedCount >= 3) throw new Error("Maximum 3 pinned posts allowed");
    }

    return prisma.post.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned }
    });
  }

  static async updatePost(postId: string, userId: string, data: any) {
    const post = await prisma.post.findUnique({ where: { id: postId }, include: { store: true } });
    if (!post) throw new Error("Not found");
    if (post.store.ownerId !== userId) throw new Error("Unauthorized");

    const { caption, imageUrl, price } = data;
    return prisma.post.update({
      where: { id: postId },
      data: {
        ...(caption !== undefined && { caption }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(price !== undefined && { price: price ? parseFloat(price) : null }),
      },
      include: { product: { select: { id: true, productName: true, price: true, category: true } }, _count: { select: { likes: true } } }
    });
  }

  static async deletePost(postId: string, userId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId }, include: { store: true } });
    if (!post) throw new Error("Not found");
    if (post.store.ownerId !== userId) throw new Error("Unauthorized");

    await prisma.like.deleteMany({ where: { postId } });
    await prisma.savedItem.deleteMany({ where: { type: 'post', referenceId: postId } });
    await prisma.post.delete({ where: { id: postId } });
    return { success: true };
  }

  static async deleteAllStorePosts(storeId: string, userId: string) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== userId) throw new Error("Unauthorized");

    const posts = await prisma.post.findMany({ where: { storeId }, select: { id: true } });
    const postIds = posts.map(p => p.id);

    if (postIds.length > 0) {
      await prisma.like.deleteMany({ where: { postId: { in: postIds } } });
      await prisma.savedItem.deleteMany({ where: { type: 'post', referenceId: { in: postIds } } });
      await prisma.post.deleteMany({ where: { storeId } });
    }
    return { success: true };
  }
}
