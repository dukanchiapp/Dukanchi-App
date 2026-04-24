import { prisma } from "../../config/prisma";

export class NotificationService {
  static async getNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  static async markAsRead(id: string, userId: string) {
    return prisma.notification.update({
      where: { id, userId },
      data: { isRead: true }
    });
  }

  static async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
    return { success: true };
  }
}
