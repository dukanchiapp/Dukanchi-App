import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";
import { generateEmbedding } from "../../services/geminiEmbeddings";
import { logger } from "../../lib/logger";

const ADMIN_STATS_KEY = 'admin:stats';

export class StoreService {
  static async createStore(data: any) {
    const store = await prisma.store.create({
      data: {
        ownerId: data.ownerId,
        storeName: data.storeName || 'My Store',
        category: data.category || 'General',
        description: data.description || '',
        address: data.address || '',
        phone: data.phone || '',
        latitude: parseFloat(data.latitude) || 0,
        longitude: parseFloat(data.longitude) || 0,
        openingTime: data.openingTime || null,
        closingTime: data.closingTime || null,
        workingDays: data.workingDays || null,
        gstNumber: data.gstNumber || null,
        phoneVisible: data.phoneVisible !== undefined ? data.phoneVisible : true,
        logoUrl: data.logoUrl || null,
        postalCode: data.postalCode ? parseInt(data.postalCode) : null,
        city: data.city || null,
        state: data.state || null,
        is24Hours: data.is24Hours || false,
      }
    });
    try { await pubClient.del(ADMIN_STATS_KEY); } catch { /* Redis unavailable — non-fatal */ }
    return store;
  }

  static async updateStore(id: string, data: any) {
    const ALLOWED_FIELDS = [
      'storeName', 'category', 'description', 'address', 'phone',
      'openingHours', 'openingTime', 'closingTime', 'workingDays', 'is24Hours',
      'logoUrl', 'coverUrl', 'city', 'state', 'postalCode',
      'phoneVisible', 'hideRatings', 'chatEnabled',
      'manualProductText', 'gstNumber', 'gstOrBillUrl', 'selfieUrl',
      'latitude', 'longitude',
    ];
    const updateData: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in data) updateData[key] = (data as any)[key];
    }
    if (updateData.postalCode !== undefined) {
      const parsed = parseInt(updateData.postalCode);
      updateData.postalCode = isNaN(parsed) ? null : parsed;
    }

    const store = await prisma.store.update({
      where: { id },
      data: updateData
    });
    try { await pubClient.del(ADMIN_STATS_KEY); } catch { /* Redis unavailable — non-fatal */ }
    return store;
  }

  static async getStores(page: number, limit: number, viewerRole: string, category?: string, excludeOwnerId?: string) {
    const skip = (page - 1) * limit;
    const B2B = ['retailer', 'supplier', 'brand', 'manufacturer'];
    const visibleRoles = viewerRole === 'customer' ? ['retailer'] : B2B;
    // Soft-delete cascade: hide stores whose owners are in any deleted state
    // (deleted_pending OR deleted_expired). Stores reappear automatically if
    // the owner calls /api/account/restore within their 30-day grace.
    const where: any = { owner: { isBlocked: false, deletedAt: null, role: { in: visibleRoles } } };
    if (category) where.category = category;
    if (excludeOwnerId) {
      where.ownerId = { not: excludeOwnerId };
    }
    const [stores, total] = await Promise.all([
      prisma.store.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.store.count({ where }),
    ]);
    return { stores, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async getStoreById(id: string, currentUserId?: string) {
    // Soft-delete cascade: a store whose owner is in ANY deleted state is
    // hidden from public access. Decision (Step 5 / Session 88): "Option A"
    // — 404 for both deleted_pending and deleted_expired, simpler than
    // a "may be inactive" banner for grace-period stores. If owner restores
    // within 30 days, store reappears automatically.
    //
    // Uses findFirst (not findUnique) because Prisma's findUnique cannot
    // filter on relation fields. Performance impact is negligible — `id`
    // is still the PK and is the dominant filter.
    const store = await prisma.store.findFirst({
      where: { id, owner: { deletedAt: null } },
      include: {
        owner: { select: { role: true, isBlocked: true, deletedAt: true } },
        _count: {
          select: { posts: true, products: true, followers: true }
        },
        followers: currentUserId ? {
          where: { userId: currentUserId }
        } : false
      }
    });
    return store;
  }

  static async toggleFollow(userId: string, storeId: string) {
    try {
      const existingFollow = await prisma.follow.findUnique({
        where: { userId_storeId: { userId, storeId } }
      });

      if (existingFollow) {
        await prisma.follow.delete({ where: { userId_storeId: { userId, storeId } } });
        return { following: false };
      } else {
        const store = await prisma.store.findUnique({ where: { id: storeId } });
        if (!store) throw new Error('Store not found');
        await prisma.follow.create({ data: { userId, storeId } });
        return { following: true };
      }
    } catch (error: any) {
      if (error.message === 'Store not found') throw error;
      throw new Error(`Follow operation failed: ${error.message}`);
    }
  }

  static async getStorePosts(storeId: string, page: number, limit: number, viewerRole: string) {
    const skip = (page - 1) * limit;
    const B2B = ['retailer', 'supplier', 'brand', 'manufacturer'];
    const visibleRoles = viewerRole === 'customer' ? ['retailer'] : B2B;
    // Soft-delete cascade applied here too (defense in depth — the store
    // detail page already 404s for deleted owners; this filter ensures the
    // posts query is also a no-op if anyone reaches it directly).
    const blockedFilter = { storeId, store: { owner: { isBlocked: false, deletedAt: null, role: { in: visibleRoles } } } };
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: blockedFilter,
        include: {
          product: { select: { id: true, productName: true, price: true, category: true } },
          _count: { select: { likes: true } },
        },
        orderBy: [{ isOpeningPost: 'desc' }, { isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.post.count({ where: blockedFilter }),
    ]);
    return { posts, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async createProduct(data: any) {
    const product = await prisma.product.create({ data });
    
    // Fire-and-forget semantic embedding generation
    const textToEmbed = `${product.productName} ${product.category} ${product.description || ''}`.trim();
    generateEmbedding(textToEmbed).then(async (embedding) => {
      const vectorString = `[${embedding.join(',')}]`;
      await prisma.$executeRaw`UPDATE "Product" SET embedding = ${vectorString}::vector WHERE id = ${product.id}`;
    }).catch(err => logger.error({ err }, `Failed to generate embedding for new product ${product.id}`));

    return product;
  }

  static async getProducts(search?: string, category?: string, storeId?: string) {
    // Soft-delete cascade: products of deleted-owner stores are hidden.
    // Same policy as getStores — keeps the surface area consistent.
    const where: any = { store: { owner: { isBlocked: false, deletedAt: null } } };

    if (search) {
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (storeId) where.storeId = storeId;

    return prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50 // Legacy behaviour
    });
  }
}
