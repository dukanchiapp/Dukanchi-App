import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { CATEGORIES, CategoryDef } from '../constants/categories';

export function useCategories() {
  const [categories, setCategories] = useState<CategoryDef[]>(CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/stores/categories')
      .then(res => res.ok ? res.json() : [])
      .then((data: string[]) => {
        const existingValues = new Set(CATEGORIES.map(c => c.value.toLowerCase()));
        // The backend returns a mix of our defaults + custom user categories.
        // We only want to add the ones that aren't already in CATEGORIES.
        const getEmoji = (c: string) => {
          const lower = c.toLowerCase();
          if (lower.includes('food') || lower.includes('restaurant') || lower.includes('cafe')) return '🍔';
          if (lower.includes('cloth') || lower.includes('apparel') || lower.includes('garment') || lower.includes('fashion') || lower.includes('boutique') || lower.includes('tailor')) return '👕';
          if (lower.includes('shoe') || lower.includes('footwear')) return '👟';
          if (lower.includes('cosmetic') || lower.includes('makeup') || lower.includes('beauty') || lower.includes('salon')) return '💄';
          if (lower.includes('furnitur') || lower.includes('home') || lower.includes('decor')) return '🛋️';
          if (lower.includes('grocer') || lower.includes('supermarket') || lower.includes('mart')) return '🛒';
          if (lower.includes('jewel') || lower.includes('watch') || lower.includes('gold')) return '💎';
          if (lower.includes('real estate') || lower.includes('property') || lower.includes('builder')) return '🏢';
          if (lower.includes('electronic') || lower.includes('tech') || lower.includes('mobile') || lower.includes('computer')) return '📱';
          if (lower.includes('health') || lower.includes('medical') || lower.includes('pharmacy') || lower.includes('clinic')) return '💊';
          if (lower.includes('sport') || lower.includes('fitness') || lower.includes('gym')) return '⚽';
          if (lower.includes('toy') || lower.includes('kids') || lower.includes('baby')) return '🧸';
          if (lower.includes('book') || lower.includes('stationery')) return '📚';
          if (lower.includes('gift')) return '🎁';
          if (lower.includes('pet')) return '🐾';
          if (lower.includes('auto') || lower.includes('car') || lower.includes('vehicle') || lower.includes('bike') || lower.includes('motor')) return '🚗';
          if (lower.includes('service') || lower.includes('repair')) return '🛠️';
          if (lower.includes('hardware') || lower.includes('paint') || lower.includes('plumb')) return '🔨';
          if (lower.includes('flower') || lower.includes('florist')) return '💐';
          if (lower.includes('music') || lower.includes('instrument')) return '🎸';
          if (lower.includes('optic') || lower.includes('eyewear') || lower.includes('glass')) return '👓';
          return '🏷️';
        };

        const newCats = data
          .filter(d => !existingValues.has(d.toLowerCase()))
          .map(c => {
            const em = getEmoji(c);
            return {
              value: c,
              label: c,
              fullLabel: `${em} ${c}`,
              emoji: em,
              color: 'var(--f-text-3)',
              aliases: []
            };
          });
        
        // Sort new categories alphabetically and append to defaults
        newCats.sort((a, b) => a.value.localeCompare(b.value));
        setCategories([...CATEGORIES, ...newCats]);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch dynamic categories', err);
        setLoading(false);
      });
  }, []);

  return { categories, loading };
}
