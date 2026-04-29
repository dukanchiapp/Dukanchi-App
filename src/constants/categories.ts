export interface CategoryDef {
  value: string;
  label: string;
  fullLabel: string;
  emoji: string;
  color: string;
  aliases: string[];
}

export const CATEGORIES: CategoryDef[] = [
  { value: 'Food', label: 'Food', fullLabel: 'Food & Restaurant', emoji: '🍕', color: '#FF6B35',
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
  { value: 'Home', label: 'Home', fullLabel: 'Home & Furniture', emoji: '🏠', color: '#EAB308',
    aliases: ['home', 'furniture', 'decor', 'hardware', 'building', 'home & garden', 'furniture', 'building materials'] },
  { value: 'Books', label: 'Books', fullLabel: 'Books & Stationery', emoji: '📚', color: '#3B82F6',
    aliases: ['books', 'stationery', 'education'] },
  { value: 'Auto', label: 'Auto', fullLabel: 'Vehicles & Auto Parts', emoji: '🚗', color: '#64748B',
    aliases: ['auto', 'vehicles', 'auto parts', 'garage', 'spare', 'automotive'] },
  { value: 'Services', label: 'Services', fullLabel: 'Services & Other', emoji: '🛠️', color: '#6B7280',
    aliases: ['services', 'other', 'general'] },
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
