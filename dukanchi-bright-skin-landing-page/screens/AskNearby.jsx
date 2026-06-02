// AskNearby.jsx — the hero feature: 3-stage broadcast (compose → broadcasting → success)
import React from 'react';
import Button from '../react-stubs/Button';

export default function AskNearby({ onClose, onSend }) {
  const [stage, setStage] = React.useState('compose'); // compose | broadcasting | success
  const [query, setQuery] = React.useState('');
  const [radius, setRadius] = React.useState(3);
  const [count, setCount] = React.useState(0);

  function broadcast() {
    setStage('broadcasting');
    const n = 8 + Math.floor(Math.random() * 12);
    setTimeout(() => { setCount(n); setStage('success'); onSend?.({ query, radius, count: n }); }, 2600);
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--b-surface)', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
      <div className="b-head" style={{ background: 'var(--b-grad)', padding: '52px 16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'var(--b-chip-bg)', border: '1px solid var(--b-chip-line)', borderRadius: 12, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--b-on-grad)" strokeWidth="2.4"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span style={{ color: 'var(--b-on-grad)', fontFamily: 'var(--b-display)', fontWeight: 800, fontSize: 18 }}>Ask Nearby</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column' }}>
        {stage === 'compose' && (
          <>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--b-gray-1)', marginBottom: 8 }}>Kya chahiye aapko?</label>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. PS5, kurta, dawai…"
              style={{ border: '1px solid var(--b-line)', borderRadius: 14, padding: '14px 16px', fontSize: 15, fontFamily: 'inherit', outline: 'none', marginBottom: 22 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--b-gray-1)' }}>Radius</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--b-magenta-ink)' }}>{radius} km</span>
            </div>
            <input type="range" min={1} max={10} value={radius} onChange={e => setRadius(+e.target.value)}
              style={{ width: '100%', accentColor: 'var(--b-orange)', marginBottom: 'auto' }} />
            <Button variant="grad" disabled={!query.trim()} onClick={broadcast} style={{ width: '100%', padding: 16, opacity: query.trim() ? 1 : 0.5 }}>
              Nearby shops se poocho
            </Button>
          </>
        )}

        {stage === 'broadcasting' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
            <div style={{ position: 'relative', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid var(--b-orange)', animation: `b-radar 2s ease-out ${i * 0.6}s infinite` }} />
              ))}
              <span className="b-float3d" style={{ fontSize: 44 }}>📡</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--b-display)', fontWeight: 800, fontSize: 18 }}>Broadcasting…</div>
              <div style={{ color: 'var(--b-gray-2)', fontSize: 13, marginTop: 4 }}>"{query}" nearby shops ko bhej rahe hain</div>
            </div>
          </div>
        )}

        {stage === 'success' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center' }}>
            <span className="b-pop" style={{ fontSize: 56 }}>✅</span>
            <div style={{ fontFamily: 'var(--b-display)', fontWeight: 800, fontSize: 22, color: 'var(--b-green)' }}>{count} shops ko message gaya</div>
            <div style={{ color: 'var(--b-gray-1)', fontSize: 14, maxWidth: 260 }}>Jaise hi koi reply karega, notification milegi.</div>
            <Button variant="green-soft" onClick={onClose} style={{ marginTop: 10, padding: '12px 28px' }}>Theek hai</Button>
          </div>
        )}
      </div>

      {/* radar keyframe (add once globally if not present):
         @keyframes b-radar { 0% { transform: scale(0.3); opacity: 0.8 } 100% { transform: scale(1); opacity: 0 } } */}
    </div>
  );
}
