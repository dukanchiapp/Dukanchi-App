import { prisma } from "../../config/prisma";
import { pubClient } from "../../config/redis";
import { expandQuery } from "../../services/aliasDictionary";
import { inferCategory } from "../../services/categoryInference";
import { refreshVocabulary, correctSpelling, getSuggestions } from "../../services/fuzzySearch";
import { generateEmbedding } from "../../services/geminiEmbeddings";
import { env } from "../../config/env";
import { visibleOwnerFilter } from "../../middlewares/user-status";

export class SearchService {
  static async performStandardSearch(searchStr: string, allowedRoles: string[]) {
    const searchCacheKey = `search:${allowedRoles.join(',')}:${searchStr.toLowerCase()}`;
    try {
      const cached = await pubClient.get(searchCacheKey);
      if (cached) return JSON.parse(cached.toString());
    } catch { /* Redis unavailable — fall through to DB */ }

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
          store: { owner: visibleOwnerFilter(allowedRoles), ...storeCatFilter },
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
          owner: visibleOwnerFilter(allowedRoles),
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

    if (products.length < 5 && env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
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
              store: { owner: visibleOwnerFilter(allowedRoles) },
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

    // Lift stores from product matches into the stores array so a product hit always surfaces the parent store
    const existingStoreIds = new Set(stores.map((s: any) => s.id));
    const storeIdsFromProducts = [...new Set((products as any[]).map(p => p.storeId))].filter(id => !existingStoreIds.has(id));
    if (storeIdsFromProducts.length > 0) {
      const extraStores = await prisma.store.findMany({
        where: { id: { in: storeIdsFromProducts }, owner: visibleOwnerFilter(allowedRoles) },
        include: { owner: { select: { role: true, id: true } } },
        orderBy: { averageRating: 'desc' },
      });
      stores = [...stores, ...extraStores] as any;
    }

    console.log(`[SEARCH standard] q="${searchStr}" → ${products.length} products, ${stores.length} stores (${storeIdsFromProducts.length} lifted from products)`);
    const result = { products, stores, source };
    // Cache TTL 60s — soft-delete visibility may lag up to 60s in search
    // results (a retailer who deletes their account may still appear in
    // search hits cached just before the delete). Matches the userStatus
    // cache TTL pattern in user-status.ts. Trade-off accepted (Step 6 /
    // Session 88): invalidating all search cache keys on /delete would
    // require tracking which keys mention which users — prohibitively
    // expensive vs the slight staleness window.
    // NOTE: silent-catch below is on the cache write (fire-and-forget) —
    // queued for Step 7 silent-catch cleanup along with S4.
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
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        // 30s timeout — Subtask 3.5. Prevents pile-up if Gemini stalls.
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Extract the core search keywords from this shopping query. Return ONLY a JSON object with keys "keywords" (string, 2-5 words max) and "category" (one of: Electronics, Fashion, Grocery, Food, Beauty, Sports, Health, General, Jewellery, Vehicles, Education, Services, Furniture, Pharmacy, or empty string if unclear). No explanation.\n\nQuery: "${searchStr}"`
                }]
              }],
              generationConfig: { maxOutputTokens: 100, temperature: 0.1 }
            }),
            signal: AbortSignal.timeout(30_000),
          }
        );
        if (geminiRes.ok) {
          type GeminiTextResp = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
          const geminiData = (await geminiRes.json()) as GeminiTextResp;
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
            owner: visibleOwnerFilter(allowedRoles),
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
          owner: visibleOwnerFilter(allowedRoles),
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
            store: { owner: visibleOwnerFilter(allowedRoles) },
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
            owner: visibleOwnerFilter(allowedRoles),
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

      // Lift stores from fallback product matches
      const fbExisting = new Set(fallbackStores.map((s: any) => s.id));
      const fbExtraIds = [...new Set(fallbackProducts.map((p: any) => p.storeId))].filter(id => !fbExisting.has(id));
      let mergedFbStores: any[] = [...fallbackStores];
      if (fbExtraIds.length > 0) {
        const fbExtra = await prisma.store.findMany({
          where: { id: { in: fbExtraIds }, owner: visibleOwnerFilter(allowedRoles) },
          include: { owner: { select: { role: true, id: true } } },
          orderBy: { averageRating: 'desc' },
        });
        mergedFbStores = [...fallbackStores, ...fbExtra];
      }
      console.log(`[SEARCH ai-fallback] q="${searchStr}" cat="${detectedCategory}" → ${fallbackProducts.length} products, ${mergedFbStores.length} stores`);
      return { products: fallbackProducts, stores: mergedFbStores, query: searchStr, correctedQuery, detectedCategory };
    }

    // Lift stores from product matches into stores array
    const existingIds = new Set(stores.map((s: any) => s.id));
    const extraStoreIds = [...new Set(products.map((p: any) => p.storeId))].filter(id => !existingIds.has(id));
    let mergedStores: any[] = [...stores];
    if (extraStoreIds.length > 0) {
      const extraStores = await prisma.store.findMany({
        where: { id: { in: extraStoreIds }, owner: visibleOwnerFilter(allowedRoles) },
        include: { owner: { select: { role: true, id: true } } },
        orderBy: { averageRating: 'desc' },
      });
      mergedStores = [...stores, ...extraStores];
    }

    console.log(`[SEARCH ai] q="${searchStr}" cat="${detectedCategory}" → ${products.length} products, ${mergedStores.length} stores (${extraStoreIds.length} lifted)`);
    return { products, stores: mergedStores, query: searchStr, correctedQuery, detectedCategory };
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
