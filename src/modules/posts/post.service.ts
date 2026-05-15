import { prisma } from "../../config/prisma";
import { notificationQueue } from "../../config/bullmq";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

    // Fetch follows once — used both for filtering (following tab) and scoring
    const follows = await prisma.follow.findMany({ where: { userId }, select: { storeId: true } });
    const followedStoreIds = new Set(follows.map(f => f.storeId));

    if (feedType === 'following') {
      whereClause.storeId = { in: follows.map(f => f.storeId) };
    }

    const [total, rawPosts] = await Promise.all([
      prisma.post.count({ where: whereClause }),
      prisma.post.findMany({
        where: whereClause,
        include: {
          store: { select: { id: true, storeName: true, logoUrl: true, latitude: true, longitude: true, category: true, averageRating: true, hideRatings: true, chatEnabled: true, ownerId: true, openingTime: true, closingTime: true, is24Hours: true, workingDays: true, owner: { select: { id: true, role: true } } } },
          product: { select: { id: true, productName: true, price: true, category: true } },
          likes: { where: { userId }, select: { id: true } },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit * 3,
      }),
    ]);

    // Score and rank: freshness(40%) + distance(25%) + engagement(20%) + follow(15%) + opening bonus(+5%)
    const now = Date.now();
    const scored = rawPosts.map(p => {
      const ageHours = (now - new Date(p.createdAt).getTime()) / 3_600_000;
      const freshness = Math.max(0, 1 - ageHours / 168); // decays over 7 days

      let distScore = 0;
      if (userLat && userLng && p.store.latitude && p.store.longitude) {
        distScore = Math.max(0, 1 - haversineKm(userLat, userLng, p.store.latitude, p.store.longitude) / 20);
      }

      const engagement = Math.min(1, p._count.likes / 50);
      const isFollowed = followedStoreIds.has(p.storeId) ? 1 : 0;
      const openingBonus = p.isOpeningPost ? 0.05 : 0;
      const score = freshness * 0.40 + distScore * 0.25 + engagement * 0.20 + isFollowed * 0.15 + openingBonus;
      return { ...p, _score: score };
    });
    scored.sort((a, b) => b._score - a._score);
    const posts = scored.slice(0, limit);

    return {
      posts: posts.map(p => ({ ...p, isOwnPost: p.store.ownerId === userId })),
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
