// Header.jsx — gradient app header with animated mesh sheen
// The status bar overlaps the top (52px pad). Foreground flips per theme via --b-on-grad.
import React from 'react';

export default function Header({ title = 'Dukanchi', tagline = 'apna bazaar, apni dukaan', onBell, unread = true }) {
  return (
    <div className="b-head" style={{ background: 'var(--b-grad)', padding: '52px 16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: 'var(--b-chip-bg)',
            border: '1px solid var(--b-chip-line)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--b-on-grad)', fontWeight: 600, fontSize: 20,
          }}>द</div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'var(--b-display)', color: 'var(--b-on-grad)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--b-on-grad-soft)', lineHeight: 1.1 }}>{tagline}</div>
          </div>
        </div>
        <button onClick={onBell} className="b-tap" style={{
          position: 'relative', width: 42, height: 42, borderRadius: 14,
          background: 'var(--b-chip-bg)', border: '1px solid var(--b-chip-line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--b-on-grad)" strokeWidth="2" strokeLinecap="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
          {unread && <span style={{ position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: '50%', background: 'var(--b-red)', border: '1.5px solid #fff' }} />}
        </button>
      </div>
    </div>
  );
}
