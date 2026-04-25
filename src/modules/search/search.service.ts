import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";
import { expandQuery } from "../../services/aliasDictionary";
import { inferCategory } from "../../services/categoryInference";
import { refreshVocabulary, correctSpelling, getSuggestions } from "../../services/fuzzySearch";
import { generateEmbedding } from "../../services/geminiEmbeddings";

export class SearchService {
  static async performStandardSearch(searchStr: string, allowedRoles: string[]) {
    const searchCacheKey = `search:${allowedRoles.join(',')}:${searchStr.toLowerCase()}`;
    try {
      const cached = await pubClient.get(searchCacheKey);
      if (cached) return JSON.parse(cached.toString());
    } catch {}

    const expandedQueries = expandQuery(searchStr);
    const searchConditions = expandedQueries.map(sq => ({
      OR: [
        { productName: { contains: sq, mode: 'insensitive' as const } },
        { brand: { contains: sq, mode: 'insensitive' as const } },
        { category: { contains: sq, mode: 'insensitive' as const } },
        { description: { contains: sq, mode: 'insensitive' as const } },
      ]
    }));

    const detectedCategory = inferCategory(searchStr);
    const storeCatFilter: any = detectedCategory
      ? { category: { contains: detectedCategory.split(' ')[0], mode: 'insensitive' as const } }
      : {};

    let [products, stores] = await Promise.all([
      prisma.product.findMany({
        where: {
          store: { owner: { role: { in: allowedRoles } }, ...storeCatFilter },
          OR: searchConditions,
        },
        select: {
          id: true, productName: true, brand: true, category: true, price: true,
          description: true,
          storeId: true, store: {
            select: {
              id: true, storeName: true, logoUrl: true, category: true, ownerId: true,
              latitude: true, longitude: true, address: true,
              openingTime: true, closingTime: true, is24Hours: true, workingDays: true,
            }
          },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.store.findMany({
        where: {
          owner: { role: { in: allowedRoles } },
          OR: [
            { storeName: { contains: searchStr, mode: 'insensitive' } },
            { category: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } },
            { address: { contains: searchStr, mode: 'insensitive' } },
            { city: { contains: searchStr, mode: 'insensitive' } },
            { state: { contains: searchStr, mode: 'insensitive' } },
            { manualProductText: { contains: searchStr, mode: 'insensitive' } },
          ],
        },
        include: {
          owner: { select: { role: true, id: true } },
        },
        take: 20,
        orderBy: { averageRating: 'desc' },
      }),
    ]);

    let source = 'alias';

    if (products.length < 5 && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        const embedding = await Promise.race([
          generateEmbedding(searchStr),
          new Promise<number[]>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 500))
        ]);
        
        const vectorString = `[${embedding.join(',')}]`;
        const semanticProductIds: { id: string }[] = await prisma.$queryRaw`
          SELECT id FROM "Product"
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT 20
        `;
        
        if (semanticProductIds.length > 0) {
          const semanticProducts = await prisma.product.findMany({
            where: {
              id: { in: semanticProductIds.map(p => p.id) },
              store: { owner: { role: { in: allowedRoles } } },
            },
            select: {
              id: true, productName: true, brand: true, category: true, price: true,
              description: true,
              storeId: true, store: {
                select: {
                  id: true, storeName: true, logoUrl: true, category: true, ownerId: true,
                  latitude: true, longitude: true, address: true,
                  openingTime: true, closingTime: true, is24Hours: true, workingDays: true,
                }
              },
            }
          }) as any[];

          const existingIds = new Set(products.map((p: any) => p.id));
          for (const sp of semanticProducts) {
            if (!existingIds.has(sp.id)) {
              products.push(sp);
            }
          }
          if (semanticProducts.length > 0) source = 'both';
        }
      } catch (err) {
        console.warn('[SEARCH] Semantic fallback failed or timed out:', err);
      }
    }

    const result = { products, stores, source };
    pubClient.set(searchCacheKey, JSON.stringify(result), { EX: 60 }).catch(() => {});
    return result;
  }

  static async getSuggestions(query: string) {
    await refreshVocabulary(prisma);
    return getSuggestions(query);
  }

  static async performAISearch(searchStr: string, allowedRoles: string[]) {
    const { corrected, didCorrect } = correctSpelling(searchStr);
    const correctedQuery = didCorrect ? corrected : null;
    if (didCorrect) searchStr = corrected;

    let detectedCategory: string | null = null;
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, { credentials: 'include', 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Extract the core search keywords from this shopping query. Return ONLY a JSON object with keys "keywords" (string, 2-5 words max) and "category" (one of: Electronics, Fashion, Grocery, Food, Beauty, Sports, Health, General, Jewellery, Vehicles, Education, Services, Furniture, Pharmacy, or empty string if unclear). No explanation.\n\nQuery: "${searchStr}"`
                }]
              }],
              generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
            })
          }
        );
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.keywords) searchStr = parsed.keywords;
            if (parsed.category && parsed.category !== 'General') detectedCategory = parsed.category;
          }
        }
      } catch (e) {
      }
    }

    if (!detectedCategory) {
      detectedCategory = inferCategory(searchStr);
    }

    const storeCategoryFilter: any = detectedCategory
      ? { category: { contains: detectedCategory.split(' ')[0], mode: 'insensitive' } }
      : {};

    const PRODUCT_STORE_SELECT = {
      id: true, storeName: true, logoUrl: true, category: true, ownerId: true,
      latitude: true, longitude: true, address: true,
      openingTime: true, closingTime: true, is24Hours: true, workingDays: true,
    };
    const PRODUCT_SELECT = {
      id: true, productName: true, brand: true, category: true, price: true,
      description: true,
      storeId: true, store: { select: PRODUCT_STORE_SELECT },
    };

    let [products, stores] = await Promise.all([
      prisma.product.findMany({
        where: {
          store: {
            owner: { role: { in: allowedRoles } },
            ...storeCategoryFilter,
          },
          OR: [
            { productName: { contains: searchStr, mode: 'insensitive' } },
            { brand: { contains: searchStr, mode: 'insensitive' } },
            { category: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } },
          ],
        },
        select: PRODUCT_SELECT,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.store.findMany({
        where: {
          owner: { role: { in: allowedRoles } },
          ...storeCategoryFilter,
          OR: [
            { storeName: { contains: searchStr, mode: 'insensitive' } },
            { category: { contains: searchStr, mode: 'insensitive' } },
            { description: { contains: searchStr, mode: 'insensitive' } },
            { address: { contains: searchStr, mode: 'insensitive' } },
            { city: { contains: searchStr, mode: 'insensitive' } },
            { manualProductText: { contains: searchStr, mode: 'insensitive' } },
          ],
        },
        include: { owner: { select: { role: true, id: true } } },
        take: 20,
        orderBy: { averageRating: 'desc' },
      }),
    ]);

    if (products.length === 0 && stores.length === 0 && detectedCategory) {
      const [fallbackProducts, fallbackStores] = await Promise.all([
        prisma.product.findMany({
          where: {
            store: { owner: { role: { in: allowedRoles } } },
            OR: [
              { productName: { contains: searchStr, mode: 'insensitive' } },
              { brand: { contains: searchStr, mode: 'insensitive' } },
              { category: { contains: searchStr, mode: 'insensitive' } },
              { description: { contains: searchStr, mode: 'insensitive' } },
            ],
          },
          select: PRODUCT_SELECT,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.store.findMany({
          where: {
            owner: { role: { in: allowedRoles } },
            OR: [
              { storeName: { contains: searchStr, mode: 'insensitive' } },
              { category: { contains: searchStr, mode: 'insensitive' } },
              { description: { contains: searchStr, mode: 'insensitive' } },
            ],
          },
          include: { owner: { select: { role: true, id: true } } },
          take: 20,
          orderBy: { averageRating: 'desc' },
        }),
      ]);
      return { products: fallbackProducts, stores: fallbackStores, query: searchStr, correctedQuery, detectedCategory };
    }

    return { products, stores, query: searchStr, correctedQuery, detectedCategory };
  }

  static async saveSearchHistory(userId: string, query: string) {
    if (!query || !query.trim()) throw new Error("Query is required");

    const recent = await prisma.searchHistory.findFirst({
      where: { userId, query: query.trim() },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!recent || (Date.now() - new Date(recent.createdAt).getTime()) > 60000) {
      await prisma.searchHistory.create({
        data: { userId, query: query.trim() },
      });
    }
    return { success: true };
  }

  static async clearSearchHistory(userId: string) {
    await prisma.searchHistory.deleteMany({ where: { userId } });
    return { success: true };
  }
}
