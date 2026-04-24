import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";
import { notificationQueue } from "../../config/bullmq";

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

    let allowedRoles: string[] = [];
    if (userRole === 'customer') allowedRoles = ['retailer'];
    else if (userRole === 'retailer') allowedRoles = ['retailer', 'supplier', 'manufacturer', 'brand'];
    else if (['supplier', 'manufacturer', 'brand'].includes(userRole)) allowedRoles = ['retailer'];
    else if (userRole === 'admin') allowedRoles = ['customer', 'retailer', 'supplier', 'manufacturer', 'brand', 'admin'];

    let storeFilter: any = { owner: { role: { in: allowedRoles }, isBlocked: false } };

    if (locationRange && locationRange !== 'all' && lat && lng) {
      const rangeKm = parseFloat(locationRange);
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const latDelta = rangeKm / 111;
      const lngDelta = rangeKm / (111 * Math.cos(userLat * Math.PI / 180));
      storeFilter = {
        ...storeFilter,
        latitude:  { gte: userLat - latDelta,  lte: userLat + latDelta  },
        longitude: { gte: userLng - lngDelta, lte: userLng + lngDelta },
      };
    }

    let whereClause: any = { store: storeFilter };

    if (feedType === 'following') {
      const follows = await prisma.follow.findMany({ where: { userId }, select: { storeId: true } });
      whereClause.storeId = { in: follows.map(f => f.storeId) };
    }

    const [total, posts] = await Promise.all([
      prisma.post.count({ where: whereClause }),
      prisma.post.findMany({
        where: whereClause,
        include: {
          store: { select: { id: true, storeName: true, logoUrl: true, latitude: true, longitude: true, category: true, averageRating: true, hideRatings: true, chatEnabled: true, ownerId: true, owner: { select: { id: true, role: true } } } },
          product: { select: { id: true, productName: true, price: true, category: true } },
          likes: { where: { userId }, select: { id: true } },
          _count: { select: { likes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

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

  static async togglePin(postId: string) {
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new Error("Post not found");

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
