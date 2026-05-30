// BottomNav.jsx — 5-tab nav (Home / Search / Map / Chat / Profile)
// Active tab tinted with --b-magenta-ink. 62px tall, white, hairline top border.
import React from 'react';

const ICONS = {
  home:    '<path d="M3 9.5L12 2l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  map:     '<path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/>',
  chat:    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const TABS = [['home', 'Home'], ['search', 'Search'], ['map', 'Map'], ['chat', 'Chat'], ['profile', 'Profile']];

export default function BottomNav({ active = 'home', onChange }) {
  return (
    <div style={{
      height: 62, background: '#fff', borderTop: '1px solid var(--b-line)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexShrink: 0,
    }}>
      {TABS.map(([k, l]) => {
        const on = k === active;
        const col = on ? 'var(--b-magenta-ink)' : 'var(--b-gray-3)';
        return (
          <button key={k} onClick={() => onChange?.(k)} className="b-tap b-ripple" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px',
          }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={col}
              strokeWidth={on ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: ICONS[k] }} />
            <span style={{ fontSize: 10.5, fontWeight: on ? 800 : 600, color: col }}>{l}</span>
          </button>
        );
      })}
    </div>
  );
}
