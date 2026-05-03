import { GoogleGenAI } from '@google/genai';
import { logger } from '../lib/logger';
import { env } from '../config/env';

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const CATEGORIES = [
  'Electronics', 'Fashion', 'Food', 'Beauty', 'Grocery', 'Home', 'Health',
  'Jewellery', 'Vehicles', 'Sports', 'Entertainment', 'Education', 'Services', 'General',
];

function logGeminiCall(feature: string, durationMs: number) {
  logger.info({ feature, durationMs, ts: new Date().toISOString() }, '[GEMINI] API call');
}

function safeParseJSON(text: string): any {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}

export interface ImageAnalysisResult {
  caption: string;
  suggestedPrice: number | null;
  category: string;
  productName: string;
  tags: string[];
}

export async function analyzeProductImage(
  imageBase64: string,
  mimeType: string,
): Promise<ImageAnalysisResult> {
  const defaults: ImageAnalysisResult = { caption: '', suggestedPrice: null, category: 'General', productName: '', tags: [] };
  const t0 = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            {
              text: `You are helping an Indian local retailer create a product post. Analyze this product image and return ONLY valid JSON (no markdown) with:
- caption: engaging Hindi/English mixed caption under 150 chars, mention product benefit
- suggestedPrice: estimated Indian market price as number only (null if unclear)
- category: one of [${CATEGORIES.join(', ')}]
- productName: short product name
- tags: array of 3-5 relevant search tags in lowercase`,
            },
          ],
        },
      ],
    });
    logGeminiCall('analyzeProductImage', Date.now() - t0);
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    logger.info({ rawText: text }, '[GEMINI] raw response');
    const parsed = safeParseJSON(text);
    if (!parsed) return defaults;
    return {
      caption: String(parsed.caption || '').slice(0, 150),
      suggestedPrice: typeof parsed.suggestedPrice === 'number' ? parsed.suggestedPrice : null,
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'General',
      productName: String(parsed.productName || '').slice(0, 100),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5).map(String) : [],
    };
  } catch (err: any) {
    logger.error({ err, feature: 'analyzeProductImage' }, '[GEMINI] analyzeProductImage failed');
    return defaults;
  }
}

export interface VoiceStructureResult {
  caption: string;
  price: number | null;
  productName: string;
  category: string;
}

export async function transcribeAndStructureVoice(
  audioBase64: string,
  mimeType: string,
): Promise<VoiceStructureResult> {
  const defaults: VoiceStructureResult = { caption: '', price: null, productName: '', category: 'General' };
  const t0 = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            {
              text: `This is a voice recording from an Indian shopkeeper describing their product in Hindi, English, or mixed language (Hinglish).
Extract and return ONLY valid JSON:
- caption: clean product description in Hinglish under 150 chars
- price: price mentioned as number only (null if not mentioned)
- productName: product name mentioned
- category: best matching category from [${CATEGORIES.join(', ')}]`,
            },
          ],
        },
      ],
    });
    logGeminiCall('transcribeAndStructureVoice', Date.now() - t0);
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    logger.info({ rawText: text }, '[GEMINI] raw response');
    const parsed = safeParseJSON(text);
    if (!parsed) return defaults;
    return {
      caption: String(parsed.caption || '').slice(0, 150),
      price: typeof parsed.price === 'number' ? parsed.price : null,
      productName: String(parsed.productName || '').slice(0, 100),
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'General',
    };
  } catch (err: any) {
    logger.error({ err, feature: 'transcribeAndStructureVoice' }, '[GEMINI] transcribeAndStructureVoice failed');
    return defaults;
  }
}

export interface StoreDescriptionResult {
  bio: string;
  tagline: string;
}

export async function generateStoreDescription(
  storeName: string,
  category: string,
  userContext?: string,
): Promise<StoreDescriptionResult> {
  const defaults: StoreDescriptionResult = { bio: '', tagline: '' };
  const t0 = Date.now();
  try {
    const description = userContext?.trim() || 'general store';
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          parts: [
            {
              text: `Generate for an Indian local retail store:
Store name: ${storeName}, Category: ${category}
User description: ${description}
Return ONLY valid JSON:
- bio: engaging store bio in Hinglish, friendly tone, mention local/trusted angle, STRICTLY under 320 characters, complete sentence, no cutoff
- tagline: catchy 5-7 word Hindi/English tagline`,
            },
          ],
        },
      ],
    });
    logGeminiCall('generateStoreDescription', Date.now() - t0);
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    logger.info({ rawText: text }, '[GEMINI] raw response');
    const parsed = safeParseJSON(text);
    if (!parsed) return defaults;
    return {
      bio: String(parsed.bio || '').slice(0, 350),
      tagline: String(parsed.tagline || '').slice(0, 80),
    };
  } catch (err: any) {
    logger.error({ err, feature: 'generateStoreDescription' }, '[GEMINI] generateStoreDescription failed');
    return defaults;
  }
}
