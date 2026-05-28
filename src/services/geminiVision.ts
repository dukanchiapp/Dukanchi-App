import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import * as Sentry from '@sentry/node';
import { logger } from '../lib/logger';
import { env } from '../config/env';

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// ── Tier 5A — Image moderation safetySettings ───────────────────────────────
// Image-specific HARM_CATEGORY_IMAGE_* enum values exist in @google/genai
// v1.50.1 but are flagged "not supported in Gemini API" (Vertex AI only).
// We use the text-only categories — Gemini's multimodal safety classifier
// applies them to image inputs as well. Threshold MEDIUM_AND_ABOVE chosen
// (per Opus design) to avoid false-positives on legit retail clothing /
// kitchenware while still gating overt NSFW / violence / hate.
const IMAGE_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Block reasons / finish reasons that indicate the model refused on safety.
// Kept as a string set so we don't need to import enums purely for comparison
// (the SDK returns these as string literal values at runtime).
const UNSAFE_BLOCK_REASONS: ReadonlySet<string> = new Set([
  'SAFETY',
  'IMAGE_SAFETY',
  'PROHIBITED_CONTENT',
]);
const UNSAFE_FINISH_REASONS: ReadonlySet<string> = new Set([
  'SAFETY',
  'IMAGE_SAFETY',
  'PROHIBITED_CONTENT',
  'SPII',
]);

export interface ImageSafetyResult {
  safe: boolean;
  blockReason?: string;
  ratings?: Record<string, string>;
  durationMs: number;
  error?: string;
}

// Exported for unit tests + downstream call-sites that need to assert config shape.
export { IMAGE_SAFETY_SETTINGS };

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
    // 30s timeout — Subtask 3.5. AbortSignal.timeout is Node 17.3+ native.
    // SDK supports config.abortSignal (see GenerateContentConfig in @google/genai).
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: { abortSignal: AbortSignal.timeout(30_000) },
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

/**
 * Tier 5A — Synchronous image safety classification.
 *
 * Called from upload.middleware.verifyAndPersistUpload AFTER magic-byte/MIME
 * gates pass but BEFORE the R2 PutObjectCommand. Returns { safe: false } when
 * Gemini's multimodal safety classifier blocks the image at MEDIUM_AND_ABOVE
 * probability across SEXUAL / DANGEROUS / HATE / HARASSMENT.
 *
 * Contract (FAIL-OPEN):
 *   - Any timeout / network / SDK error → returns { safe: true, error: ... }
 *   - Sentry captureMessage at warning level on the error path so a Gemini
 *     outage is visible but does NOT block legit uploads.
 *
 * Timeout: 6s (vs 30s on the analysis fns) — sync UX budget. Typical Gemini
 * Flash call returns in 0.5–1.5s on small images, so the 6s ceiling absorbs
 * cold-start variance while preserving upload latency.
 */
export async function classifyImageSafety(
  imageBase64: string,
  mimeType: string,
): Promise<ImageSafetyResult> {
  const t0 = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        abortSignal: AbortSignal.timeout(6_000),
        safetySettings: IMAGE_SAFETY_SETTINGS,
      },
      contents: [
        {
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            // Minimal prompt — Gemini Flash sometimes returns finishReason=STOP
            // with empty content for inlineData-only inputs; this nudges it to
            // engage the classifier consistently. The text output is discarded.
            { text: 'Describe this image briefly.' },
          ],
        },
      ],
    });

    const blockReason = response.promptFeedback?.blockReason;
    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;

    // Build category->probability map for forensic logs (e.g. "HIGH" on
    // SEXUAL category but we still allowed because threshold was MEDIUM —
    // useful tuning telemetry).
    const ratings: Record<string, string> = {};
    const promptRatings = response.promptFeedback?.safetyRatings ?? [];
    const candidateRatings = candidate?.safetyRatings ?? [];
    for (const r of [...promptRatings, ...candidateRatings]) {
      if (r.category && r.probability) {
        ratings[String(r.category)] = String(r.probability);
      }
    }

    const blockedByPrompt =
      typeof blockReason === 'string' && UNSAFE_BLOCK_REASONS.has(blockReason);
    const blockedByFinish =
      typeof finishReason === 'string' && UNSAFE_FINISH_REASONS.has(finishReason);

    if (blockedByPrompt || blockedByFinish) {
      return {
        safe: false,
        blockReason: blockedByPrompt ? String(blockReason) : String(finishReason),
        ratings,
        durationMs: Date.now() - t0,
      };
    }

    return { safe: true, ratings, durationMs: Date.now() - t0 };
  } catch (err: any) {
    const errMessage = err?.message ?? String(err);
    // Fail-open: log + Sentry warn, but DO NOT propagate. A Gemini outage
    // must never block legitimate uploads.
    logger.warn(
      { err, errMessage, feature: 'classifyImageSafety' },
      '[GEMINI] classifyImageSafety failed — failing open (allow upload)',
    );
    Sentry.captureMessage('upload.moderation.gemini_error', {
      level: 'warning',
      tags: { component: 'upload', event: 'moderation_gemini_error' },
      extra: { errMessage },
    });
    return { safe: true, error: errMessage, durationMs: Date.now() - t0 };
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
    // 30s timeout — Subtask 3.5.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: { abortSignal: AbortSignal.timeout(30_000) },
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
    // 30s timeout — Subtask 3.5.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: { abortSignal: AbortSignal.timeout(30_000) },
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
