export const aliasDictionary: Record<string, string[]> = {
  'ps5': ['playstation 5', 'playstation', 'sony console'],
  'iphone': ['apple phone', 'iphone 15', 'iphone 16'],
  'mobile': ['phone', 'smartphone', 'cellphone'],
  'earphones': ['earbuds', 'headphones', 'headset', 'airpods'],
  'perfume': ['fragrance', 'scent', 'deo', 'body spray', 'attar'],
  'fridge': ['refrigerator', 'cooler'],
  'ac': ['air conditioner', 'cooling unit'],
  'tv': ['television', 'led', 'smart tv'],
  'laptop': ['notebook', 'macbook'],
};

// Build a bidirectional map for faster lookups
const expansionMap = new Map<string, Set<string>>();

for (const [key, aliases] of Object.entries(aliasDictionary)) {
  const normalizedKey = key.toLowerCase().trim();
  
  if (!expansionMap.has(normalizedKey)) {
    expansionMap.set(normalizedKey, new Set());
  }
  
  for (const alias of aliases) {
    const normalizedAlias = alias.toLowerCase().trim();
    expansionMap.get(normalizedKey)!.add(normalizedAlias);
    
    if (!expansionMap.has(normalizedAlias)) {
      expansionMap.set(normalizedAlias, new Set());
    }
    expansionMap.get(normalizedAlias)!.add(normalizedKey);
    
    // Also cross-link aliases to each other
    for (const otherAlias of aliases) {
      if (alias !== otherAlias) {
        expansionMap.get(normalizedAlias)!.add(otherAlias.toLowerCase().trim());
      }
    }
  }
}

/**
 * Expands a search query by including its aliases.
 * Returns an array containing the original query and all its aliases.
 */
export function expandQuery(query: string): string[] {
  const normalizedQuery = query.toLowerCase().trim();
  const results = new Set<string>();
  results.add(normalizedQuery);
  
  const aliases = expansionMap.get(normalizedQuery);
  if (aliases) {
    for (const alias of aliases) {
      results.add(alias);
    }
  }
  
  // Also check if any word in a multi-word query is an alias key
  // This is a basic implementation. A more advanced one would use a tokenizer.
  const words = normalizedQuery.split(/\s+/);
  if (words.length > 1) {
    for (const word of words) {
      const wordAliases = expansionMap.get(word);
      if (wordAliases) {
        for (const alias of wordAliases) {
          results.add(alias);
        }
      }
    }
  }

  return Array.from(results);
}
