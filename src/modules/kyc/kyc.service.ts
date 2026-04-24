import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";

const ADMIN_STATS_KEY = 'admin:stats';

export class KycService {
  static async submitKyc(userId: string, data: any) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        kycDocumentUrl: data.documentUrl,
        kycSelfieUrl: data.selfieUrl,
        kycStatus: "pending",
        kycStoreName: data.storeName || null,
        kycStorePhoto: data.storePhoto || null,
        kycSubmittedAt: new Date(),
        kycNotes: null,
      },
      select: { id: true, kycStatus: true, kycSubmittedAt: true },
    });

    await pubClient.del(ADMIN_STATS_KEY);
    return user;
  }

  static async getKycStatus(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, kycNotes: true, kycSubmittedAt: true, kycReviewedAt: true, kycStoreName: true, kycStorePhoto: true },
    });
  }
}
