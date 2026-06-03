// HomeScreen.jsx — feed with header, location strip, carousel, tabs, post cards
import React from 'react';
import Header from '../react-stubs/Header';
import PostCard from '../react-stubs/PostCard';

const TABS = ['For you', 'Following', 'Saved'];

export default function HomeScreen({ feed = [], area = 'Bandra Kurla Complex', onOpenStore, onChat, onFollow, onChangeLocation }) {
  const [tab, setTab] = React.useState(0);
  return (
    <>
      <Header />
      {/* location strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--b-grad)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--b-on-grad)', fontSize: 12.5, fontWeight: 600, minWidth: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Showing stores near {area}</span>
        </div>
        <button onClick={onChangeLocation} style={{ fontSize: 12, fontWeight: 800, color: 'var(--b-on-grad)', background: 'var(--b-chip-bg)', border: '1px solid var(--b-chip-line)', borderRadius: 9999, padding: '4px 12px', cursor: 'pointer', flexShrink: 0 }}>Change</button>
      </div>

      <div className="b-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--b-surface)' }}>
        {/* carousel banner — replace with real promo images */}
        <div style={{ margin: '14px 16px 0', height: 130, borderRadius: 18, background: 'var(--b-grad-warm)', display: 'flex', alignItems: 'center', padding: 20 }}>
          <div style={{ color: '#fff', fontFamily: 'var(--b-display)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>Diwali Dhamaka<br /><span style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>Aapke aas-paas ke offers</span></div>
        </div>

        {/* tabs + filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 6px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)} className="b-tap" style={{
                padding: '8px 16px', borderRadius: 9999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: 'none', fontFamily: 'inherit',
                background: i === tab ? 'var(--b-grad)' : 'transparent',
                color: i === tab ? 'var(--b-on-grad)' : 'var(--b-gray-2)',
              }}>{t}</button>
            ))}
          </div>
          <button className="b-tap" style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid var(--b-line)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--b-ink)" strokeWidth="2"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
          </button>
        </div>

        {/* feed */}
        <div className="b-stagger b-tilt-wrap" style={{ padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {feed.map(shop => (
            <PostCard key={shop.id} shop={shop}
              onOpen={() => onOpenStore?.(shop)} onChat={() => onChat?.(shop)} onFollow={() => onFollow?.(shop)} />
          ))}
        </div>
      </div>
    </>
  );
}
