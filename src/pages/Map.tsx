// GOOGLE MAPS SETUP: To fix "This page didn't load Google Maps correctly" / map blank on phone:
// 1. Go to console.cloud.google.com → APIs & Services → Credentials → your Maps JS API key
// 2. Under "Application restrictions" → HTTP referrers, add:
//    localhost:3000/*  |  localhost:5173/*  |  192.168.1.*/*  |  *.ngrok-free.dev/*  |  *.ngrok.io/*
// OR: Set restriction to "None" for development (re-restrict before production)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { apiFetch } from '../lib/api';
import { GoogleMap as GoogleMapComponent, useJsApiLoader, Marker as MarkerComponent } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useUserLocation } from '../context/LocationContext';
import { CATEGORIES, CATEGORY_CHIPS, matchCategory } from '../constants/categories';
import { FIcon } from '../components/futuristic/FIcon';
import { FLogo } from '../components/futuristic/FLogo';

const GoogleMap = GoogleMapComponent as any;
const Marker = MarkerComponent as any;

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

// Futuristic (v2) deep-space dark map style.
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0E1224' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0612' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9B94AA' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A0C1F' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2A1A30' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#9B94AA' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A2030' }] },
  { featureType: 'landscape', stylers: [{ color: '#0A0612' }] },
  { featureType: 'water', stylers: [{ color: '#14091F' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2A1A30' }] },
];

const fabStyle = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: '1px solid var(--f-glass-border-2)',
  background: 'var(--f-fab-bg)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
} as const;

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
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--f-bg-deep)',
        backgroundImage: 'var(--f-page-bg)',
        paddingBottom: 80,
        fontFamily: 'var(--f-font)',
      }}
    >
      <div className="max-w-md mx-auto">

        {/* ── Header ── */}
        <div
          className="sticky top-0 z-20 px-4 pt-3 pb-3"
          style={{
            background: 'var(--f-sticky-bg)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid var(--f-glass-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FLogo size={36} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--f-text-1)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                  Dukanchi
                </span>
                <span style={{ fontSize: 10, color: 'var(--f-text-3)', lineHeight: 1.15 }}>apna bazaar, apni dukaan</span>
              </div>
            </div>
            <div
              style={{
                width: 40, height: 40, borderRadius: 14,
                background: 'var(--f-glass-bg-2)', border: '1px solid var(--f-glass-border)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FIcon name="bell" size={18} color="var(--f-text-1)" />
            </div>
          </div>

          {/* Search */}
          <div
            className="flex items-center gap-2 px-3"
            style={{
              background: 'var(--f-glass-bg)',
              border: '1px solid var(--f-glass-border)',
              borderRadius: 14,
              height: 44,
            }}
          >
            <FIcon name="search" size={16} color="var(--f-text-3)" />
            <input
              type="text"
              placeholder="Search stores near you..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--f-text-1)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <FIcon name="x" size={14} color="var(--f-text-3)" />
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
                  style={
                    active
                      ? { background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)', color: 'white', border: '1px solid rgba(255,42,140,0.55)', boxShadow: '0 0 12px rgba(255,42,140,0.30)' }
                      : { background: 'var(--f-glass-bg-2)', color: 'var(--f-text-2)', border: '1px solid var(--f-glass-border)' }
                  }
                >
                  {chip.emoji && <span>{chip.emoji}</span>}
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Map container ── */}
        <div className="px-4 pt-3">
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 20,
              height: 380,
              border: '1px solid var(--f-glass-border-2)',
              boxShadow: '0 0 32px rgba(255,42,140,0.12)',
            }}
          >
            {loadError ? (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'var(--f-bg-elev)' }}
              >
                <div className="text-center px-4">
                  <p style={{ fontSize: 13, color: 'var(--f-text-2)', fontWeight: 600 }}>Map load nahi hua</p>
                  <p style={{ fontSize: 11, color: 'var(--f-text-3)', marginTop: 4 }}>
                    Google Maps API key configure karein — console.cloud.google.com
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--f-text-4)', marginTop: 2 }}>
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
                style={{ background: 'var(--f-bg-elev)' }}
              >
                <div className="text-center">
                  <div
                    className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-2"
                    style={{ borderColor: 'var(--f-glass-border-2)', borderTopColor: '#FF2A8C' }}
                  />
                  <p style={{ fontSize: 12, color: 'var(--f-text-3)' }}>Loading map…</p>
                </div>
              </div>
            )}

            {/* Store count pill */}
            <div
              className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5"
              style={{
                background: 'var(--f-fab-bg)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 9999,
                border: '1px solid rgba(255,42,140,0.30)',
                boxShadow: '0 0 14px rgba(255,42,140,0.25)',
              }}
            >
              <span style={{ color: '#FF2A8C', fontSize: 11, textShadow: '0 0 8px #FF2A8C' }}>●</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--f-text-1)' }}>
                <span style={{ color: '#FF6BB4', fontWeight: 800 }}>{validStores.length}</span> stores nearby
              </span>
            </div>

            {/* Recenter + settings buttons */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-2">
              <button
                onClick={recenterMap}
                style={{ ...fabStyle, border: '1px solid rgba(255,107,53,0.45)', boxShadow: '0 0 16px rgba(255,107,53,0.4)' }}
              >
                <FIcon name="crosshair" size={18} color="#FF6B35" />
              </button>
              <button style={fabStyle}>
                <FIcon name="settings" size={18} color="var(--f-text-1)" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Selected store card ── */}
        {selectedStore && (
          <div className="px-4 mt-3">
            <div className="f-glass" style={{ borderRadius: 18, padding: 16 }}>
              <div className="flex items-start gap-3">
                <div
                  className="flex-shrink-0 overflow-hidden"
                  style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: selectedStore.logoUrl ? '#000' : 'var(--f-glass-bg-2)',
                    border: '2px solid #FF2A8C',
                    boxShadow: '0 0 14px rgba(255,42,140,0.35)',
                  }}
                >
                  {selectedStore.logoUrl ? (
                    <img src={selectedStore.logoUrl} className="w-full h-full object-cover" alt="logo" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-lg" style={{ color: '#FF6BB4' }}>
                      {selectedStore.storeName?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold truncate" style={{ fontSize: 15, color: 'var(--f-text-1)' }}>{selectedStore.storeName}</p>
                      {selectedStore.category && (
                        <p style={{ fontSize: 12, color: '#FF6BB4', fontWeight: 600, marginTop: 1 }}>{selectedStore.category}</p>
                      )}
                    </div>
                    <button onClick={() => setSelectedStore(null)}>
                      <FIcon name="x" size={16} color="var(--f-text-3)" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {selectedStoreDistance && (
                      <div className="flex items-center gap-1.5">
                        <FIcon name="mapPin" size={12} color="#FF6BB4" />
                        <span style={{ fontSize: 12, color: 'var(--f-text-2)' }}>{selectedStoreDistance} away</span>
                      </div>
                    )}
                    {storeStatus && (
                      <div className="flex items-center gap-1.5">
                        <FIcon name="clock" size={12} color={statusColor(storeStatus.color)} />
                        <span style={{ fontSize: 12, color: statusColor(storeStatus.color), fontWeight: 600 }}>{storeStatus.label}</span>
                      </div>
                    )}
                    {selectedStore.address && (
                      <div className="flex items-center gap-1.5">
                        <FIcon name="mapPin" size={12} color="var(--f-text-3)" />
                        <span className="truncate" style={{ fontSize: 12, color: 'var(--f-text-3)' }}>{selectedStore.address}</span>
                      </div>
                    )}
                    {selectedStore.phone && (
                      <div className="flex items-center gap-1.5">
                        <FIcon name="phone" size={12} color="var(--f-text-3)" />
                        <span style={{ fontSize: 12, color: 'var(--f-text-3)' }}>{selectedStore.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  to={`/store/${selectedStore.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--f-glass-bg-2)', color: 'var(--f-text-1)', border: '1px solid var(--f-glass-border)' }}
                >
                  <FIcon name="storeIc" size={14} color="var(--f-text-1)" />
                  View Store
                </Link>
                <a
                  href={selectedStore.latitude && selectedStore.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${selectedStore.latitude},${selectedStore.longitude}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)', color: 'white', boxShadow: '0 0 14px rgba(255,42,140,0.4)' }}
                >
                  <FIcon name="navigation" size={14} color="white" />
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
              {/* ── Expanded: header on top, scrollable list ── */}
              {listExpanded && (
                <div
                  style={{
                    background: 'var(--f-modal-bg)',
                    backdropFilter: 'blur(28px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                    borderRadius: 20,
                    border: '1px solid var(--f-glass-border-2)',
                    boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '55vh',
                    marginBottom: 8,
                  }}
                >
                  <button
                    onClick={() => setListExpanded(false)}
                    className="w-full flex items-center justify-between py-3 px-4 flex-shrink-0"
                    style={{ borderBottom: '1px solid var(--f-glass-border)' }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)' }}>
                      Stores near you · <span style={{ color: '#FF6BB4' }}>{validStores.length}</span>
                    </p>
                    <FIcon name="chevD" size={16} color="var(--f-text-3)" />
                  </button>
                  <div className="overflow-y-auto overscroll-contain" style={{ scrollbarWidth: 'thin', padding: '8px 12px' }}>
                    <div className="space-y-2">
                      {validStores.map((store) => {
                        const dist = userLocation ? getDistance(userLocation.lat, userLocation.lng, store.latitude, store.longitude) : null;
                        const sStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
                        return (
                          <div
                            key={store.id}
                            className="rounded-2xl overflow-hidden"
                            style={{
                              background: 'var(--f-glass-bg)',
                              border: selectedStore?.id === store.id ? '1.5px solid rgba(255,42,140,0.55)' : '1px solid var(--f-glass-border)',
                            }}
                          >
                            <button onClick={() => { flyToStore(store); setListExpanded(false); }} className="w-full text-left p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 overflow-hidden" style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--f-glass-bg-2)' }}>
                                  {store.logoUrl ? <img src={store.logoUrl} className="w-full h-full object-cover" alt={store.storeName} loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 20 }}>🏪</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold truncate" style={{ fontSize: 14, color: 'var(--f-text-1)' }}>{store.storeName}</p>
                                  {store.category && <p style={{ fontSize: 11, color: '#FF6BB4', fontWeight: 600, marginTop: 1 }}>{store.category}</p>}
                                  <div className="flex items-center gap-3 mt-1">
                                    {dist && <div className="flex items-center gap-1"><FIcon name="mapPin" size={11} color="#FF6BB4" /><span style={{ fontSize: 11, color: 'var(--f-text-2)' }}>{dist}</span></div>}
                                    {sStatus && <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(sStatus.color) }}>● {sStatus.label}</span>}
                                  </div>
                                </div>
                              </div>
                            </button>
                            <div className="flex gap-2 px-3 pb-3">
                              <Link to={`/store/${store.id}`} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold" style={{ background: 'var(--f-glass-bg-2)', color: 'var(--f-text-1)', border: '1px solid var(--f-glass-border)' }}><FIcon name="storeIc" size={12} color="var(--f-text-1)" /> View Store</Link>
                              <a href={store.latitude && store.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}` : '#'} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold" style={{ background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)', color: 'white' }}><FIcon name="navigation" size={12} color="white" /> Navigate</a>
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
                <div
                  style={{
                    background: 'var(--f-modal-bg)',
                    backdropFilter: 'blur(28px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                    borderRadius: 20,
                    border: '1px solid var(--f-glass-border-2)',
                    boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                  }}
                >
                  <button onClick={() => setListExpanded(true)} className="w-full flex items-center justify-between py-3 px-4" style={{ borderBottom: '1px solid var(--f-glass-border)' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)' }}>
                      Stores near you · <span style={{ color: '#FF6BB4' }}>{validStores.length}</span>
                    </p>
                    <span style={{ fontSize: 11, color: 'var(--f-text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FIcon name="arrowUp" size={10} color="var(--f-text-3)" /> Swipe up
                    </span>
                  </button>

                  <div className="flex gap-3 overflow-x-auto py-3 px-3" style={{ scrollbarWidth: 'none' }}>
                    {storesLoading ? (
                      [1, 2, 3].map(i => (
                        <div key={i} className="flex-shrink-0" style={{ width: 160, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--f-glass-border)' }}>
                          <div style={{ width: '100%', height: 56, background: 'var(--f-glass-bg-2)' }} />
                          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ width: '80%', height: 11, borderRadius: 6, background: 'var(--f-glass-bg-2)' }} />
                            <div style={{ width: '55%', height: 9, borderRadius: 6, background: 'var(--f-glass-bg)' }} />
                          </div>
                        </div>
                      ))
                    ) : validStores.slice(0, 8).map(store => {
                      const dist = userLocation ? getDistance(userLocation.lat, userLocation.lng, store.latitude, store.longitude) : null;
                      const sStatus = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
                      const catDef2 = CATEGORIES.find(c => matchCategory(store.category, c.value));
                      return (
                        <button
                          key={store.id}
                          onClick={() => flyToStore(store)}
                          className="flex-shrink-0 text-left overflow-hidden"
                          style={{
                            width: 145,
                            background: 'var(--f-glass-bg)',
                            borderRadius: 14,
                            border: selectedStore?.id === store.id ? '1.5px solid rgba(255,42,140,0.55)' : '1px solid var(--f-glass-border)',
                          }}
                        >
                          <div style={{ width: '100%', height: 56, background: 'var(--f-glass-bg-2)', position: 'relative', borderRadius: '14px 14px 0 0', overflow: 'hidden' }}>
                            {store.logoUrl ? <img src={store.logoUrl} className="w-full h-full object-cover" alt={store.storeName} loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 24 }}>🏪</div>}
                          </div>
                          <div className="px-2.5 py-2">
                            <p className="truncate font-bold" style={{ fontSize: 12, color: 'var(--f-text-1)' }}>{store.storeName}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: sStatus ? statusColor(sStatus.color) : '#FF4D6A', flexShrink: 0 }} />
                              <span style={{ fontSize: 10, fontWeight: 600, color: sStatus ? statusColor(sStatus.color) : '#FF4D6A' }}>{sStatus?.label ?? 'Closed'}</span>
                            </div>
                            <p style={{ fontSize: 10, color: 'var(--f-text-3)', marginTop: 2 }}>{dist}{catDef2 ? ` · ${catDef2.emoji} ${catDef2.label}` : ''}</p>
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <FIcon name="mapPin" size={40} color="var(--f-text-4)" />
            </div>
            <p style={{ fontSize: 14, color: 'var(--f-text-2)', fontWeight: 600 }}>No stores found nearby</p>
            <p style={{ fontSize: 12, color: 'var(--f-text-3)', marginTop: 4 }}>Try changing the category filter</p>
          </div>
        )}

      </div>
    </div>
  );
}
