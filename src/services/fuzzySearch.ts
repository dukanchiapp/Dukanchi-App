/**
 * Fuzzy search service using Levenshtein distance for typo correction
 * and vocabulary-based autosuggestion.
 */

// ── Levenshtein distance ──
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Vocabulary store (rebuilt periodically from DB) ──
//
// SC1 (Session 128.30): the vocabulary is BOUNDED to protect memory + per-query
// CPU as the catalog grows. correctSpelling/getSuggestions linear-scan this
// array on EVERY query, so an unbounded vocabulary is both an OOM risk and a
// latency cliff. We (a) cap the DB reads with `take`, and (b) keep only the
// TOP MAX_VOCAB most-FREQUENT tokens (frequency = the most useful suggestion
// candidates; the long tail is dropped under load).
//
// LONG-TERM FIX (not now): move typo-correction + autosuggest into Postgres
// pg_trgm (trigram GIN index + `similarity()` / the `%` operator) so matching
// runs in the DB and never materialises a full in-memory vocabulary.
let vocabulary: string[] = [];
let lastRefresh = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Defensive read caps — refreshVocabulary never pulls the whole catalog into
// memory. Tuned for pilot-scale; bump only alongside a memory check.
const MAX_PRODUCTS = 5000;
const MAX_STORES = 2000;
// Hard ceiling on the retained vocabulary array (top-N by frequency).
export const MAX_VOCAB = 15000;

export async function refreshVocabulary(prisma: any) {
  const now = Date.now();
  if (now - lastRefresh < REFRESH_INTERVAL && vocabulary.length > 0) return;

  const products = await prisma.product.findMany({
    select: { productName: true, brand: true, category: true, description: true },
    take: MAX_PRODUCTS,
  });
  const stores = await prisma.store.findMany({
    select: { storeName: true, category: true },
    take: MAX_STORES,
  });

  // Frequency map: token → occurrence count. Bounding by frequency keeps the
  // most-useful suggestion candidates and discards the long tail under load.
  const counts = new Map<string, number>();
  const bump = (w: string) => {
    if (w.length < 2) return;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  };

  for (const p of products) {
    tokenize(p.productName).forEach(bump);
    if (p.brand) tokenize(p.brand).forEach(bump);
    if (p.category) tokenize(p.category).forEach(bump);
    // Full product name as a phrase-suggestion candidate.
    bump(p.productName.toLowerCase().trim());
  }
  for (const s of stores) {
    tokenize(s.storeName).forEach(bump);
    if (s.category) tokenize(s.category).forEach(bump);
    bump(s.storeName.toLowerCase().trim());
  }

  // Retain only the top MAX_VOCAB tokens by frequency (desc), alphabetical for
  // deterministic ties. Bounds both memory and the per-query linear scan.
  vocabulary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_VOCAB)
    .map(([w]) => w);
  lastRefresh = now;
}

/** Observability / test seam — current bounded vocabulary size. */
export function getVocabularySize(): number {
  return vocabulary.length;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2);
}

// ── Spell correction ──
export function correctSpelling(query: string): { corrected: string; didCorrect: boolean } {
  const words = query.toLowerCase().trim().split(/\s+/);
  let didCorrect = false;
  const correctedWords: string[] = [];

  for (const word of words) {
    if (word.length < 2) { correctedWords.push(word); continue; }
    // If the word exists in vocabulary, keep it
    if (vocabulary.includes(word)) { correctedWords.push(word); continue; }

    // Find closest match
    let bestMatch = word;
    let bestDist = Infinity;
    const maxDist = word.length <= 4 ? 1 : 2; // stricter for short words

    for (const v of vocabulary) {
      // Quick length filter
      if (Math.abs(v.length - word.length) > maxDist) continue;
      const dist = levenshtein(word, v);
      if (dist < bestDist && dist <= maxDist) {
        bestDist = dist;
        bestMatch = v;
      }
    }

    if (bestMatch !== word) didCorrect = true;
    correctedWords.push(bestMatch);
  }

  return { corrected: correctedWords.join(' '), didCorrect };
}

// ── Autocomplete suggestions ──
export function getSuggestions(prefix: string, limit = 8): string[] {
  if (!prefix || prefix.length < 1) return [];
  const p = prefix.toLowerCase().trim();
  const results: string[] = [];

  // Prioritise full phrases that start with the prefix
  for (const v of vocabulary) {
    if (v.startsWith(p) && v !== p) {
      results.push(v);
    }
    if (results.length >= limit * 2) break; // collect extras for dedup
  }

  // Then words that contain the prefix
  if (results.length < limit) {
    for (const v of vocabulary) {
      if (!v.startsWith(p) && v.includes(p) && v !== p && !results.includes(v)) {
        results.push(v);
      }
      if (results.length >= limit * 2) break;
    }
  }

  // Sort: shorter = more relevant, then alphabetical
  results.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return results.slice(0, limit);
}
