// SearchScreen.jsx — search bar + trending chips + category grid + Ask Nearby CTA
import React from 'react';
import CategoryTile, { CATEGORIES } from '../react-stubs/CategoryTile';

const TRENDING = ['iPhone 15', 'Diwali lights', 'Kurta', 'PS5', 'Sneakers'];

export default function SearchScreen({ onAskNearby, onCategory, onSearch }) {
  const [q, setQ] = React.useState('');
  return (
    <>
      {/* header with big title + search bar */}
      <div className="b-head" style={{ background: 'var(--b-grad)', padding: '52px 16px 16px' }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, fontFamily: 'var(--b-display)', color: 'var(--b-on-grad)', letterSpacing: '-0.03em', marginBottom: 14 }}>Kya dhoondh rahe ho?</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 14, padding: '12px 14px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--b-gray-2)" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch?.(q)}
            placeholder="Shops, products, categories…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontFamily: 'inherit', color: 'var(--b-ink)', background: 'transparent' }} />
          <button style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--b-tint)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--b-orange)" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          </button>
        </div>
      </div>

      <div className="b-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--b-surface)' }}>
        {/* Ask Nearby CTA — the hero feature */}
        <button onClick={onAskNearby} className="b-tap" style={{
          margin: '16px 16px 0', width: 'calc(100% - 32px)', display: 'flex', alignItems: 'center', gap: 14,
          background: 'var(--b-grad)', border: 'none', borderRadius: 18, padding: '16px 18px', cursor: 'pointer', textAlign: 'left',
        }}>
          <span className="b-float3d" style={{ fontSize: 30, flexShrink: 0 }}>📍</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', color: 'var(--b-on-grad)', fontWeight: 800, fontSize: 16, fontFamily: 'var(--b-display)' }}>Aur dhundho nearby?</span>
            <span style={{ display: 'block', color: 'var(--b-on-grad-soft)', fontSize: 12.5, marginTop: 2 }}>Nearby shops se poocho</span>
          </span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--b-on-grad)" strokeWidth="2.4"><path d="M9 6l6 6-6 6" /></svg>
        </button>

        {/* trending */}
        <div style={{ padding: '20px 16px 4px' }}>
          <div className="b-eyebrow" style={{ marginBottom: 10 }}>Trending</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TRENDING.map((t, i) => (
              <button key={t} onClick={() => onSearch?.(t)} className="b-tap" style={{
                padding: '9px 15px', borderRadius: 9999, fontSize: 13, fontWeight: 600, color: 'var(--b-ink)',
                border: '1px solid var(--b-line)', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}>{i === 0 ? '🔥 ' : ''}{t}</button>
            ))}
          </div>
        </div>

        {/* category grid */}
        <div style={{ padding: '20px 16px 24px' }}>
          <div className="b-eyebrow" style={{ marginBottom: 12 }}>Browse categories</div>
          <div className="b-stagger b-tilt-wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {CATEGORIES.map(c => (
              <CategoryTile key={c.label} emoji={c.emoji} label={c.label} bg={c.bg} onClick={() => onCategory?.(c.label)} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
