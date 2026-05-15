import { prisma } from "../../config/prisma";

export class MiscService {
  static async submitComplaint(userId: string, issueType: string, description: string) {
    return prisma.complaint.create({
      data: { userId, issueType, description },
    });
  }

  static async submitReport(reportedByUserId: string, reason: string, reportedUserId?: string, reportedStoreId?: string) {
    if (!reportedUserId && !reportedStoreId) {
      throw new Error("reportedUserId or reportedStoreId is required");
    }
    return prisma.report.create({
      data: { reason, reportedByUserId, reportedUserId: reportedUserId || null, reportedStoreId: reportedStoreId || null },
    });
  }

  static async getStoreReviews(storeId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    // Day 2.5 / D2 anonymize: reviews from deleted users stay visible (the
    // content is public-value; only the author's identity needs hiding).
    // Backend exposes deletedAt; frontend renders "Deleted user" when set.
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { storeId },
        include: { user: { select: { id: true, name: true, deletedAt: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { storeId } }),
    ]);
    return { reviews, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async getProductReviews(productId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    // Day 2.5 / D2 anonymize — same policy as getStoreReviews.
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId },
        include: { user: { select: { id: true, name: true, deletedAt: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { productId } }),
    ]);
    return { reviews, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async createReview(userId: string, data: any) {
    const { rating, comment, storeId, productId } = data;

    if (!storeId && !productId) throw new Error("Must review either a store or a product");
    if (storeId && productId) throw new Error("Cannot review both store and product at once");

    const newReview = await prisma.review.create({
      data: { rating, comment, storeId, productId, userId }
    });

    if (storeId) {
      const aggregates = await prisma.review.aggregate({
        where: { storeId },
        _avg: { rating: true },
        _count: { id: true }
      });
      await prisma.store.update({
        where: { id: storeId },
        data: { averageRating: aggregates._avg.rating || 0, reviewCount: aggregates._count.id }
      });
    } else if (productId) {
      const aggregates = await prisma.review.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: { id: true }
      });
      await prisma.product.update({
        where: { id: productId },
        data: { averageRating: aggregates._avg.rating || 0, reviewCount: aggregates._count.id }
      });
    }

    return newReview;
  }

  static async getAppSettings() {
    let settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      settings = await prisma.appSettings.create({ data: { id: "singleton" } });
    }
    return settings;
  }
}
