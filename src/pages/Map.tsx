// GOOGLE MAPS SETUP: To fix "This page didn't load Google Maps correctly" / map blank on phone:
// 1. Go to console.cloud.google.com → APIs & Services → Credentials → your Maps JS API key
// 2. Under "Application restrictions" → HTTP referrers, add:
//    localhost:3000/*  |  localhost:5173/*  |  192.168.1.*/*  |  *.ngrok-free.dev/*  |  *.ngrok.io/*
// OR: Set restriction to "None" for development (re-restrict before production)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ShimmerBox } from '../components/Skeleton';
import { usePageMeta } from '../hooks/usePageMeta';
import { apiFetch } from '../lib/api';
import { GoogleMap as GoogleMapComponent, useJsApiLoader, Marker as MarkerComponent } from '@react-google-maps/api';

const GoogleMap = GoogleMapComponent as any;
const Marker = MarkerComponent as any;
import { MapPin, Navigation, X, Clock, Phone, Settings, Search, Store, LocateFixed, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useUserLocation } from '../context/LocationContext';
import { CATEGORIES, CATEGORY_CHIPS, matchCategory } from '../constants/categories';

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'landscape', stylers: [{ color: '#f8f8f8' }] },
  { featureType: 'water', stylers: [{ color: '#c9e8f5' }] },
];


export default function MapPage() {
  usePageMeta({ title: 'Map' });
  const [stores, setStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [listExpanded, setListExpanded] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { location: userLocCtx } = useUserLocation();
  const userLocation = userLocCtx ? { lat: userLocCtx.lat, lng: userLocCtx.lng } : null;

  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): string => {
    const d = getDistanceKm(lat1, lng1, lat2, lng2);
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)} km`;
  };

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    id: 'google-map-script',
  });

  useEffect(() => {
    setStoresLoading(true);
    apiFetch('/api/stores?limit=200')
      .then(r => r.ok ? r.json() : { stores: [] })
      .then(data => setStores(Array.isArray(data) ? data : (data.stores ?? [])))
      .catch(() => setStores([]))
      .finally(() => setStoresLoading(false));
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const flyToStore = (store: any) => {
    if (mapRef.current && store.latitude && store.longitude) {
      mapRef.current.panTo({ lat: store.latitude, lng: store.longitude });
      mapRef.current.setZoom(16);
    }
    setSelectedStore(store);
  };

  const recenterMap = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.panTo(userLocation);
      mapRef.current.setZoom(13);
    }
  };

  const filteredStores = useMemo(() => stores.filter(s => {
    if (!matchCategory(s.category, selectedCategory)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.storeName?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q) ||
      s.address?.toLowerCase().includes(q)
    );
  }), [stores, selectedCategory, searchQuery]);

  const validStores = useMemo(() => filteredStores
    .filter(s => s.latitude && s.longitude && s.latitude !== 0)
    .sort((a, b) => {
      if (!userLocation) return 0;
      return getDistanceKm(userLocation.lat, userLocation.lng, a.latitude, a.longitude)
        - getDistanceKm(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
    }),
    [filteredStores, userLocation]
  );

  const selectedStoreDistance = selectedStore && userLocation
    ? getDistance(userLocation.lat, userLocation.lng, selectedStore.latitude, selectedStore.longitude)
    : null;
  const storeStatus = selectedStore
    ? getStoreStatus(selectedStore.openingTime, selectedStore.closingTime, selectedStore.is24Hours, selectedStore.workingDays)
    : null;

  return (
    <div style={{ background: 'var(--dk-bg)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="max-w-md mx-auto">

        {/* ── Header ── */}
        <div className="sticky top-0 z-20 px-4 pt-5 pb-3" style={{ background: 'var(--dk-bg)' }}>
          <AppHeader />

          {/* Search */}
          <div
            className="flex items-center gap-2 px-3 mt-3"
            style={{ background: 'var(--dk-surface)', borderRadius: 'var(--dk-radius-md)', height: 44 }}
          >
            <Search size={16} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search stores near you..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--dk-text-primary)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X size={14} style={{ color: 'var(--dk-text-tertiary)' }} />
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="flex gap-2 mt-3 overflow-x-auto" style={{ scrollbarWidth: 'none', paddingBottom: 2 }}>
            {CATEGORY_CHIPS.map(chip => {
              const active = selectedCategory === chip.value;
              return (
                <button
                  key={chip.value}
                  onClick={() => setSelectedCategory(chip.value)}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: active ? '#1A1A1A' : 'var(--dk-surface)',
                    color: active ? 'white' : 'var(--dk-text-secondary)',
                  }}
                >
                  {chip.emoji && <span>{chip.emoji}</span>}
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Map container ── */}
        <div className="px-4">
          <div
            className="relative overflow-hidden"
            style={{ borderRadius: 20, height: 380 }}
          >
            {loadError ? (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'var(--dk-surface)' }}
              >
                <div className="text-center px-4">
                  <p style={{ fontSize: 13, color: 'var(--dk-text-secondary)', fontWeight: 600 }}>Map load nahi hua</p>
                  <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)', marginTop: 4 }}>
                    Google Maps API key configure karein — console.cloud.google.com
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--dk-text-tertiary)', marginTop: 2 }}>
                    HTTP referrers mein apna domain add karein
                  </p>
                </div>
              </div>
            ) : isLoaded && userLocation ? (
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={userLocation}
                zoom={13}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={() => setSelectedStore(null)}
                options={{
                  disableDefaultUI: true,
                  zoomControl: false,
                  styles: MAP_STYLES,
                  clickableIcons: false,
                }}
              >
                {/* User dot */}
                <Marker
                  position={userLocation}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: '#FF6B35',
                    fillOpacity: 1,
                    strokeWeight: 3,
                    strokeColor: '#ffffff',
                  }}
                  zIndex={100}
                />

                {/* Store markers */}
                {validStores.map(store => {
                  const catDef = CATEGORIES.find(c => matchCategory(store.category, c.value));
                  const pinColor = catDef?.color || '#FF6B35';
                  const emoji = catDef?.emoji || '🏪';
                  return (
                    <Marker
                      key={store.id}
                      position={{ lat: store.latitude, lng: store.longitude }}
                      onClick={() => flyToStore(store)}
                      icon={{
                        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><ellipse cx="20" cy="46" rx="6" ry="2" fill="rgba(0,0,0,0.15)"/><path d="M20 0C9 0 0 9 0 20c0 15 20 28 20 28S40 35 40 20C40 9 31 0 20 0z" fill="${pinColor}" stroke="#ffffff" stroke-width="2"/><circle cx="20" cy="18" r="10" fill="#000" stroke="#fff" stroke-width="1.5"/><text x="20" y="22" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#ffffff">${emoji}</text></svg>`)}`,
                        scaledSize: new google.maps.Size(40, 48),
                        anchor: new google.maps.Point(20, 48),
                      }}
                      zIndex={selectedStore?.id === store.id ? 20 : 10}
                    />
                  );
                })}
              </GoogleMap>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'var(--dk-surface)' }}
              >
                <div className="text-center">
                  <div
                    className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-2"
                    style={{ borderColor: 'var(--dk-border-strong)', borderTopColor: 'var(--dk-accent)' }}
                  />
                  <p style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>Loading map…</p>
                </div>
              </div>
            )}

            {/* Store count pill */}
            <div
              className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5"
              style={{ background: 'white', borderRadius: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF6B35', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>
                {validStores.length} stores nearby
              </span>
            </div>

            {/* Recenter + settings buttons */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-2">
              <button
                onClick={recenterMap}
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 10, background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
              >
                <LocateFixed size={16} style={{ color: '#FF6B35' }} />
              </button>
              <button
                className="flex items-center justify-center"
                style={{ width: 36, height: 36, borderRadius: 10, background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
              >
                <Settings size={16} style={{ color: '#555' }} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Selected store card ── */}
        {selectedStore && (
          <div className="px-4 mt-0">
            <div
              className="rounded-2xl p-4"
              style={{ background: 'white', border: '0.5px solid var(--dk-border)' }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 overflow-hidden"
                  style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--dk-surface)' }}
                >
                  {selectedStore.logoUrl ? (
                    <img src={selectedStore.logoUrl} className="w-full h-full object-cover" alt="logo" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-lg" style={{ color: 'var(--dk-accent)' }}>
                      {selectedStore.storeName?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ fontSize: 15, color: '#1A1A1A' }}>{selectedStore.storeName}</p>
                      {selectedStore.category && (
                        <p style={{ fontSize: 12, color: 'var(--dk-accent)', fontWeight: 600, marginTop: 1 }}>{selectedStore.category}</p>
                      )}
                    </div>
                    <button onClick={() => setSelectedStore(null)}>
                      <X size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {selectedStoreDistance && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} style={{ color: 'var(--dk-accent)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--dk-text-secondary)' }}>{selectedStoreDistance} away</span>
                      </div>
                    )}
                    {storeStatus && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} style={{ color: storeStatus.isOpen ? '#10B981' : '#EF4444', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: storeStatus.isOpen ? '#10B981' : '#EF4444', fontWeight: 600 }}>{storeStatus.label}</span>
                      </div>
                    )}
                    {selectedStore.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
                        <span className="truncate" style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>{selectedStore.address}</span>
                      </div>
                    )}
                    {selectedStore.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} style={{ color: 'var(--dk-text-tertiary)' }} />
                        <span style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>{selectedStore.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  to={`/store/${selectedStore.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--dk-surface)', color: '#1A1A1A' }}
                >
                  <Store size={14} />
                  View Store
                </Link>
                <a
                  href={selectedStore.latitude && selectedStore.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${selectedStore.latitude},${selectedStore.longitude}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#1A1A1A', color: 'white' }}
                >
                  <Navigation size={14} />
                  Navigate
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Bottom sheet: Stores near you (expands UPWARD) ── */}
        {validStores.length > 0 && (
          <div
            className="px-4"
            style={{
              position: 'fixed',
              bottom: 72,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 448,
              zIndex: 30,
              pointerEvents: 'none',
            }}
          >
            <div style={{ pointerEvents: 'auto' }}>
              {/* ── Expanded: header on top, white bg, scrollable list ── */}
              {listExpanded && (
                <div style={{ background: 'white', borderRadius: 20, border: '0.5px solid var(--dk-border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '55vh', marginBottom: 8 }}>
                  {/* Header — pinned at top */}
                  <button onClick={() => setListExpanded(false)} className="w-full flex items-center justify-between py-3 px-4 flex-shrink-0" style={{ borderBottom: '0.5px solid var(--dk-border)' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Stores near you · <span style={{ color: 'var(--dk-accent)' }}>{validStores.length}</span></p>
                    <ChevronDown size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
                  </button>
                  {/* Scrollable list */}
                  <div className="overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', padding: '8px 12px' }}>
                    <div className="space-y-2">
                      {validStores.map((store) => {
                        const dist = userLocation ? getDistance(userLocation.lat, userLocation.lng, store.latitude, store.longitude) : null;
                        const sStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
                        return (
                          <div key={store.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--dk-bg)', border: selectedStore?.id === store.id ? '1.5px solid var(--dk-accent)' : '0.5px solid var(--dk-border)' }}>
                            <button onClick={() => { flyToStore(store); setListExpanded(false); }} className="w-full text-left p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 overflow-hidden" style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--dk-surface)' }}>
                                  {store.logoUrl ? <img src={store.logoUrl} className="w-full h-full object-cover" alt={store.storeName} loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 20 }}>🏪</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold truncate" style={{ fontSize: 14, color: '#1A1A1A' }}>{store.storeName}</p>
                                  {store.category && <p style={{ fontSize: 11, color: 'var(--dk-accent)', fontWeight: 600, marginTop: 1 }}>{store.category}</p>}
                                  <div className="flex items-center gap-3 mt-1">
                                    {dist && <div className="flex items-center gap-1"><MapPin size={11} style={{ color: 'var(--dk-accent)' }} /><span style={{ fontSize: 11, color: 'var(--dk-text-secondary)' }}>{dist}</span></div>}
                                    {sStatus && <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(sStatus.color) }}>● {sStatus.label}</span>}
                                  </div>
                                </div>
                              </div>
                            </button>
                            <div className="flex gap-2 px-3 pb-3">
                              <Link to={`/store/${store.id}`} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold" style={{ background: 'white', color: '#1A1A1A', border: '0.5px solid var(--dk-border)' }}><Store size={12} /> View Store</Link>
                              <a href={store.latitude && store.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}` : '#'} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold" style={{ background: '#1A1A1A', color: 'white' }}><Navigation size={12} /> Navigate</a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Collapsed: header + horizontal cards ── */}
              {!listExpanded && (
                <div style={{ background: 'white', borderRadius: 20, border: '0.5px solid var(--dk-border)', boxShadow: '0 -2px 16px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
                  <button onClick={() => setListExpanded(true)} className="w-full flex items-center justify-between py-3 px-4" style={{ borderBottom: '0.5px solid var(--dk-border)' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Stores near you · <span style={{ color: 'var(--dk-accent)' }}>{validStores.length}</span></p>
                    <span style={{ fontSize: 11, color: 'var(--dk-text-tertiary)' }}>▲ Swipe up</span>
                  </button>

                  <div className="flex gap-3 overflow-x-auto py-3 px-3" style={{ scrollbarWidth: 'none' }}>
                    {storesLoading ? (
                      [1, 2, 3].map(i => (
                        <div key={i} className="flex-shrink-0" style={{ width: 160, borderRadius: 14, overflow: 'hidden', border: '0.5px solid #f0f0f0' }}>
                          <ShimmerBox width="100%" height={56} radius={0} />
                          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <ShimmerBox width="80%" height={12} />
                            <ShimmerBox width="55%" height={10} />
                            <ShimmerBox width="65%" height={10} />
                          </div>
                        </div>
                      ))
                    ) : validStores.slice(0, 8).map(store => {
                      const dist = userLocation ? getDistance(userLocation.lat, userLocation.lng, store.latitude, store.longitude) : null;
                      const sStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
                      const catDef2 = CATEGORIES.find(c => matchCategory(store.category, c.value));
                      return (
                        <button key={store.id} onClick={() => flyToStore(store)} className="flex-shrink-0 text-left overflow-hidden" style={{ width: 145, background: 'var(--dk-bg)', borderRadius: 14, border: selectedStore?.id === store.id ? '1.5px solid var(--dk-accent)' : '0.5px solid var(--dk-border)' }}>
                          <div style={{ width: '100%', height: 56, background: 'var(--dk-surface)', position: 'relative', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
                            {store.logoUrl ? <img src={store.logoUrl} className="w-full h-full object-cover" alt={store.storeName} loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 24 }}>🏪</div>}
                          </div>
                          <div className="px-2.5 py-2">
                            <p className="truncate font-bold" style={{ fontSize: 12, color: '#1A1A1A' }}>{store.storeName}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sStatus ? statusColor(sStatus.color) : '#EF4444', flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: sStatus ? statusColor(sStatus.color) : '#EF4444' }}>{sStatus?.label ?? 'Closed'}</span>
                            </div>
                            <p style={{ fontSize: 10, color: 'var(--dk-text-tertiary)', marginTop: 2 }}>{dist}{catDef2 ? ` · ${catDef2.emoji} ${catDef2.label}` : ''}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoaded || !userLocation ? null : validStores.length === 0 && (
          <div className="text-center py-16 px-4">
            <MapPin size={40} style={{ color: 'var(--dk-border-strong)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 14, color: 'var(--dk-text-secondary)', fontWeight: 600 }}>No stores found nearby</p>
            <p style={{ fontSize: 12, color: 'var(--dk-text-tertiary)', marginTop: 4 }}>Try changing the category filter</p>
          </div>
        )}

      </div>
    </div>
  );
}
