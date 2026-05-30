// StatusPill.jsx — live store status capsule
// status: 'open' | 'soon' | 'orange' | 'closed'
// label: text to show (e.g. "Open till 10pm", "Closes in 22m", "Closed")
import React from 'react';

const MAP = {
  open:   { color: 'var(--b-green)', bg: 'var(--b-green-bg)' },
  soon:   { color: 'var(--b-amber)', bg: '#FEF6E0' },
  orange: { color: '#FB7A1E',        bg: '#FFF0E2' },
  closed: { color: 'var(--b-red)',   bg: 'var(--b-red-bg)' },
  info:   { color: 'var(--b-blue)',  bg: 'var(--b-blue-bg)' },
};

export default function StatusPill({ status = 'open', label }) {
  const s = MAP[status] || MAP.open;
  const breathe = status === 'open' || status === 'soon';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
      letterSpacing: '-0.01em', color: s.color, background: s.bg,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%', background: 'currentColor',
        animation: breathe ? 'b-breathe 2.2s ease-in-out infinite' : 'none',
      }} />
      {label}
    </span>
  );
}
