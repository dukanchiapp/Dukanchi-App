import * as XLSX from 'xlsx';
import { prisma } from '../../config/prisma';
import { pubClient } from '../../config/redis';
import { embedProductBatch } from '../../services/geminiEmbeddings';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';

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
  static parseExcelFile(buffer: Buffer): { headers: string[]; rows: Record<string, any>[] } {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new Error('Excel file has no sheets');

    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawRows.length < 2) throw new Error('File must have a header row and at least one data row');

    const headers = (rawRows[0] as any[])
      .map(h => String(h).trim())
      .filter(Boolean);
    if (!headers.length) throw new Error('No column headers found in the first row');

    const dataRows = rawRows.slice(1).filter(row =>
      row.some((cell: any) => String(cell).trim())
    );

    if (dataRows.length > MAX_ROWS) {
      throw new Error(`Max ${MAX_ROWS} rows per upload. Your file has ${dataRows.length} rows.`);
    }

    const rows = dataRows.map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? String(row[i]).trim() : '';
      });
      return obj;
    });

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

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
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
