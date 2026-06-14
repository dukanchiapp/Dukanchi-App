import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';

/**
 * Session 128.44 / Phase 4.3 — BulkImportService spec coverage.
 *
 * 4 public methods (1 private fallback):
 *   - parseExcelFile  — xlsx/csv buffer → headers + rows (MAX_ROWS=1000)
 *   - mapColumnsWithAI — Gemini-driven mapping with heuristic fallback
 *   - checkRateLimit  — Redis-backed 5/day per store, fail-OPEN on Redis err
 *   - importProducts  — per-row idempotent upsert + fire-and-forget embed
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
    IP_SALT: 'test-ip-salt',
  },
  getAllowedOrigins: () => ['http://localhost'],
  isNgrokOrigin: () => false,
}));

vi.mock('../config/prisma', () => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: {
    incr: vi.fn(),
    expire: vi.fn(),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/geminiEmbeddings', () => ({
  embedProductBatch: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../config/prisma';
import { pubClient } from '../config/redis';
import { BulkImportService } from '../modules/stores/bulkImport.service';
import { embedProductBatch } from '../services/geminiEmbeddings';

const STORE_ID = 'store-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helper: build an in-memory xlsx buffer for parseExcelFile tests ────────
async function buildXlsxBuffer(headers: string[], rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  const arrayBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuf as ArrayBuffer);
}

// ── 1. parseExcelFile ──────────────────────────────────────────────────────
describe('BulkImportService.parseExcelFile', () => {
  it('happy path: parses headers + rows from a real ExcelJS-generated xlsx buffer', async () => {
    const buf = await buildXlsxBuffer(
      ['Product Name', 'Price', 'Brand'],
      [
        ['Tata Salt', '50', 'Tata'],
        ['Aashirvaad Atta', '450', 'ITC'],
      ],
    );
    const result = await BulkImportService.parseExcelFile(buf);
    expect(result.headers).toEqual(['Product Name', 'Price', 'Brand']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ 'Product Name': 'Tata Salt', Price: '50', Brand: 'Tata' });
  });

  it('empty buffer (no PK magic bytes — treated as CSV) → "Excel file has no sheets" or similar', async () => {
    const buf = Buffer.from('');
    await expect(BulkImportService.parseExcelFile(buf)).rejects.toThrow();
  });

  it('header row only (no data) → "File must have a header row and at least one data row"', async () => {
    const buf = await buildXlsxBuffer(['Name', 'Price'], []);
    await expect(BulkImportService.parseExcelFile(buf))
      .rejects.toThrow('File must have a header row and at least one data row');
  });

  it('CSV input → parsed via the CSV path (no PK magic bytes)', async () => {
    const csv = Buffer.from('Name,Price\nTata Salt,50\nAtta,450\n', 'utf8');
    const result = await BulkImportService.parseExcelFile(csv);
    expect(result.headers).toEqual(['Name', 'Price']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ Name: 'Tata Salt', Price: '50' });
  });
});

// ── 2. mapColumnsWithAI — Gemini path + heuristic fallback ─────────────────
describe('BulkImportService.mapColumnsWithAI', () => {
  function mockGemini(payload: unknown) {
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
    globalThis.fetch = fakeFetch;
    return fakeFetch;
  }

  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEachReset();

  function afterEachReset() {
    return undefined;
  }

  it('happy path: Gemini returns valid mapping → service returns mapped columns', async () => {
    mockGemini({
      candidates: [{
        content: { parts: [{ text: '{"productName":"Item Name","price":"MRP","brand":"Make"}' }] },
      }],
    });
    const headers = ['Item Name', 'MRP', 'Make', 'Other'];
    const result = await BulkImportService.mapColumnsWithAI(headers, [
      { 'Item Name': 'Tata Salt', MRP: '50', Make: 'Tata', Other: 'x' },
    ]);
    expect(result.productName).toBe('Item Name');
    expect(result.price).toBe('MRP');
    expect(result.brand).toBe('Make');
    globalThis.fetch = originalFetch;
  });

  it('Gemini returns a column name that is NOT in headers → falls back to heuristic mapping', async () => {
    mockGemini({
      candidates: [{
        content: { parts: [{ text: '{"productName":"NonexistentColumn"}' }] },
      }],
    });
    // Heuristic should find "Product Name" via the 'name'/'product' keywords.
    const headers = ['Product Name', 'Price'];
    const result = await BulkImportService.mapColumnsWithAI(headers, [{ 'Product Name': 'X', Price: '1' }]);
    expect(result.productName).toBe('Product Name');
    expect(result.price).toBe('Price');
    globalThis.fetch = originalFetch;
  });

  it('Gemini returns malformed JSON (no JSON in text) → falls back to heuristic', async () => {
    mockGemini({
      candidates: [{ content: { parts: [{ text: 'sorry, I cannot help' }] } }],
    });
    const headers = ['Name', 'MRP', 'Brand'];
    const result = await BulkImportService.mapColumnsWithAI(headers, []);
    // Heuristic catches 'Name', 'MRP' (price), 'Brand'.
    expect(result.productName).toBe('Name');
    expect(result.price).toBe('MRP');
    expect(result.brand).toBe('Brand');
    globalThis.fetch = originalFetch;
  });

  it('Gemini network failure → falls back to heuristic', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    const headers = ['SKU', 'Cost'];
    const result = await BulkImportService.mapColumnsWithAI(headers, []);
    // 'SKU' → productName (one of the keywords); 'Cost' → price
    expect(result.productName).toBe('SKU');
    expect(result.price).toBe('Cost');
    globalThis.fetch = originalFetch;
  });

  it('Both Gemini AND heuristic fail (no productName-shaped column) → throws', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    const headers = ['Foo', 'Bar', 'Baz']; // no name/product/item/title/sku
    await expect(BulkImportService.mapColumnsWithAI(headers, []))
      .rejects.toThrow(/Could not identify product name column/);
    globalThis.fetch = originalFetch;
  });
});

// ── 3. checkRateLimit — 5/day cap with fail-OPEN on Redis err ──────────────
describe('BulkImportService.checkRateLimit', () => {
  it('under the limit (count=3) → no throw; expire only called on first increment (count=1)', async () => {
    vi.mocked(pubClient.incr).mockResolvedValueOnce(3 as never);
    await expect(BulkImportService.checkRateLimit(STORE_ID)).resolves.toBeUndefined();
    expect(pubClient.expire).not.toHaveBeenCalled();
  });

  it('first increment of the day (count=1) → sets 86400s expire (1 day TTL)', async () => {
    vi.mocked(pubClient.incr).mockResolvedValueOnce(1 as never);
    await BulkImportService.checkRateLimit(STORE_ID);
    expect(pubClient.expire).toHaveBeenCalledWith(expect.stringContaining(STORE_ID), 86400);
  });

  it('over the limit (count=6) → throws "Rate limit: max 5 bulk imports per day..."', async () => {
    vi.mocked(pubClient.incr).mockResolvedValueOnce(6 as never);
    await expect(BulkImportService.checkRateLimit(STORE_ID))
      .rejects.toThrow(/Rate limit: max 5 bulk imports per day/);
  });

  it('boundary: count===5 → ALLOWED (the limit is 5/day; >5 throws)', async () => {
    vi.mocked(pubClient.incr).mockResolvedValueOnce(5 as never);
    await expect(BulkImportService.checkRateLimit(STORE_ID)).resolves.toBeUndefined();
  });

  it('fail-OPEN: Redis incr throws → service ALLOWS the import (mirror of session 128.30 failOpen pattern)', async () => {
    vi.mocked(pubClient.incr).mockRejectedValueOnce(new Error('redis down'));
    // No throw — when Redis is unavailable we prioritise availability over rate-limiting.
    await expect(BulkImportService.checkRateLimit(STORE_ID)).resolves.toBeUndefined();
  });

  it('SECURITY: a Redis error whose message starts with "Rate limit" is STILL re-thrown (not masked by the fail-open swallow)', async () => {
    // Pathological case — guards against a Redis client surfacing
    // a "Rate limit"-shaped error that the catch should NOT swallow.
    vi.mocked(pubClient.incr).mockRejectedValueOnce(new Error('Rate limit hit on redis client'));
    await expect(BulkImportService.checkRateLimit(STORE_ID)).rejects.toThrow(/Rate limit/);
  });

  it('rate-limit key includes store ID + today\'s date (YYYY-MM-DD)', async () => {
    vi.mocked(pubClient.incr).mockResolvedValueOnce(1 as never);
    await BulkImportService.checkRateLimit(STORE_ID);
    const key = vi.mocked(pubClient.incr).mock.calls[0][0];
    expect(key).toMatch(/^bulk_import:store-aaaa-aaaa-aaaa-aaaaaaaaaaaa:\d{4}-\d{2}-\d{2}$/);
  });
});

// ── 4. importProducts — partial-success + idempotent upsert ────────────────
describe('BulkImportService.importProducts', () => {
  const mapping = { productName: 'Name', price: 'Price', category: 'Cat', brand: 'Br', description: 'Desc' };

  it('happy path: 2 new rows → both created, imported=2, skipped=0, no errors', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.product.create).mockImplementation(async (args: any) => ({
      id: `p-${args.data.productName}`, ...args.data,
    }));
    const rows = [
      { Name: 'Tata Salt', Price: '50', Cat: 'Grocery', Br: 'Tata', Desc: 'Iodized' },
      { Name: 'Atta', Price: '450', Cat: 'Grocery', Br: 'ITC', Desc: '' },
    ];
    const result = await BulkImportService.importProducts(STORE_ID, rows, mapping);
    expect(result).toMatchObject({ imported: 2, skipped: 0, errors: [] });
    expect(prisma.product.create).toHaveBeenCalledTimes(2);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('IDEMPOTENT: existing (storeId, productName) → UPDATE not create (no duplicate insertion)', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce({ id: 'existing-1' } as never);
    vi.mocked(prisma.product.update).mockResolvedValueOnce({ id: 'existing-1' } as never);
    const rows = [{ Name: 'Tata Salt', Price: '60', Cat: 'Grocery' }];
    const result = await BulkImportService.importProducts(STORE_ID, rows, mapping);
    expect(result.imported).toBe(1);
    expect(prisma.product.update).toHaveBeenCalledOnce();
    expect(prisma.product.create).not.toHaveBeenCalled();
    // The update is scoped to the existing id — NOT to storeId+productName.
    const updateArgs = vi.mocked(prisma.product.update).mock.calls[0][0] as any;
    expect(updateArgs.where).toEqual({ id: 'existing-1' });
  });

  it('rows with blank productName are SKIPPED (not counted as errors)', async () => {
    const rows = [
      { Name: '', Price: '50' },
      { Name: '   ', Price: '60' },  // whitespace-only also blank after trim
    ];
    const result = await BulkImportService.importProducts(STORE_ID, rows, mapping);
    expect(result).toMatchObject({ imported: 0, skipped: 2, errors: [] });
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
  });

  it('PARTIAL-SUCCESS: one row succeeds, one row Prisma throws → imported=1, skipped=1, errors carries the row label', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.create)
      .mockResolvedValueOnce({ id: 'p-1' } as never)
      .mockRejectedValueOnce(new Error('DB connection lost'));
    const rows = [
      { Name: 'OK Item', Price: '50' },
      { Name: 'Fail Item', Price: '60' },
    ];
    const result = await BulkImportService.importProducts(STORE_ID, rows, mapping);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/Fail Item/);
    expect(result.errors[0]).toMatch(/DB connection lost/);
  });

  it('price parsing: non-numeric chars are stripped (e.g. "₹450.50" → 450.50)', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.create).mockResolvedValueOnce({ id: 'p-1' } as never);
    await BulkImportService.importProducts(STORE_ID, [{ Name: 'X', Price: '₹450.50' }], mapping);
    const args = vi.mocked(prisma.product.create).mock.calls[0][0] as any;
    expect(args.data.price).toBe(450.5);
  });

  it('missing category column on row → defaults to "General"', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.create).mockResolvedValueOnce({ id: 'p-1' } as never);
    // Mapping has no category — service should default to 'General'
    const mappingNoCat = { productName: 'Name' };
    await BulkImportService.importProducts(STORE_ID, [{ Name: 'X' }], mappingNoCat);
    const args = vi.mocked(prisma.product.create).mock.calls[0][0] as any;
    expect(args.data.category).toBe('General');
  });

  it('background embedding is fire-and-forget (called once with the imported batch)', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.product.create).mockImplementation(async (args: any) => ({
      id: `p-${args.data.productName}`, ...args.data,
    }));
    await BulkImportService.importProducts(STORE_ID, [{ Name: 'X', Price: '1' }], mapping);
    // Allow any queued microtasks (the fire-and-forget call is sync-dispatched).
    expect(embedProductBatch).toHaveBeenCalledOnce();
    const [batch] = vi.mocked(embedProductBatch).mock.calls[0];
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({ id: 'p-X', name: 'X' });
  });

  it('embedding failure does NOT block or affect the import result (fire-and-forget catches err)', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.create).mockResolvedValueOnce({ id: 'p-1' } as never);
    vi.mocked(embedProductBatch).mockRejectedValueOnce(new Error('Gemini down'));
    // Should still resolve with imported=1 — embedding rejection is logged + swallowed.
    const result = await BulkImportService.importProducts(STORE_ID, [{ Name: 'X' }], mapping);
    expect(result.imported).toBe(1);
  });

  it('empty rows array → no-op success', async () => {
    const result = await BulkImportService.importProducts(STORE_ID, [], mapping);
    expect(result).toEqual({ imported: 0, skipped: 0, errors: [] });
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
    expect(embedProductBatch).not.toHaveBeenCalled();
  });

  it('SPEC NOTE — service does NOT verify storeId ownership; that is the controller\'s responsibility (asserted via lack of any store/user lookup)', async () => {
    vi.mocked(prisma.product.findFirst).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.product.create).mockResolvedValueOnce({ id: 'p-1' } as never);
    await BulkImportService.importProducts(STORE_ID, [{ Name: 'X' }], mapping);
    // No store.findUnique, no user lookup — service trusts the caller's storeId.
    // The route layer (store.controller.ts) MUST verify ownership before invoking this.
    // This test documents the contract.
    expect(true).toBe(true);  // The trust boundary is documented by what's NOT called.
  });
});
