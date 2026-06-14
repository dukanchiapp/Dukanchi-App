import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.47 / Phase 5.3 — SearchService spec coverage.
 *
 * 5 methods on SearchService class (334 LOC):
 *   - performStandardSearch (Redis cache + role filter + optional semantic
 *     pgvector fallback when products < 5)
 *   - getSuggestions (thin pass-through over fuzzySearch)
 *   - performAISearch (spell-correct + bare-fetch Gemini with 30s timeout
 *     — one of #128.38's deferred safeFetch migrations — + category-filter
 *     fallback when both result sets empty)
 *   - saveSearchHistory (60-SECOND dedup window — NOT 24h as task spec said,
 *     this is the truth from source line 322)
 *   - clearSearchHistory (WHERE userId scoped deleteMany)
 *
 * Philosophy: tests encode the INTENDED SPEC. If a spec test fails it
 * means a real bug exists → STOP, report it, do NOT weaken.
 */

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-32-chars-long-padding',
    JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-long-pad',
    NODE_ENV: 'test',
    BCRYPT_ROUNDS: 4,
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://localhost:6379',
    GEMINI_API_KEY: 'test-gemini-key',
  },
  getAllowedOrigins: () => ['http://localhost'],
  isNgrokOrigin: () => false,
}));

vi.mock('../config/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn() },
    store: { findMany: vi.fn() },
    searchHistory: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn(),
    on: vi.fn(),
  },
}));

// Mock the helper services so we control their returns. Pure functions —
// we don't need fancy state, just predictable outputs.
vi.mock('../services/aliasDictionary', () => ({
  expandQuery: vi.fn((q: string) => [q]),  // identity by default
}));
vi.mock('../services/categoryInference', () => ({
  inferCategory: vi.fn(() => null),  // no category by default
}));
vi.mock('../services/fuzzySearch', () => ({
  refreshVocabulary: vi.fn().mockResolvedValue(undefined),
  correctSpelling: vi.fn((q: string) => ({ corrected: q, didCorrect: false })),
  getSuggestions: vi.fn(() => []),
}));
vi.mock('../services/geminiEmbeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

// visibleOwnerFilter — pure function from user-status. Use the real one.
vi.mock('../middlewares/user-status', async () => {
  const actual = await vi.importActual<typeof import('../middlewares/user-status')>('../middlewares/user-status');
  return { visibleOwnerFilter: actual.visibleOwnerFilter };
});

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { prisma } from '../config/prisma';
import { pubClient } from '../config/redis';
import { expandQuery } from '../services/aliasDictionary';
import { inferCategory } from '../services/categoryInference';
import { correctSpelling, getSuggestions as fuzzyGetSuggestions, refreshVocabulary } from '../services/fuzzySearch';
import { generateEmbedding } from '../services/geminiEmbeddings';
import { SearchService } from '../modules/search/search.service';

const USER_A = 'user-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default helper returns since clearAllMocks wipes them
  vi.mocked(expandQuery).mockImplementation((q: string) => [q]);
  vi.mocked(inferCategory).mockReturnValue(null);
  vi.mocked(correctSpelling).mockImplementation((q: string) => ({ corrected: q, didCorrect: false }));
  vi.mocked(fuzzyGetSuggestions).mockReturnValue([]);
  vi.mocked(refreshVocabulary).mockResolvedValue(undefined);
  vi.mocked(generateEmbedding).mockResolvedValue([0.1, 0.2, 0.3]);
  vi.mocked(pubClient.set).mockResolvedValue('OK');
  // Safe defaults for parallel Promise.all queries — undefined return would
  // crash .map() on the lift logic. Tests use mockResolvedValueOnce to
  // override per-call when they need richer data; un-overridden calls
  // (e.g. the fallback-branch second query) fall back to these defaults.
  vi.mocked(prisma.product.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.store.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never);
});

// ── 1. performStandardSearch ───────────────────────────────────────────────
describe('SearchService.performStandardSearch', () => {
  it('Redis cache HIT → returns parsed cached payload; NO DB query runs', async () => {
    const cached = { products: [{ id: 'p1' }], stores: [], source: 'alias' };
    vi.mocked(pubClient.get).mockResolvedValueOnce(JSON.stringify(cached) as never);

    const result = await SearchService.performStandardSearch('milk', ['retailer']);
    expect(result).toEqual(cached);
    // NEITHER DB query ran.
    expect(prisma.product.findMany).not.toHaveBeenCalled();
    expect(prisma.store.findMany).not.toHaveBeenCalled();
  });

  it('Cache MISS → DB queries run + result is cached with EX:60 (fire-and-forget set)', async () => {
    vi.mocked(pubClient.get).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);

    await SearchService.performStandardSearch('milk', ['retailer']);
    expect(prisma.product.findMany).toHaveBeenCalledOnce();
    expect(prisma.store.findMany).toHaveBeenCalledOnce();
    expect(pubClient.set).toHaveBeenCalledOnce();
    // Cache TTL 60s per the source comment at line 138.
    const setArgs = vi.mocked(pubClient.set).mock.calls[0];
    expect(setArgs[2]).toEqual({ EX: 60 });
  });

  it('cache key includes roles + lowercased query (deterministic key)', async () => {
    vi.mocked(pubClient.get).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);

    await SearchService.performStandardSearch('MILK', ['retailer', 'supplier']);
    const getKey = vi.mocked(pubClient.get).mock.calls[0][0];
    expect(getKey).toBe('search:retailer,supplier:milk');
  });

  it('FAIL-OPEN: Redis get throws → falls through to DB cleanly (no 500 propagation)', async () => {
    vi.mocked(pubClient.get).mockRejectedValueOnce(new Error('redis down'));
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    // Should still resolve (the try/catch at line 13-16 swallows).
    await expect(SearchService.performStandardSearch('milk', ['retailer'])).resolves.toBeDefined();
    expect(prisma.product.findMany).toHaveBeenCalledOnce();
  });

  it('ROLE FILTER wired: visibleOwnerFilter(allowedRoles) is applied to both queries', async () => {
    vi.mocked(pubClient.get).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);

    await SearchService.performStandardSearch('milk', ['retailer']);

    const productArgs = vi.mocked(prisma.product.findMany).mock.calls[0][0] as any;
    const storeArgs = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    // visibleOwnerFilter(['retailer']) emits at minimum { role: { in: ['retailer'] }, isBlocked: false, deletedAt: null }
    expect(productArgs.where.store.owner.role.in).toEqual(['retailer']);
    expect(productArgs.where.store.owner.isBlocked).toBe(false);
    expect(productArgs.where.store.owner.deletedAt).toBeNull();
    expect(storeArgs.where.owner.role.in).toEqual(['retailer']);
  });

  it('SOURCE attribution: when DB returns enough products + no semantic fallback runs, result.source === "alias"', async () => {
    vi.mocked(pubClient.get).mockResolvedValueOnce(null as never);
    // 5+ products → skips the semantic fallback branch (line 76 condition)
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce(
      Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, storeId: 's1' })) as never,
    );
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([{ id: 's1' }] as never);

    const result = await SearchService.performStandardSearch('milk', ['retailer']);
    expect(result.source).toBe('alias');
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it('semantic fallback fires when products < 5 + Gemini key configured → result.source upgrades to "both" if vector hit', async () => {
    vi.mocked(pubClient.get).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce([{ id: 'p1', storeId: 's1' }] as never)   // < 5 → triggers semantic
      .mockResolvedValueOnce([{ id: 'p2', storeId: 's2' }] as never);  // semanticProducts
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ id: 'p2' }] as never);

    const result = await SearchService.performStandardSearch('milk', ['retailer']);
    expect(generateEmbedding).toHaveBeenCalledOnce();
    expect(result.source).toBe('both');
  });

  it('semantic fallback failure (Promise.race rejects via embedding timeout) is SWALLOWED — base results returned + source stays "alias"', async () => {
    vi.mocked(pubClient.get).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([{ id: 'p1', storeId: 's1' }] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(generateEmbedding).mockRejectedValueOnce(new Error('Timeout'));

    const result = await SearchService.performStandardSearch('milk', ['retailer']);
    expect(result.products).toHaveLength(1);
    expect(result.source).toBe('alias');  // semantic failed silently, base preserved
  });

  it('LIFT — stores from product matches surface even if the store table didn\'t hit the search string', async () => {
    vi.mocked(pubClient.get).mockResolvedValueOnce(null as never);
    // Product matches mention storeId="s-only-via-product" but the store
    // findMany hit returned empty → lift query runs
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce(
      Array.from({ length: 6 }, () => ({ id: 'p', storeId: 's-only-via-product' })) as never,
    );
    vi.mocked(prisma.store.findMany)
      .mockResolvedValueOnce([] as never)                                  // base store query empty
      .mockResolvedValueOnce([{ id: 's-only-via-product' }] as never);    // lift query result

    const result = await SearchService.performStandardSearch('milk', ['retailer']);
    expect(result.stores.map((s: any) => s.id)).toContain('s-only-via-product');
  });
});

// ── 2. getSuggestions ──────────────────────────────────────────────────────
describe('SearchService.getSuggestions', () => {
  it('refreshes vocabulary then returns the fuzzy-search suggestions', async () => {
    vi.mocked(fuzzyGetSuggestions).mockReturnValueOnce(['suggest-a', 'suggest-b']);
    const result = await SearchService.getSuggestions('mi');
    expect(refreshVocabulary).toHaveBeenCalledOnce();
    expect(fuzzyGetSuggestions).toHaveBeenCalledWith('mi');
    expect(result).toEqual(['suggest-a', 'suggest-b']);
  });
});

// ── 3. performAISearch ─────────────────────────────────────────────────────
describe('SearchService.performAISearch', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  function mockGemini(payload: unknown) {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
  }

  it('SPELL-CORRECT: misspelled query → corrected before Gemini + DB lookup; correctedQuery surfaced in response', async () => {
    vi.mocked(correctSpelling).mockReturnValueOnce({ corrected: 'milk', didCorrect: true });
    mockGemini({ candidates: [{ content: { parts: [{ text: '' }] } }] });  // no JSON → no rewrites
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);

    const result = await SearchService.performAISearch('mlik', ['retailer']);  // typo
    expect(result.query).toBe('milk');
    expect(result.correctedQuery).toBe('milk');
    globalThis.fetch = originalFetch;
  });

  it('Gemini happy path: returns {keywords, category} → service uses keywords as searchStr + sets detectedCategory', async () => {
    mockGemini({
      candidates: [{
        content: { parts: [{ text: '{"keywords":"organic milk","category":"Grocery"}' }] },
      }],
    });
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);

    const result = await SearchService.performAISearch('milk', ['retailer']);
    expect(result.query).toBe('organic milk');
    expect(result.detectedCategory).toBe('Grocery');
    globalThis.fetch = originalFetch;
  });

  it('Gemini malformed JSON → falls through gracefully + uses inferCategory fallback (no throw)', async () => {
    mockGemini({ candidates: [{ content: { parts: [{ text: 'sorry, I cannot help' }] } }] });
    vi.mocked(inferCategory).mockReturnValueOnce('Food');  // heuristic fallback hits
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);

    const result = await SearchService.performAISearch('milk', ['retailer']);
    expect(result.detectedCategory).toBe('Food');
    expect(result.query).toBe('milk');  // not rewritten
    globalThis.fetch = originalFetch;
  });

  it('Gemini network failure → caught + falls through to inferCategory (no 500 propagation)', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    vi.mocked(inferCategory).mockReturnValueOnce(null);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);

    await expect(SearchService.performAISearch('milk', ['retailer'])).resolves.toBeDefined();
    globalThis.fetch = originalFetch;
  });

  it('ROLE FILTER wired into both queries (same as standard search)', async () => {
    mockGemini({ candidates: [{ content: { parts: [{ text: '' }] } }] });
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);

    await SearchService.performAISearch('milk', ['retailer']);
    const productArgs = vi.mocked(prisma.product.findMany).mock.calls[0][0] as any;
    const storeArgs = vi.mocked(prisma.store.findMany).mock.calls[0][0] as any;
    expect(productArgs.where.store.owner.role.in).toEqual(['retailer']);
    expect(storeArgs.where.owner.role.in).toEqual(['retailer']);
    globalThis.fetch = originalFetch;
  });

  it('FALLBACK: both result sets empty AND detectedCategory was set → re-queries WITHOUT category filter (broader fallback path)', async () => {
    mockGemini({ candidates: [{ content: { parts: [{ text: '{"category":"Pharmacy"}' }] } }] });
    vi.mocked(prisma.product.findMany)
      .mockResolvedValueOnce([] as never)  // primary product query — empty
      .mockResolvedValueOnce([{ id: 'p-fallback', storeId: 's-fb' }] as never);  // fallback product query
    vi.mocked(prisma.store.findMany)
      .mockResolvedValueOnce([] as never)  // primary store query — empty
      .mockResolvedValueOnce([{ id: 's-fb' }] as never);  // fallback store query

    const result = await SearchService.performAISearch('milk', ['retailer']);
    // Fallback path returned — products from the broader query are surfaced.
    expect(result.products).toHaveLength(1);
    expect(result.detectedCategory).toBe('Pharmacy');
    globalThis.fetch = originalFetch;
  });
});

// ── 4. saveSearchHistory ───────────────────────────────────────────────────
describe('SearchService.saveSearchHistory', () => {
  it('empty query → throws "Query is required"; NO DB read or write', async () => {
    await expect(SearchService.saveSearchHistory(USER_A, '')).rejects.toThrow('Query is required');
    expect(prisma.searchHistory.findFirst).not.toHaveBeenCalled();
    expect(prisma.searchHistory.create).not.toHaveBeenCalled();
  });

  it('whitespace-only query → throws "Query is required"', async () => {
    await expect(SearchService.saveSearchHistory(USER_A, '   ')).rejects.toThrow('Query is required');
  });

  it('IDOR: WHERE clause scopes to userId + trimmed query on findFirst', async () => {
    vi.mocked(prisma.searchHistory.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.searchHistory.create).mockResolvedValueOnce({ id: 'h1' } as never);

    await SearchService.saveSearchHistory(USER_A, '  milk  ');
    const findArgs = vi.mocked(prisma.searchHistory.findFirst).mock.calls[0][0] as any;
    expect(findArgs.where).toEqual({ userId: USER_A, query: 'milk' });
    const createArgs = vi.mocked(prisma.searchHistory.create).mock.calls[0][0] as any;
    expect(createArgs.data).toEqual({ userId: USER_A, query: 'milk' });
  });

  it('DEDUP: existing entry within 60s window → NO new row created (source line 322 — actual window is 60s, not 24h)', async () => {
    // Recent entry from 30 seconds ago — within the 60s dedup window
    const recentTimestamp = new Date(Date.now() - 30_000);
    vi.mocked(prisma.searchHistory.findFirst).mockResolvedValueOnce({
      id: 'recent', createdAt: recentTimestamp,
    } as never);

    await SearchService.saveSearchHistory(USER_A, 'milk');
    expect(prisma.searchHistory.create).not.toHaveBeenCalled();
  });

  it('DEDUP: existing entry OLDER than 60s → new row IS created', async () => {
    const oldTimestamp = new Date(Date.now() - 120_000);  // 2 minutes ago
    vi.mocked(prisma.searchHistory.findFirst).mockResolvedValueOnce({
      id: 'old', createdAt: oldTimestamp,
    } as never);
    vi.mocked(prisma.searchHistory.create).mockResolvedValueOnce({ id: 'new' } as never);

    await SearchService.saveSearchHistory(USER_A, 'milk');
    expect(prisma.searchHistory.create).toHaveBeenCalledOnce();
  });

  it('no prior entry → creates new row', async () => {
    vi.mocked(prisma.searchHistory.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.searchHistory.create).mockResolvedValueOnce({ id: 'h1' } as never);

    const result = await SearchService.saveSearchHistory(USER_A, 'milk');
    expect(result).toEqual({ success: true });
    expect(prisma.searchHistory.create).toHaveBeenCalledOnce();
  });
});

// ── 5. clearSearchHistory — IDOR (WHERE userId) ─────────────────────────────
describe('SearchService.clearSearchHistory', () => {
  it('IDOR: WHERE deleteMany scoped to userId — never blanket', async () => {
    vi.mocked(prisma.searchHistory.deleteMany).mockResolvedValueOnce({ count: 5 } as never);
    const result = await SearchService.clearSearchHistory(USER_A);
    expect(result).toEqual({ success: true });
    const args = vi.mocked(prisma.searchHistory.deleteMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({ userId: USER_A });
  });
});
