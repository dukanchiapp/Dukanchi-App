// MapScreen.jsx — nearby shops on a map
// IMPORTANT: this is a VISUAL SKIN over your map. Keep your real map SDK
// (Google Maps / Mapbox / Leaflet) as the base layer — only the overlays
// (pins, pill, re-center, bottom sheet) are styled here. The gray base below
// is a placeholder; mount your <MapView> in its place.
import React from 'react';
import StatusPill from '../react-stubs/StatusPill';

export default function MapScreen({ stores = [], nearbyCount, onRecenter, onOpenStore }) {
  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#E9E5DE' }}>
      {/* ↓↓↓ Replace this block with your real map component ↓↓↓ */}
      <div style={{ position: 'absolute', inset: 0, background:
        'repeating-linear-gradient(0deg,#E9E5DE,#E9E5DE 38px,#E3DED6 38px,#E3DED6 39px),repeating-linear-gradient(90deg,#E9E5DE,#E9E5DE 38px,#E3DED6 38px,#E3DED6 39px)' }} />
      {/* ↑↑↑ Replace above with <MapView /> ↑↑↑ */}

      {/* store pins (position these by lat/lng projection from your map) */}
      {stores.map((s, i) => (
        <button key={s.id} onClick={() => onOpenStore?.(s)} style={{
          position: 'absolute', left: s.x ?? `${20 + i * 24}%`, top: s.y ?? `${28 + (i % 3) * 16}%`,
          transform: 'translate(-50%,-100%)', background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ width: 38, height: 38, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)',
              background: 'var(--b-grad)', boxShadow: 'var(--b-elev-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
              <span style={{ transform: 'rotate(45deg)', color: '#fff', fontWeight: 800, fontSize: 15 }}>{s.name?.[0]}</span>
            </span>
          </span>
        </button>
      ))}

      {/* user-location dot */}
      <span style={{ position: 'absolute', left: '50%', top: '60%', transform: 'translate(-50%,-50%)', width: 18, height: 18, borderRadius: '50%', background: 'var(--b-blue)', border: '3px solid #fff', boxShadow: '0 0 0 6px rgba(37,99,235,0.18)' }} />

      {/* "N stores nearby" pill */}
      <div style={{ position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 9999, padding: '9px 18px', boxShadow: 'var(--b-elev-2)', fontSize: 13, fontWeight: 800, color: 'var(--b-ink)', display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--b-green)' }} />
        {nearbyCount ?? stores.length} stores nearby
      </div>

      {/* re-center = blue (navigation) */}
      <button onClick={onRecenter} className="b-tap" style={{ position: 'absolute', right: 16, bottom: 200, width: 46, height: 46, borderRadius: 14, background: '#fff', border: 'none', boxShadow: 'var(--b-elev-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--b-blue)" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
      </button>

      {/* bottom sheet — horizontally scrolling store cards */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '22px 22px 0 0', boxShadow: '0 -8px 24px rgba(28,20,12,0.08)', padding: '12px 0 16px' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--b-line)', margin: '0 auto 12px' }} />
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px', scrollSnapType: 'x mandatory' }}>
          {stores.map(s => (
            <button key={s.id} onClick={() => onOpenStore?.(s)} className="b-tap" style={{
              flexShrink: 0, width: 230, scrollSnapAlign: 'start', display: 'flex', gap: 11, padding: 11,
              borderRadius: 16, border: '1px solid #F1ECE4', boxShadow: 'var(--b-elev-1)', background: '#fff', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, background: s.image || 'var(--b-grad)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--b-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                <div style={{ marginTop: 4 }}><StatusPill status={s.status} label={s.statusLabel} /></div>
                <div style={{ fontSize: 11, color: 'var(--b-gray-2)', fontWeight: 600, marginTop: 4 }}>{s.distance} · <span style={{ color: 'var(--b-magenta-ink)', fontWeight: 700 }}>{s.category}</span></div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Sample store shape:
// { id, name, image, status: 'open', statusLabel: 'Open till 10pm',
//   distance: '1.6 km', category: 'Electronics', x: '40%', y: '32%' }
