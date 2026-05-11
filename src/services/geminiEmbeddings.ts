import { prisma } from '../config/prisma';
import { env } from '../config/env';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates an embedding vector for the given text using text-embedding-004.
 * Uses exponential backoff to handle rate limits (up to 3 retries).
 */
export async function generateEmbedding(text: string, retries = 3, delay = 1000): Promise<number[]> {
  try {
    const startTime = Date.now();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/text-embedding-004',
        content: { parts: [{ text }] },
        outputDimensionality: 768
      })
    });
    
    type EmbeddingResp = { embedding?: { values?: number[] } };
    const data = (await res.json()) as EmbeddingResp;
    const embedding = data.embedding?.values;
    
    if (!embedding) {
      throw new Error(`No embedding returned from Gemini: ${JSON.stringify(data)}`);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[GEMINI_EMBED] Tokens: -, Time: ${Date.now() - startTime}ms, Query: "${text.substring(0, 50)}..."`);
    }

    return embedding;
  } catch (error: any) {
    if (retries > 0 && error?.status === 429) {
      console.warn(`[GEMINI_EMBED] Rate limited. Retrying in ${delay}ms...`);
      await sleep(delay);
      return generateEmbedding(text, retries - 1, delay * 2);
    }
    console.error(`[GEMINI_EMBED] Error:`, error);
    throw error;
  }
}

/**
 * Generates embeddings for a batch of products and updates them in the database using pgvector.
 */
export async function embedProductBatch(products: { id: string; name: string; description: string | null; category: string }[]) {
  if (!products.length) return;

  const updates = [];

  for (const product of products) {
    const textToEmbed = `${product.name} ${product.category} ${product.description || ''}`.trim();
    
    try {
      const embedding = await generateEmbedding(textToEmbed);
      updates.push({
        id: product.id,
        embedding,
      });
    } catch (err) {
      console.error(`Failed to embed product ${product.id}`, err);
    }
  }

  // Batch update database using raw SQL for pgvector
  for (const update of updates) {
    // pgvector expects a string formatted like '[0.1, 0.2, ...]'
    const vectorString = `[${update.embedding.join(',')}]`;
    await prisma.$executeRaw`UPDATE "Product" SET embedding = ${vectorString}::vector WHERE id = ${update.id}`;
  }
}
