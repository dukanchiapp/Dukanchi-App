import type { CSSProperties } from 'react';
import { getStoreStatus } from '../../lib/storeUtils';

/* Session 128.20: rewritten to mirror the StoreProfile inline info card —
   peach-tinted icon tiles + emojis (📍 ☎️ 🕐) + bold address/hours + blue
   Direction button. Founder asked Profile (own) to match StoreProfile
   (others') visually; this is the shared surface. */

interface StoreInfoCardProps {
  store: any;
  storeStatus: ReturnType<typeof getStoreStatus>;
}

const iconTile: CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 13,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--b-orange-bg)',
  border: '1px solid var(--b-tint)',
};

const blueGrad = 'linear-gradient(135deg, #2E9BFF 0%, #1D4ED8 100%)';

/** "21:00" → "9:00 PM". Leaves non-HH:MM strings untouched. */
function fmt12(t?: string | null): string {
  if (!t) return '';
  const [hStr, m] = t.split(':');
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m ?? '00'} ${ampm}`;
}

export function StoreInfoCard({ store, storeStatus: _storeStatus }: StoreInfoCardProps) {
  const hasInfo = store.address || store.postalCode || store.city || store.state || store.phone ||
    store.openingTime || store.closingTime || store.workingDays ||
    (store.latitude && store.longitude && store.latitude !== 0);
  if (!hasInfo) return null;

  return (
    <div
      className="f-glass f-glass-edge"
      style={{
        marginTop: 16, padding: 14, borderRadius: 16, background: 'var(--f-glass-bg)',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      {store.address && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={iconTile}><span style={{ fontSize: 18, lineHeight: 1 }}>📍</span></div>
          <div style={{ minWidth: 0, paddingTop: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', margin: 0, lineHeight: 1.3 }}>
              {store.address}
            </p>
            {(store.postalCode || store.city || store.state) && (
              <p style={{ fontSize: 11.5, color: 'var(--f-text-3)', margin: '2px 0 0' }}>
                {[store.postalCode, [store.city, store.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      )}
      {store.phoneVisible !== false && store.phone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={iconTile}><span style={{ fontSize: 17, lineHeight: 1 }}>☎️</span></div>
          <a href={`tel:${store.phone}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--f-text-1)', textDecoration: 'none' }}>{store.phone}</a>
        </div>
      )}
      {(store.is24Hours || store.openingTime || store.closingTime) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={iconTile}><span style={{ fontSize: 17, lineHeight: 1 }}>🕐</span></div>
          <div style={{ minWidth: 0, paddingTop: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', margin: 0, lineHeight: 1.3 }}>
              {store.is24Hours ? 'Open 24 Hours' : `${fmt12(store.openingTime)} – ${fmt12(store.closingTime)}`}
            </p>
            {store.workingDays && (
              <p style={{ fontSize: 11.5, color: 'var(--f-text-3)', margin: '2px 0 0' }}>{store.workingDays}</p>
            )}
          </div>
        </div>
      )}
      {store.latitude && store.longitude && store.latitude !== 0 && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2,
            padding: '13px 14px', borderRadius: 13, background: blueGrad,
            color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 6px 18px rgba(37,99,235,0.32)',
          }}
        >
          {/* SVG arrow (no lucide import here keeps the component lightweight) */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          Direction to Store
        </a>
      )}
    </div>
  );
}
