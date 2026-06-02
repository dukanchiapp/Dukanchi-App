export interface CategoryDef {
  value: string;
  label: string;
  fullLabel: string;
  emoji: string;
  color: string;
  aliases: string[];
}

export const CATEGORIES: CategoryDef[] = [
  { value: 'Food', label: 'Food', fullLabel: 'Food & Restaurant', emoji: '🍕', color: 'var(--b-orange)',
    aliases: ['food', 'restaurant', 'cafe', 'dhaba', 'eatery'] },
  { value: 'Electronics', label: 'Electronics', fullLabel: 'Electronics & Mobile', emoji: '📱', color: '#4F46E5',
    aliases: ['electronics', 'mobile', 'phones', 'gadgets', 'accessories', 'mobile & accessories'] },
  { value: 'Fashion', label: 'Fashion', fullLabel: 'Clothing & Fashion', emoji: '👕', color: '#EC4899',
    aliases: ['fashion', 'clothing', 'apparel', 'footwear', 'shoes'] },
  { value: 'Grocery', label: 'Grocery', fullLabel: 'Grocery & Kirana', emoji: '🛒', color: '#10B981',
    aliases: ['grocery', 'kirana', 'general store', 'provisions'] },
  { value: 'Beauty', label: 'Beauty', fullLabel: 'Beauty & Personal Care', emoji: '💄', color: '#F59E0B',
    aliases: ['beauty', 'salon', 'cosmetics', 'personal care'] },
  { value: 'Health', label: 'Health', fullLabel: 'Health & Pharmacy', emoji: '💊', color: '#06B6D4',
    aliases: ['health', 'pharmacy', 'medical', 'wellness', 'chemist', 'health & wellness', 'pharmacy'] },
  { value: 'Jewellery', label: 'Jewellery', fullLabel: 'Jewellery & Watches', emoji: '💍', color: '#A855F7',
    aliases: ['jewellery', 'jewelry', 'watches', 'gold', 'silver'] },
  { value: 'Real Estate', label: 'Real Estate', fullLabel: 'Real Estate & Properties', emoji: '🏢', color: '#EAB308',
    aliases: ['real estate', 'property', 'properties', 'builder', 'broker', 'flats', 'apartments', 'rentals', 'commercial', 'residential'] },
  { value: 'Stationery', label: 'Stationery', fullLabel: 'Books & Stationery', emoji: '📚', color: '#3B82F6',
    aliases: ['books', 'stationery', 'education'] },
  { value: 'Auto', label: 'Auto', fullLabel: 'Vehicles & Auto Parts', emoji: '🚗', color: '#64748B',
    aliases: ['auto', 'vehicles', 'auto parts', 'garage', 'spare', 'automotive'] },
  { value: 'Services', label: 'Services', fullLabel: 'Services & Other', emoji: '🛠️', color: '#6B7280',
    aliases: ['services', 'other', 'general'] },
  { value: 'Pets', label: 'Pets', fullLabel: 'Pets & Animal Care', emoji: '🐾', color: '#F97316',
    aliases: ['pets', 'animals', 'vet', 'dog', 'cat', 'pet food'] },
  { value: 'Sports', label: 'Sports', fullLabel: 'Sports & Fitness', emoji: '⚽', color: '#14B8A6',
    aliases: ['sports', 'fitness', 'gym', 'equipment', 'gear'] },
  { value: 'Hardware', label: 'Hardware', fullLabel: 'Hardware & Construction', emoji: '🔨', color: '#78716C',
    aliases: ['hardware', 'construction', 'tools', 'plumbing', 'electrical'] },
  { value: 'Toys', label: 'Toys', fullLabel: 'Toys & Baby Products', emoji: '🧸', color: '#F43F5E',
    aliases: ['toys', 'baby', 'kids', 'games', 'children'] },
  { value: 'Gifts', label: 'Gifts', fullLabel: 'Gifts & Party', emoji: '🎁', color: '#8B5CF6',
    aliases: ['gifts', 'party', 'celebration', 'events', 'decorations'] },
];

// Fuzzy match a stored category string against a filter value
export function matchCategory(storeCategory: string | undefined, filterValue: string): boolean {
  if (!filterValue) return true;
  if (!storeCategory) return false;
  const sc = storeCategory.toLowerCase();
  const filter = CATEGORIES.find(c => c.value === filterValue);
  if (!filter) return sc === filterValue.toLowerCase();
  return filter.aliases.some(alias => sc.includes(alias));
}

export const CATEGORY_CHIPS = [
  { label: 'All', emoji: '', value: '' },
  ...CATEGORIES.map(c => ({ label: c.label, emoji: c.emoji, value: c.value })),
];
