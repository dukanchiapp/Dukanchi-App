import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";

const ADMIN_STATS_KEY = 'admin:stats';

export class UserService {
  static async getUserStore(userId: string) {
    return prisma.store.findFirst({
      where: { ownerId: userId },
      include: {
        _count: {
          select: { posts: true, products: true, followers: true }
        }
      }
    });
  }

  static async getUserProfile(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, email: true }
    });
  }

  static async updateUserProfile(id: string, data: { name?: string; phone?: string; email?: string }) {
    try {
      const user = await prisma.user.update({
        where: { id },
        data
      });
      try { await pubClient.del(ADMIN_STATS_KEY); } catch { /* Redis unavailable — non-fatal */ }
      return user;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new Error('This phone number is already in use by another account.');
      }
      throw error;
    }
  }

  static async getFollowedStores(userId: string) {
    const follows = await prisma.follow.findMany({
      where: { userId },
      include: {
        store: {
          select: { id: true, storeName: true, category: true, address: true, averageRating: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return follows.map(f => f.store);
  }

  static async getSavedItems(userId: string) {
    const saved = await prisma.savedItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    
    // For post-type saved items, fetch associated posts
    const postIds = saved.filter(s => s.type === 'post').map(s => s.referenceId);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: { store: true }
    });
    
    return { saved, posts };
  }

  static async getReviews(userId: string) {
    return prisma.review.findMany({
      where: { userId },
      include: {
        store: { select: { id: true, storeName: true } },
        product: { select: { id: true, productName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getSearchHistory(userId: string) {
    return prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  static async getLocations(userId: string) {
    return prisma.savedLocation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
