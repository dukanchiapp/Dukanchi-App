import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * geminiVision.classifyImageSafety unit tests — Tier 5A (Session 109a).
 *
 * Covers the safety-classification gate's four operating modes:
 *   1. clean image → safe:true
 *   2. promptFeedback.blockReason=SAFETY → safe:false
 *   3. candidates[0].finishReason=IMAGE_SAFETY → safe:false
 *   4. Gemini throws/timeout → safe:true + Sentry warn (fail-open contract)
 *
 * Also asserts safetySettings shape (4 text-only categories, all MEDIUM
 * threshold) because that array is the contract with Gemini.
 */

const { generateContentMock, sentryCaptureMessageMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  sentryCaptureMessageMock: vi.fn(),
}));

vi.mock('../config/env', () => ({
  env: { GEMINI_API_KEY: 'test-key' },
}));

vi.mock('@google/genai', () => {
  // Real function so `new GoogleGenAI(...)` works (vi.fn arrow impls aren't constructable).
  function GoogleGenAI(this: any, _opts: { apiKey: string }) {
    this.models = { generateContent: generateContentMock };
  }
  return {
    GoogleGenAI,
    // Re-expose enums as plain string maps — only the values matter at runtime
    // (we use them in the safetySettings array which is asserted on shape below).
    HarmCategory: {
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
      HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    },
    HarmBlockThreshold: {
      BLOCK_MEDIUM_AND_ABOVE: 'BLOCK_MEDIUM_AND_ABOVE',
      BLOCK_LOW_AND_ABOVE: 'BLOCK_LOW_AND_ABOVE',
    },
  };
});

vi.mock('@sentry/node', () => ({
  captureMessage: sentryCaptureMessageMock,
  captureException: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Imported AFTER mocks so the SDK ctor consumes our stub.
import { classifyImageSafety, IMAGE_SAFETY_SETTINGS } from './geminiVision';

beforeEach(() => {
  generateContentMock.mockReset();
  sentryCaptureMessageMock.mockReset();
});

describe('classifyImageSafety — config shape', () => {
  it('IMAGE_SAFETY_SETTINGS has 4 text-only categories at BLOCK_MEDIUM_AND_ABOVE', () => {
    expect(IMAGE_SAFETY_SETTINGS).toHaveLength(4);
    const categories = IMAGE_SAFETY_SETTINGS.map((s) => s.category);
    expect(categories).toEqual(
      expect.arrayContaining([
        'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        'HARM_CATEGORY_DANGEROUS_CONTENT',
        'HARM_CATEGORY_HATE_SPEECH',
        'HARM_CATEGORY_HARASSMENT',
      ]),
    );
    for (const s of IMAGE_SAFETY_SETTINGS) {
      expect(s.threshold).toBe('BLOCK_MEDIUM_AND_ABOVE');
    }
  });
});

describe('classifyImageSafety — clean image', () => {
  it('returns safe:true on normal response with no block markers', async () => {
    generateContentMock.mockResolvedValueOnce({
      candidates: [
        {
          content: { parts: [{ text: 'A red apple on a table.' }] },
          finishReason: 'STOP',
          safetyRatings: [
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'NEGLIGIBLE' },
          ],
        },
      ],
      promptFeedback: {},
    });

    const r = await classifyImageSafety('AAAA', 'image/jpeg');

    expect(r.safe).toBe(true);
    expect(r.blockReason).toBeUndefined();
    expect(r.error).toBeUndefined();
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
    expect(r.ratings).toEqual({
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'NEGLIGIBLE',
    });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(sentryCaptureMessageMock).not.toHaveBeenCalled();
  });

  it('passes safetySettings + minimal prompt to Gemini', async () => {
    generateContentMock.mockResolvedValueOnce({
      candidates: [{ finishReason: 'STOP' }],
      promptFeedback: {},
    });

    await classifyImageSafety('AAAA', 'image/png');

    const call = generateContentMock.mock.calls[0][0];
    expect(call.model).toBe('gemini-2.5-flash');
    expect(call.config.safetySettings).toBe(IMAGE_SAFETY_SETTINGS);
    expect(call.config.abortSignal).toBeInstanceOf(AbortSignal);
    expect(call.contents[0].parts[0]).toEqual({
      inlineData: { mimeType: 'image/png', data: 'AAAA' },
    });
    expect(call.contents[0].parts[1].text).toBe('Describe this image briefly.');
  });
});

describe('classifyImageSafety — blocked image', () => {
  it('returns safe:false when promptFeedback.blockReason=SAFETY', async () => {
    generateContentMock.mockResolvedValueOnce({
      candidates: [],
      promptFeedback: {
        blockReason: 'SAFETY',
        safetyRatings: [
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'HIGH' },
        ],
      },
    });

    const r = await classifyImageSafety('XXXX', 'image/jpeg');

    expect(r.safe).toBe(false);
    expect(r.blockReason).toBe('SAFETY');
    expect(r.ratings).toEqual({
      HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HIGH',
    });
    expect(sentryCaptureMessageMock).not.toHaveBeenCalled(); // info-level fires from middleware, not the classifier
  });

  it('returns safe:false when candidates[0].finishReason=IMAGE_SAFETY', async () => {
    generateContentMock.mockResolvedValueOnce({
      candidates: [
        {
          finishReason: 'IMAGE_SAFETY',
          safetyRatings: [
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', probability: 'MEDIUM' },
          ],
        },
      ],
      promptFeedback: {},
    });

    const r = await classifyImageSafety('YYYY', 'image/png');

    expect(r.safe).toBe(false);
    expect(r.blockReason).toBe('IMAGE_SAFETY');
    expect(r.ratings).toEqual({
      HARM_CATEGORY_DANGEROUS_CONTENT: 'MEDIUM',
    });
  });

  it('returns safe:false on finishReason=PROHIBITED_CONTENT', async () => {
    generateContentMock.mockResolvedValueOnce({
      candidates: [{ finishReason: 'PROHIBITED_CONTENT' }],
      promptFeedback: {},
    });

    const r = await classifyImageSafety('ZZZZ', 'image/webp');
    expect(r.safe).toBe(false);
    expect(r.blockReason).toBe('PROHIBITED_CONTENT');
  });
});

describe('classifyImageSafety — fail-open on error', () => {
  it('returns safe:true on SDK throw + captures Sentry warning', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('AbortError: timeout 6000ms'));

    const r = await classifyImageSafety('AAAA', 'image/jpeg');

    expect(r.safe).toBe(true);
    expect(r.error).toMatch(/timeout/);
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
    expect(sentryCaptureMessageMock).toHaveBeenCalledTimes(1);
    const [msg, opts] = sentryCaptureMessageMock.mock.calls[0];
    expect(msg).toBe('upload.moderation.gemini_error');
    expect(opts.level).toBe('warning');
    expect(opts.tags.component).toBe('upload');
  });

  it('returns safe:true on network error', async () => {
    generateContentMock.mockRejectedValueOnce(
      Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' }),
    );

    const r = await classifyImageSafety('AAAA', 'image/jpeg');
    expect(r.safe).toBe(true);
    expect(r.error).toMatch(/ECONNRESET/);
    expect(sentryCaptureMessageMock).toHaveBeenCalledTimes(1);
  });

  it('returns safe:true on malformed response (missing candidates + promptFeedback)', async () => {
    // SDK occasionally returns an object missing the expected branches —
    // treat as fail-open (allow + log) rather than rejecting all uploads.
    generateContentMock.mockResolvedValueOnce({});

    const r = await classifyImageSafety('AAAA', 'image/jpeg');
    expect(r.safe).toBe(true);
    expect(r.blockReason).toBeUndefined();
    expect(r.error).toBeUndefined(); // didn't throw — just no signals
  });
});
