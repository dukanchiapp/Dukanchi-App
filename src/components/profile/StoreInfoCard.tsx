import { MapPin, Phone, Clock, Navigation } from 'lucide-react';
import { getStoreStatus, statusColor } from '../../lib/storeUtils';

interface StoreInfoCardProps {
  store: any;
  storeStatus: ReturnType<typeof getStoreStatus>;
}

export function StoreInfoCard({ store, storeStatus }: StoreInfoCardProps) {
  const hasInfo = store.address || store.postalCode || store.city || store.state || store.phone ||
    storeStatus || store.openingTime || store.closingTime || store.workingDays ||
    (store.latitude && store.longitude && store.latitude !== 0);
  if (!hasInfo) return null;

  return (
    <div className="mt-4 space-y-2 p-3 rounded-2xl" style={{ background: '#F5F5F5', border: '0.5px solid var(--dk-border)' }}>
      {store.address && (
        <div className="flex items-start gap-2">
          <MapPin size={14} style={{ color: 'var(--dk-accent)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--dk-text-secondary)', fontWeight: 500 }}>{store.address}</span>
        </div>
      )}
      {(store.postalCode || store.city || store.state) && (
        <div className="flex items-start gap-2" style={{ paddingLeft: 22 }}>
          <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)' }}>
            {store.postalCode && <span>{store.postalCode}</span>}
            {(store.city || store.state) && (
              <span>{store.postalCode ? ' · ' : ''}{[store.city, store.state].filter(Boolean).join(', ')}</span>
            )}
          </span>
        </div>
      )}
      {store.phoneVisible !== false && store.phone && (
        <div className="flex items-center gap-2">
          <Phone size={14} style={{ color: 'var(--dk-accent)', flexShrink: 0 }} />
          <a href={`tel:${store.phone}`} style={{ fontSize: 12, color: 'var(--dk-text-secondary)' }}>{store.phone}</a>
        </div>
      )}
      {storeStatus && (
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: statusColor(storeStatus.color), flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(storeStatus.color) }}>
            {storeStatus.label}
          </span>
        </div>
      )}
      {(store.openingTime || store.closingTime) && !store.is24Hours && (
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>
            Hours: {store.openingTime || '--:--'} – {store.closingTime || '--:--'}
          </span>
        </div>
      )}
      {store.workingDays && (
        <div className="flex items-center gap-2">
          <MapPin size={14} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0, opacity: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>{store.workingDays}</span>
        </div>
      )}
      {store.latitude && store.longitude && store.latitude !== 0 && (
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl mt-1"
          style={{ background: 'rgba(255,107,53,0.1)', color: 'var(--dk-accent)', fontWeight: 600, fontSize: 13 }}
        >
          <Navigation size={14} />
          Direction to Store
        </a>
      )}
    </div>
  );
}
