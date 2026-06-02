// CategoryTile.jsx — dimensional glossy clay icon tile
// emoji + label. bg tint rotates by category (blue-bg / green-bg / red-bg / tint).
import React from 'react';

export default function CategoryTile({ emoji, label, bg = 'var(--b-tint)', onClick }) {
  return (
    <button onClick={onClick} className="b-tap" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    }}>
      <span className="b-clay" style={{ width: 58, height: 58, background: bg }}>
        <span className="b-clay-emoji" style={{ fontSize: 26 }}>{emoji}</span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--b-ink)', textAlign: 'center' }}>{label}</span>
    </button>
  );
}

// Reference data — the 11 production categories with their tint rotation:
export const CATEGORIES = [
  { label: 'Food',        emoji: '🍕', bg: '#FFE9D6' },
  { label: 'Electronics', emoji: '📱', bg: '#E8F0FE' },
  { label: 'Fashion',     emoji: '👕', bg: '#E8F0FE' },
  { label: 'Grocery',     emoji: '🛒', bg: '#E8F5E9' },
  { label: 'Beauty',      emoji: '💄', bg: '#FDECEA' },
  { label: 'Health',      emoji: '💊', bg: '#E8F5E9' },
  { label: 'Jewellery',   emoji: '💍', bg: '#FFF1EA' },
  { label: 'Home',        emoji: '🏠', bg: '#E8F0FE' },
  { label: 'Books',       emoji: '📚', bg: '#E8F5E9' },
  { label: 'Auto',        emoji: '🚗', bg: '#FDECEA' },
  { label: 'Services',    emoji: '🛠️', bg: '#FFE9D6' },
];
