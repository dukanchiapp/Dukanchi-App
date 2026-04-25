import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";
import { generateEmbedding } from "../../services/geminiEmbeddings";

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
    try { await pubClient.del(ADMIN_STATS_KEY); } catch {}
    return store;
  }

  static async updateStore(id: string, data: any) {
    const updateData = { ...data };
    if (updateData.postalCode !== undefined) {
      const parsed = parseInt(updateData.postalCode);
      updateData.postalCode = isNaN(parsed) ? null : parsed;
    }

    const store = await prisma.store.update({
      where: { id },
      data: updateData
    });
    await pubClient.del(ADMIN_STATS_KEY);
    return store;
  }

  static async getStores(page: number, limit: number, category?: string) {
    const skip = (page - 1) * limit;
    const where: any = { owner: { isBlocked: false } };
    if (category) where.category = category;
    const [stores, total] = await Promise.all([
      prisma.store.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.store.count({ where }),
    ]);
    return { stores, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async getStoreById(id: string, currentUserId?: string) {
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        owner: { select: { role: true, isBlocked: true } },
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
    const existingFollow = await prisma.follow.findUnique({
      where: { userId_storeId: { userId, storeId } }
    });

    if (existingFollow) {
      await prisma.follow.delete({ where: { id: existingFollow.id } });
      return { following: false };
    } else {
      await prisma.follow.create({ data: { userId, storeId } });
      return { following: true };
    }
  }

  static async getStorePosts(storeId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const blockedFilter = { storeId, store: { owner: { isBlocked: false } } };
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
    }).catch(err => console.error(`Failed to generate embedding for new product ${product.id}`, err));

    return product;
  }

  static async getProducts(search?: string, category?: string, storeId?: string) {
    const where: any = { store: { owner: { isBlocked: false } } };

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
