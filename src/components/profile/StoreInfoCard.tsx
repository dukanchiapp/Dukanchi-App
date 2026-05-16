import type { CSSProperties } from 'react';
import { getStoreStatus, statusColor } from '../../lib/storeUtils';
import { FIcon } from '../futuristic';

/* Futuristic v2 skin · Phase 8 / feat/futuristic-redesign.
   Glass store-info card. Field conditionals preserved verbatim. */

interface StoreInfoCardProps {
  store: any;
  storeStatus: ReturnType<typeof getStoreStatus>;
}

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0' };

export function StoreInfoCard({ store, storeStatus }: StoreInfoCardProps) {
  const hasInfo = store.address || store.postalCode || store.city || store.state || store.phone ||
    storeStatus || store.openingTime || store.closingTime || store.workingDays ||
    (store.latitude && store.longitude && store.latitude !== 0);
  if (!hasInfo) return null;

  return (
    <div className="f-glass f-glass-edge" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 16, background: 'var(--f-glass-bg)' }}>
      {store.address && (
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <FIcon name="mapPin" size={14} color="var(--f-magenta-light)" />
          <span style={{ fontSize: 12.5, color: 'var(--f-text-1)', fontWeight: 500 }}>{store.address}</span>
        </div>
      )}
      {(store.postalCode || store.city || store.state) && (
        <div style={{ ...row, paddingLeft: 24 }}>
          <span style={{ fontSize: 11, color: 'var(--f-text-3)' }}>
            {store.postalCode && <span>{store.postalCode}</span>}
            {(store.city || store.state) && (
              <span>{store.postalCode ? ' · ' : ''}{[store.city, store.state].filter(Boolean).join(', ')}</span>
            )}
          </span>
        </div>
      )}
      {store.phoneVisible !== false && store.phone && (
        <div style={row}>
          <FIcon name="phone" size={14} color="var(--f-magenta-light)" />
          <a href={`tel:${store.phone}`} style={{ fontSize: 12.5, color: 'var(--f-text-2)', textDecoration: 'none' }}>{store.phone}</a>
        </div>
      )}
      {storeStatus && (
        <div style={row}>
          <FIcon name="clock" size={14} color={statusColor(storeStatus.color)} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: statusColor(storeStatus.color) }}>{storeStatus.label}</span>
        </div>
      )}
      {(store.openingTime || store.closingTime) && !store.is24Hours && (
        <div style={row}>
          <FIcon name="clock" size={14} color="var(--f-text-3)" />
          <span style={{ fontSize: 12, color: 'var(--f-text-3)' }}>
            Hours: {store.openingTime || '--:--'} – {store.closingTime || '--:--'}
          </span>
        </div>
      )}
      {store.workingDays && (
        <div style={{ ...row, paddingLeft: 24 }}>
          <span style={{ fontSize: 12, color: 'var(--f-text-3)' }}>{store.workingDays}</span>
        </div>
      )}
      {store.latitude && store.longitude && store.latitude !== 0 && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
            padding: '11px 14px', borderRadius: 12, background: 'rgba(255,107,53,0.14)',
            border: '1px solid rgba(255,107,53,0.38)', color: 'var(--f-orange-light)', fontSize: 13,
            fontWeight: 700, textDecoration: 'none', boxShadow: '0 0 18px rgba(255,107,53,0.18)',
          }}
        >
          <FIcon name="navigation" size={14} color="var(--f-orange-light)" />
          Direction to Store
        </a>
      )}
    </div>
  );
}
