import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";
import bcrypt from "bcrypt";
import xlsx from "xlsx";

const ADMIN_STATS_KEY = 'admin:stats';
const ADMIN_STATS_TTL = 60;
const PROTECTED_ADMIN_ID = '5cbf1a3d-e8e7-4b64-836a-58475bbbb7d9';

export class AdminService {
  static async getStats() {
    try {
      const cached = await pubClient.get(ADMIN_STATS_KEY);
      if (cached) return JSON.parse(cached.toString());
    } catch { /* Redis unavailable — fall through to DB */ }

    const [usersCount, storesCount, postsCount, reviewsCount, reportsCount] = await Promise.all([
      prisma.user.count(),
      prisma.store.count(),
      prisma.post.count(),
      prisma.review.count(),
      prisma.report.count(),
    ]);

    const [recentUsers, recentReports] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, role: true, phone: true, createdAt: true, kycStoreName: true, stores: { select: { storeName: true } } },
      }),
      prisma.report.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          reportedByUser: { select: { name: true } },
          reportedUser: { select: { name: true } },
          reportedStore: { select: { storeName: true } },
        },
      }),
    ]);

    const result = { users: usersCount, stores: storesCount, posts: postsCount, reviews: reviewsCount, reports: reportsCount, recentUsers, recentReports };
    try { await pubClient.set(ADMIN_STATS_KEY, JSON.stringify(result), { EX: ADMIN_STATS_TTL }); } catch { /* Redis unavailable — non-fatal */ }
    return result;
  }

  static async getUsers(options: any) {
    const { search, role, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }];
    if (role && role !== "all") where.role = role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, phone: true, email: true, role: true, location: true, createdAt: true, isBlocked: true, kycStoreName: true, stores: { select: { id: true, storeName: true, logoUrl: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async resetPassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) throw new Error("Password must be at least 6 characters");
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    return { success: true };
  }

  static async updateUser(id: string, role?: string, isBlocked?: boolean) {
    if (id === PROTECTED_ADMIN_ID) throw new Error("This admin account cannot be modified");

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (isBlocked !== undefined) updateData.isBlocked = isBlocked;

    const result = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, role: true, isBlocked: true },
    });

    // Invalidate blocked-status cache so changes take effect immediately
    if (isBlocked !== undefined) {
      try { await pubClient.del(`blocked:${id}`); } catch { /* non-fatal */ }
    }

    return result;
  }

  static async bulkUpdateUsers(userIds: string[], isBlocked: boolean, currentUserId: string) {
    const safeUserIds = (isBlocked === true)
      ? userIds.filter(id => id !== currentUserId && id !== PROTECTED_ADMIN_ID)
      : userIds.filter(id => id !== PROTECTED_ADMIN_ID);
    
    if (safeUserIds.length === 0) return { success: true, count: 0 };

    await prisma.user.updateMany({
      where: { id: { in: safeUserIds } },
      data: { isBlocked: !!isBlocked }
    });

    // Invalidate blocked-status cache for all affected users
    try {
      await Promise.all(safeUserIds.map(id => pubClient.del(`blocked:${id}`)));
    } catch { /* non-fatal */ }

    return { success: true };
  }

  static async deleteUser(id: string) {
    if (id === PROTECTED_ADMIN_ID) throw new Error("This admin account cannot be deleted");

    await prisma.$transaction([
      prisma.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } }),
      prisma.follow.deleteMany({ where: { userId: id } }),
      prisma.review.deleteMany({ where: { userId: id } }),
      prisma.notification.deleteMany({ where: { userId: id } }),
      prisma.savedItem.deleteMany({ where: { userId: id } }),
      prisma.searchHistory.deleteMany({ where: { userId: id } }),
      prisma.savedLocation.deleteMany({ where: { userId: id } }),
      prisma.like.deleteMany({ where: { userId: id } }),
      prisma.complaint.deleteMany({ where: { userId: id } }),
      prisma.report.deleteMany({ where: { OR: [{ reportedByUserId: id }, { reportedUserId: id }] } }),
    ]);

    const userStores = await prisma.store.findMany({ where: { ownerId: id } });
    for (const store of userStores) {
      const storePosts = await prisma.post.findMany({ where: { storeId: store.id } });
      const postIds = storePosts.map(p => p.id);
      
      const storeProducts = await prisma.product.findMany({ where: { storeId: store.id } });
      const productIds = storeProducts.map(p => p.id);
      
      await prisma.$transaction([
        prisma.like.deleteMany({ where: { postId: { in: postIds } } }),
        prisma.post.deleteMany({ where: { storeId: store.id } }),
        prisma.review.deleteMany({ where: { OR: [{ storeId: store.id }, { productId: { in: productIds } }] } }),
        prisma.product.deleteMany({ where: { storeId: store.id } }),
        prisma.follow.deleteMany({ where: { storeId: store.id } }),
        prisma.teamMember.deleteMany({ where: { storeId: store.id } }),
        prisma.report.deleteMany({ where: { reportedStoreId: store.id } }),
        prisma.store.delete({ where: { id: store.id } }),
      ]);
    }

    await prisma.user.delete({ where: { id } });
    return { success: true };
  }

  static async getStores(options: any) {
    const { search, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) where.OR = [{ storeName: { contains: search, mode: "insensitive" } }, { category: { contains: search, mode: "insensitive" } }];

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { name: true, phone: true, role: true, isBlocked: true } },
          _count: { select: { followers: true, posts: true, products: true } },
        },
      }),
      prisma.store.count({ where }),
    ]);

    return { stores, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async deleteStore(id: string) {
    const storePosts = await prisma.post.findMany({ where: { storeId: id } });
    const postIds = storePosts.map(p => p.id);

    const storeProducts = await prisma.product.findMany({ where: { storeId: id } });
    const productIds = storeProducts.map(p => p.id);

    await prisma.$transaction([
      prisma.like.deleteMany({ where: { postId: { in: postIds } } }),
      prisma.post.deleteMany({ where: { storeId: id } }),
      prisma.review.deleteMany({ where: { OR: [{ storeId: id }, { productId: { in: productIds } }] } }),
      prisma.product.deleteMany({ where: { storeId: id } }),
      prisma.follow.deleteMany({ where: { storeId: id } }),
      prisma.teamMember.deleteMany({ where: { storeId: id } }),
      prisma.report.deleteMany({ where: { reportedStoreId: id } }),
      prisma.store.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  static async getStoreMembers(search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { storeName: { contains: search, mode: 'insensitive' } },
        { owner: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    return prisma.store.findMany({
      where,
      select: {
        id: true, storeName: true, category: true, logoUrl: true, address: true, city: true, state: true, postalCode: true, latitude: true, longitude: true, createdAt: true,
        owner: { select: { id: true, name: true, phone: true, role: true, email: true } },
        _count: { select: { teamMembers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getStoreMemberDetails(storeId: string) {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true, storeName: true, category: true, logoUrl: true, address: true, city: true, state: true, postalCode: true, latitude: true, longitude: true, phone: true, createdAt: true,
        owner: { select: { id: true, name: true, phone: true, role: true, email: true, createdAt: true } },
        teamMembers: {
          select: { id: true, name: true, phone: true, role: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!store) throw new Error("Store not found");
    return store;
  }

  static async deleteTeamMember(memberId: string) {
    const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member) throw new Error("Team member not found");
    await prisma.teamMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  static async exportStores() {
    const stores = await prisma.store.findMany({
      select: {
        id: true, storeName: true, category: true, address: true, city: true, state: true, postalCode: true, latitude: true, longitude: true, phone: true, gstNumber: true, openingTime: true, closingTime: true, workingDays: true, is24Hours: true, createdAt: true,
        owner: { select: { id: true, name: true, phone: true, email: true, role: true } },
        _count: { select: { teamMembers: true, posts: true, followers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = stores.map(s => ({
      'Store ID': s.id,
      'Store Name': s.storeName,
      'Category': s.category,
      'Address': s.address,
      'City': s.city ?? '',
      'State': s.state ?? '',
      'Postal Code': s.postalCode ?? '',
      'Latitude': s.latitude,
      'Longitude': s.longitude,
      'Google Maps Link': s.latitude && s.longitude ? `https://www.google.com/maps?q=${s.latitude},${s.longitude}` : '',
      'Store Phone': s.phone ?? '',
      'GST Number': s.gstNumber ?? '',
      'Opening Time': s.openingTime ?? '',
      'Closing Time': s.closingTime ?? '',
      'Working Days': s.workingDays ?? '',
      'Is 24 Hours': s.is24Hours ? 'Yes' : 'No',
      'Owner ID': s.owner.id,
      'Owner Name': s.owner.name,
      'Owner Phone': s.owner.phone ?? '',
      'Owner Email': s.owner.email ?? '',
      'Owner Role': s.owner.role,
      'Team Members': s._count.teamMembers,
      'Total Posts': s._count.posts,
      'Followers': s._count.followers,
      'Created At': new Date(s.createdAt).toISOString(),
    }));

    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Stores');
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  static async getReports(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reportedByUser: { select: { id: true, name: true, phone: true } },
          reportedUser: { select: { id: true, name: true, phone: true } },
          reportedStore: { select: { id: true, storeName: true } },
        },
      }),
      prisma.report.count(),
    ]);
    return { reports, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async deleteReport(id: string) {
    await prisma.report.delete({ where: { id } });
    return { success: true };
  }

  static async getChats(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: "desc" },
      take: limit * 10,
      skip,
      include: {
        sender:   { select: { id: true, name: true, role: true, stores: { select: { storeName: true }, take: 1 } } },
        receiver: { select: { id: true, name: true, role: true, stores: { select: { storeName: true }, take: 1 } } },
      },
    });

    const conversationPairs = new Map<string, any>();
    for (const msg of messages) {
      const ids = [msg.senderId, msg.receiverId].sort();
      const key = ids.join("_");
      if (!conversationPairs.has(key)) {
        conversationPairs.set(key, {
          id: key,
          user1: msg.senderId === ids[0] ? msg.sender : msg.receiver,
          user2: msg.senderId === ids[1] ? msg.sender : msg.receiver,
          lastMessage: msg.message,
          timestamp: msg.createdAt,
          count: 1,
        });
      } else {
        conversationPairs.get(key).count++;
      }
    }

    return Array.from(conversationPairs.values()).slice(0, limit);
  }

  static async getChatHistory(u1: string, u2: string) {
    if (!u1 || !u2) throw new Error("Both user IDs are required");
    return prisma.message.findMany({
      where: {
        OR: [
          { senderId: u1, receiverId: u2 },
          { senderId: u2, receiverId: u1 },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, role: true, kycStoreName: true, stores: { select: { storeName: true } } } },
        receiver: { select: { id: true, name: true, role: true, kycStoreName: true, stores: { select: { storeName: true } } } },
      },
    });
  }

  static async getSettings() {
    let settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!settings) {
      settings = await prisma.appSettings.create({ data: { id: "singleton" } });
    }
    return settings;
  }

  static async updateSettings(data: any) {
    const updateData: any = {};
    if (data.appName !== undefined) updateData.appName = data.appName;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.accentColor !== undefined) updateData.accentColor = data.accentColor;
    if (data.carouselImages !== undefined) updateData.carouselImages = data.carouselImages;

    return prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: updateData,
      create: { id: "singleton", ...updateData },
    });
  }

  static async getComplaints(status: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status && status !== "all") where.status = status;

    const [complaints, total, openCount, inProgressCount, resolvedCount] = await Promise.all([
      prisma.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, phone: true, role: true } },
        },
      }),
      prisma.complaint.count({ where }),
      prisma.complaint.count({ where: { status: "open" } }),
      prisma.complaint.count({ where: { status: "in_progress" } }),
      prisma.complaint.count({ where: { status: "resolved" } }),
    ]);

    return { complaints, total, openCount, inProgressCount, resolvedCount, page, totalPages: Math.ceil(total / limit) };
  }

  static async updateComplaint(id: string, status?: string, adminNotes?: string) {
    const updateData: any = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    return prisma.complaint.update({
      where: { id },
      data: updateData,
    });
  }

  static async deleteComplaint(id: string) {
    await prisma.complaint.delete({ where: { id } });
    return { success: true };
  }

  static async getPosts(search: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { caption: { contains: search, mode: "insensitive" } },
        { store: { storeName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          store: { select: { id: true, storeName: true, owner: { select: { name: true, role: true } } } },
          _count: { select: { likes: true } },
        },
      }),
      prisma.post.count({ where }),
    ]);

    return { posts, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async deletePost(id: string) {
    await prisma.like.deleteMany({ where: { postId: id } });
    await prisma.savedItem.deleteMany({ where: { type: 'post', referenceId: id } });
    await prisma.post.delete({ where: { id } });
    return { success: true };
  }

  static async getKycList(status: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where: any = { kycStatus: { not: "none" }, role: { not: "admin" } };
    if (status && status !== "all") where.kycStatus = status;

    const [users, total, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { kycSubmittedAt: "desc" },
        select: { id: true, name: true, phone: true, role: true, kycStatus: true, kycDocumentUrl: true, kycSelfieUrl: true, kycNotes: true, kycSubmittedAt: true, kycReviewedAt: true, kycStoreName: true, kycStorePhoto: true },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { kycStatus: "pending", role: { not: "admin" } } }),
      prisma.user.count({ where: { kycStatus: "approved", role: { not: "admin" } } }),
      prisma.user.count({ where: { kycStatus: "rejected", role: { not: "admin" } } }),
    ]);

    return { users, total, pendingCount, approvedCount, rejectedCount, page, totalPages: Math.ceil(total / limit) };
  }

  static async updateKycStatus(userId: string, status: string, notes?: string) {
    // Fetch role first — admin accounts can never be KYC-approved into a store
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (target?.role === 'admin') {
      throw new Error('Cannot modify KYC status of an admin account');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: status,
        kycNotes: notes,
        kycReviewedAt: new Date(),
      },
      select: { id: true, name: true, kycStatus: true, kycStoreName: true, kycStorePhoto: true },
    });

    // On approval: always ensure the user has a store. Sync KYC name + photo if available.
    if (status === 'approved') {
      const existingStore = await prisma.store.findFirst({ where: { ownerId: userId } });
      const storeName = user.kycStoreName || `${user.name}'s Store`;
      const logoUrl = user.kycStorePhoto || null;

      let storeId: string;

      if (existingStore) {
        const updateData: any = {};
        if (user.kycStoreName) updateData.storeName = storeName;
        if (user.kycStorePhoto) updateData.logoUrl = logoUrl;
        if (Object.keys(updateData).length > 0) {
          await prisma.store.update({ where: { id: existingStore.id }, data: updateData });
        }
        storeId = existingStore.id;
      } else {
        const newStore = await prisma.store.create({
          data: { ownerId: userId, storeName, category: 'General', address: '', latitude: 0, longitude: 0, logoUrl },
        });
        storeId = newStore.id;
      }

      // Create the opening post from the KYC store photo if one doesn't already exist
      if (logoUrl) {
        const hasOpeningPost = await prisma.post.findFirst({
          where: { storeId, isOpeningPost: true },
          select: { id: true },
        });
        if (!hasOpeningPost) {
          await prisma.post.create({
            data: {
              storeId,
              imageUrl: logoUrl,
              caption: `Welcome to ${storeName}! We are now open.`,
              isOpeningPost: true,
            },
          });
        }
      }
    }

    try { await pubClient.del(ADMIN_STATS_KEY); } catch { /* Redis unavailable — non-fatal */ }
    return { id: user.id, name: user.name, kycStatus: user.kycStatus };
  }
}
