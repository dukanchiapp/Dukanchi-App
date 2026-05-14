import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { prisma } from '../../config/prisma';
import { pubClient } from '../../config/redis';
import { embedProductBatch } from '../../services/geminiEmbeddings';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';

// ── exceljs cell-value normalization helper ────────────────────────────────
// exceljs returns cell.value as a discriminated union — strings, numbers,
// Date objects, { formula, result } for formula cells, { richText } for
// rich text, hyperlinks, etc. The bulk-import use case treats everything
// as trimmed text, so normalize at the boundary.
function stringifyCellValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    // Formula cell: { formula, result }
    if ('result' in obj) return stringifyCellValue(obj.result);
    // Rich text: { richText: [{ text, font }, ...] }
    if ('richText' in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>)
        .map((r) => r.text ?? '')
        .join('')
        .trim();
    }
    // Hyperlink: { text, hyperlink }
    if ('text' in obj) return String(obj.text ?? '').trim();
  }
  return String(v).trim();
}

// ── File-format detection from buffer ──────────────────────────────────────
// xlsx files are ZIP archives → start with "PK" magic bytes (0x50 0x4B).
// Anything else is treated as CSV (multer filter already rejects non-.xlsx
// /.csv at the route layer, so this is just a routing helper).
function isXlsxBuffer(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;
}

export interface ColumnMapping {
  productName: string;
  price?: string;
  description?: string;
  category?: string;
  brand?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const MAX_ROWS = 1000;
const RATE_LIMIT_MAX = 5;

const rateLimitKey = (storeId: string) =>
  `bulk_import:${storeId}:${new Date().toISOString().slice(0, 10)}`;

export class BulkImportService {
  /**
   * Parse an uploaded .xlsx or .csv buffer into headers + rows.
   *
   * Day 6 Phase 2 / Session 93: replaced sheetjs (xlsx) with exceljs to
   * close 1 HIGH-severity advisory (Prototype Pollution + ReDoS in xlsx,
   * no fix available from upstream). exceljs is async — caller in
   * store.controller.ts:219 must `await` the result.
   *
   * Format auto-detected from buffer magic bytes (xlsx is a ZIP archive
   * starting with "PK"). Multer filter at store.routes.ts:15 already
   * restricts to .xlsx / .csv at upload time (Day 6 Phase 2 dropped
   * .xls — exceljs doesn't support the legacy binary format).
   */
  static async parseExcelFile(
    buffer: Buffer,
  ): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
    const workbook = new ExcelJS.Workbook();

    if (isXlsxBuffer(buffer)) {
      await workbook.xlsx.load(buffer);
    } else {
      // CSV path — exceljs csv reader expects a Readable stream.
      const stream = Readable.from(buffer);
      await workbook.csv.read(stream);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Excel file has no sheets');

    // exceljs row.values is 1-indexed (index 0 is undefined as a placeholder),
    // so .slice(1) drops the leading undefined to align with column index 0.
    const headerRow = sheet.getRow(1);
    if (!headerRow || headerRow.cellCount === 0) {
      throw new Error('File must have a header row and at least one data row');
    }
    const headerValues = (headerRow.values as unknown[]).slice(1);
    const headers = headerValues.map((v) => stringifyCellValue(v)).filter(Boolean);
    if (!headers.length) {
      throw new Error('No column headers found in the first row');
    }

    // Collect data rows (skip empty rows; cap at MAX_ROWS).
    const rows: Record<string, any>[] = [];
    let dataRowCount = 0;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const values = (row.values as unknown[]).slice(1);
      // Skip rows where every cell is blank after stringify
      const hasContent = values.some((v) => stringifyCellValue(v) !== '');
      if (!hasContent) return;
      dataRowCount++;
      if (dataRowCount > MAX_ROWS) return; // we throw outside the loop
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        obj[h] = stringifyCellValue(values[i]);
      });
      rows.push(obj);
    });

    if (dataRowCount === 0) {
      throw new Error('File must have a header row and at least one data row');
    }
    if (dataRowCount > MAX_ROWS) {
      throw new Error(`Max ${MAX_ROWS} rows per upload. Your file has ${dataRowCount} rows.`);
    }

    return { headers, rows };
  }

  static async mapColumnsWithAI(
    headers: string[],
    sampleRows: Record<string, any>[]
  ): Promise<ColumnMapping> {
    try {
      const sample = sampleRows.slice(0, 3);
      const prompt = `You are mapping spreadsheet columns to product database fields.
Headers: ${JSON.stringify(headers)}
Sample rows: ${JSON.stringify(sample)}

Map to these fields: productName (required), price (optional), description (optional), category (optional), brand (optional)
Return ONLY a valid JSON object. No markdown, no explanation.
Example: {"productName":"Item Name","price":"MRP","category":"Category"}
If a field cannot be mapped, omit it. productName must always be included.`;

      // 30s timeout — Subtask 3.5. Bulk-import column mapping must not hang.
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(30_000),
        }
      );

      type GeminiTextResp = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const data = (await res.json()) as GeminiTextResp;
      const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in Gemini response');

      const mapping = JSON.parse(jsonMatch[0]) as ColumnMapping;
      if (!mapping.productName) throw new Error('Gemini did not identify productName column');

      // Verify mapped column names actually exist in headers
      const valid: ColumnMapping = { productName: '' };
      if (headers.includes(mapping.productName)) valid.productName = mapping.productName;
      else throw new Error('Gemini returned unknown column for productName');

      if (mapping.price && headers.includes(mapping.price)) valid.price = mapping.price;
      if (mapping.description && headers.includes(mapping.description)) valid.description = mapping.description;
      if (mapping.category && headers.includes(mapping.category)) valid.category = mapping.category;
      if (mapping.brand && headers.includes(mapping.brand)) valid.brand = mapping.brand;

      return valid;
    } catch (err) {
      logger.warn({ err }, '[BulkImport] AI column mapping failed — using keyword fallback');
      return BulkImportService.fallbackMapping(headers);
    }
  }

  private static fallbackMapping(headers: string[]): ColumnMapping {
    const lower = headers.map(h => h.toLowerCase());

    const find = (keywords: string[]): string | null => {
      const idx = lower.findIndex(h => keywords.some(k => h.includes(k)));
      return idx >= 0 ? headers[idx] : null;
    };

    const productName = find(['product name', 'item name', 'name', 'product', 'item', 'title', 'sku']);
    if (!productName) throw new Error('Could not identify product name column. Ensure a column like "Name", "Product Name", or "Item" exists.');

    const mapping: ColumnMapping = { productName };

    const price = find(['price', 'mrp', 'rate', 'cost', 'amount', 'selling price']);
    const category = find(['category', 'type', 'dept', 'section', 'group']);
    const brand = find(['brand', 'make', 'manufacturer', 'company', 'vendor']);
    const description = find(['description', 'details', 'info', 'notes', 'about', 'spec']);

    if (price) mapping.price = price;
    if (category) mapping.category = category;
    if (brand) mapping.brand = brand;
    if (description) mapping.description = description;

    return mapping;
  }

  static async checkRateLimit(storeId: string): Promise<void> {
    const key = rateLimitKey(storeId);
    try {
      const count = Number(await pubClient.incr(key));
      if (count === 1) await pubClient.expire(key, 86400);
      if (count > RATE_LIMIT_MAX) {
        throw new Error(`Rate limit: max ${RATE_LIMIT_MAX} bulk imports per day. Try again tomorrow.`);
      }
    } catch (err: any) {
      if (err.message?.startsWith('Rate limit')) throw err;
      // Redis unavailable — allow the import
    }
  }

  static async importProducts(
    storeId: string,
    rows: Record<string, any>[],
    mapping: ColumnMapping
  ): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
    const toEmbed: { id: string; name: string; description: string | null; category: string }[] = [];

    for (const row of rows) {
      const productName = String(row[mapping.productName] ?? '').trim();
      if (!productName) {
        result.skipped++;
        continue;
      }

      let price = 0;
      if (mapping.price && row[mapping.price]) {
        const parsed = parseFloat(String(row[mapping.price]).replace(/[^\d.]/g, ''));
        if (!isNaN(parsed) && parsed >= 0) price = parsed;
      }

      const category = mapping.category
        ? String(row[mapping.category] ?? '').trim() || 'General'
        : 'General';
      const brand = mapping.brand ? String(row[mapping.brand] ?? '').trim() || undefined : undefined;
      const description = mapping.description
        ? String(row[mapping.description] ?? '').trim() || undefined
        : undefined;

      try {
        const existing = await prisma.product.findFirst({
          where: { storeId, productName },
          select: { id: true },
        });

        let productId: string;
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: { price, category, brand, description },
          });
          productId = existing.id;
        } else {
          const created = await prisma.product.create({
            data: { storeId, productName, price, category, brand, description },
          });
          productId = created.id;
        }

        toEmbed.push({ id: productId, name: productName, description: description ?? null, category });
        result.imported++;
      } catch (err: any) {
        result.errors.push(`"${productName}": ${err.message}`);
        result.skipped++;
      }
    }

    // Fire-and-forget — don't block the response on embedding
    if (toEmbed.length > 0) {
      embedProductBatch(toEmbed).catch(err =>
        logger.error({ err }, '[BulkImport] Background embedding failed')
      );
    }

    return result;
  }
}
