import * as Sentry from "@sentry/node";
import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";

const ADMIN_STATS_KEY = 'admin:stats';

// Session 128.38 (C-category caps). Hit-the-cap emits Sentry breadcrumb so we
// see growth before truncation matters; chosen 5000 as generous headroom over
// expected per-user upper bound (~hundreds), with 100× safety margin.
const PER_USER_FOLLOWED_CAP = 5000;
const PER_USER_SAVED_ITEMS_CAP = 5000;
const PER_USER_REVIEWS_CAP = 5000;
const PER_USER_LOCATIONS_CAP = 1000;

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
    // Public profile read: hide soft-deleted users from non-admin viewers.
    // Returns null (→ controller 404) for any user with deletedAt set, in any
    // state (deleted_pending or deleted_expired). Self-lookup (user fetching
    // own profile) is gated by authenticateToken in middleware — that path
    // rejects deleted users before they reach this service, so the filter
    // here covers cross-user public reads.
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
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
      orderBy: { createdAt: 'desc' },
      take: PER_USER_FOLLOWED_CAP,
    });
    if (follows.length === PER_USER_FOLLOWED_CAP) {
      Sentry.captureMessage('user.getFollowedStores.cap-hit', { level: 'warning', tags: { service: 'user' }, extra: { userId, cap: PER_USER_FOLLOWED_CAP } });
    }
    return follows.map(f => f.store);
  }

  static async getSavedItems(userId: string) {
    const saved = await prisma.savedItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PER_USER_SAVED_ITEMS_CAP,
    });
    if (saved.length === PER_USER_SAVED_ITEMS_CAP) {
      Sentry.captureMessage('user.getSavedItems.cap-hit', { level: 'warning', tags: { service: 'user' }, extra: { userId, cap: PER_USER_SAVED_ITEMS_CAP } });
    }

    // For post-type saved items, fetch associated posts.
    // Per D2 (anonymize policy): we DO NOT filter out posts whose author was
    // soft-deleted — the user's saved-posts list preserves historical
    // engagement (matches Reddit/Quora). Instead, we surface the owner's
    // deletedAt to the frontend so it can render a "Deleted user" label in
    // place of the author identity.
    const postIds = saved.filter(s => s.type === 'post').map(s => s.referenceId);
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: {
        store: {
          include: {
            owner: { select: { id: true, deletedAt: true } },
          },
        },
      },
    });

    return { saved, posts };
  }

  static async getReviews(userId: string) {
    const reviews = await prisma.review.findMany({
      where: { userId },
      include: {
        store: { select: { id: true, storeName: true } },
        product: { select: { id: true, productName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: PER_USER_REVIEWS_CAP,
    });
    if (reviews.length === PER_USER_REVIEWS_CAP) {
      Sentry.captureMessage('user.getReviews.cap-hit', { level: 'warning', tags: { service: 'user' }, extra: { userId, cap: PER_USER_REVIEWS_CAP } });
    }
    return reviews;
  }

  static async getSearchHistory(userId: string) {
    return prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  static async getLocations(userId: string) {
    const locations = await prisma.savedLocation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PER_USER_LOCATIONS_CAP,
    });
    if (locations.length === PER_USER_LOCATIONS_CAP) {
      Sentry.captureMessage('user.getLocations.cap-hit', { level: 'warning', tags: { service: 'user' }, extra: { userId, cap: PER_USER_LOCATIONS_CAP } });
    }
    return locations;
  }
}
