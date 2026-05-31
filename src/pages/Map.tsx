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
import { Search, X, Crosshair, MapPin, Clock, Phone, Store, Navigation, ChevronDown, ArrowUp, Layers } from 'lucide-react';
import { FLogo } from '../components/futuristic/FLogo';
import { IsoMap, type IsoMapStore } from '../components/futuristic/IsoMap';
import NotificationBell from '../components/NotificationBell';

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
  const [mapMode, setMapMode] = useState<'map' | '3d'>('map'); // Session 122: 3D↔Map toggle
  // Session 128.19: smart filter — radius (km) + status. 0 = no cap.
  const [mapRadius, setMapRadius] = useState(0);
  const [mapStatusFilter, setMapStatusFilter] = useState<'all' | 'open'>('all');
  const [mapFilterOpen, setMapFilterOpen] = useState(false);
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

  // Session 128.19: filter pipeline now applies smart-filter radius +
  // status alongside the category chip and search query.
  const filteredStores = useMemo(() => stores.filter(s => {
    if (!matchCategory(s.category, selectedCategory)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hit = s.storeName?.toLowerCase().includes(q)
        || s.category?.toLowerCase().includes(q)
        || s.address?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (mapStatusFilter === 'open') {
      const st = getStoreStatus(s.openingTime, s.closingTime, s.is24Hours, s.workingDays);
      if (!st?.isOpen) return false;
    }
    if (mapRadius > 0 && userLocation && s.latitude && s.longitude) {
      const d = getDistanceKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude);
      if (d > mapRadius) return false;
    }
    return true;
  }), [stores, selectedCategory, searchQuery, mapStatusFilter, mapRadius, userLocation]);

  const validStores = useMemo(() => filteredStores
    .filter(s => s.latitude && s.longitude && s.latitude !== 0)
    .sort((a, b) => {
      if (!userLocation) return 0;
      return getDistanceKm(userLocation.lat, userLocation.lng, a.latitude, a.longitude)
        - getDistanceKm(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
    }),
    [filteredStores, userLocation]
  );

  // Session 122: IsoMap (3D view) — project real store lat/lng into the
  // pseudo-isometric grid, user fixed at centre (50,50). Reflects actual
  // relative geography (NOT random pylons). Spread normalised to the
  // farthest shown store so the scene fills the grid.
  const isoStores = useMemo<IsoMapStore[]>(() => {
    if (!userLocation) return [];
    const shown = validStores.slice(0, 12);
    const maxAbs = Math.max(
      0.001,
      ...shown.flatMap(s => [
        Math.abs(s.latitude - userLocation.lat),
        Math.abs(s.longitude - userLocation.lng),
      ]),
    );
    return shown.map((s, i) => {
      const catDef = CATEGORIES.find(c => matchCategory(s.category, c.value));
      const x = 50 + ((s.longitude - userLocation.lng) / maxAbs) * 32;
      const y = 50 - ((s.latitude - userLocation.lat) / maxAbs) * 32; // invert lat for screen
      return {
        id: s.id,
        x: Math.max(10, Math.min(90, x)),
        y: Math.max(10, Math.min(90, y)),
        h: 28 + (i % 3) * 12, // deterministic height variety
        label: (s.storeName?.charAt(0) || '?').toUpperCase(),
        color: catDef?.color || 'var(--b-magenta-ink)',
      };
    });
  }, [validStores, userLocation]);

  const handleIsoSelect = (iso: IsoMapStore) => {
    const real = validStores.find(s => String(s.id) === String(iso.id));
    if (real) flyToStore(real);
  };

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
        // Session 128.18: extra 200px on top of the 80px BottomNav buffer so
        // the sticky bottom sheet (`position: sticky; bottom: 80`) never
        // covers the empty-state copy below the map. The sheet collapses to
        // ~180px tall when not expanded; 200 leaves a clean gap.
        paddingBottom: 280,
        fontFamily: 'var(--f-font)',
      }}
    >
      <div className="max-w-md mx-auto">

        {/* ── Gradient header ── */}
        <div
          className="sticky top-0 z-20 px-4 pb-3"
          style={{
            background: 'var(--b-grad)',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          }}
        >
          {/* Session 128.17: Dukanchi wordmark + tagline switched white → dark
              ink to match the rest of the yellow-header surfaces (Home/Search
              already render dark-on-yellow). Bell tile uses the same chip-bg
              token as the Home header for visual parity. */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <FLogo size={40} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--b-on-grad)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  Dukanchi
                </span>
                <span style={{ fontSize: 11, color: 'var(--b-on-grad-soft)', lineHeight: 1.1 }}>apna bazaar, apni dukaan</span>
              </div>
            </div>
            <div
              style={{
                width: 42, height: 42, borderRadius: 14,
                background: 'var(--b-chip-bg)', border: '1px solid var(--b-chip-line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <NotificationBell color="var(--b-on-grad)" />
            </div>
          </div>

          {/* Search + smart-filter button (Session 128.19) */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              className="flex items-center gap-2 px-3"
              style={{
                background: '#fff',
                borderRadius: 12,
                height: 44,
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                flex: 1,
                minWidth: 0,
              }}
            >
              <Search size={16} color="#A8A8A8" style={{ flexShrink: 0 }} />
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
                  <X size={14} color="var(--f-text-3)" />
                </button>
              )}
            </div>
            <button
              onClick={() => setMapFilterOpen(v => !v)}
              className="b-tap"
              style={{
                width: 44, height: 44, borderRadius: 12, border: 'none',
                background: (mapRadius > 0 || mapStatusFilter !== 'all' || mapFilterOpen) ? '#fff' : 'var(--b-chip-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              }}
              aria-label="Filters"
            >
              <Layers size={18} color="var(--b-on-grad)" />
            </button>
          </div>

          {/* Filter drawer — Session 128.19 smart-filter (radius + open-now). */}
          {mapFilterOpen && (
            <div
              style={{
                marginTop: 12, padding: 14, borderRadius: 14, background: '#fff',
                border: '1px solid var(--b-line)', boxShadow: 'var(--b-elev-card)',
              }}
            >
              <div className="flex gap-2 mb-3">
                {([
                  { key: 'all' as const, label: 'All' },
                  { key: 'open' as const, label: 'Open now' },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setMapStatusFilter(opt.key)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold"
                    style={
                      mapStatusFilter === opt.key
                        ? { background: 'var(--b-grad)', color: 'var(--b-on-grad)', border: 'none' }
                        : { background: 'var(--b-tint)', color: 'var(--b-gray-1)', border: '1px solid var(--b-line)' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mb-1">
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--b-gray-1)' }}>Radius</span>
                <span className="text-xs font-bold" style={{ color: 'var(--b-magenta-ink)' }}>
                  {mapRadius === 0 ? 'No limit' : `${mapRadius} km`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={mapRadius}
                onChange={e => setMapRadius(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: 'var(--b-magenta-ink)' }}
                disabled={!userLocation}
              />
              {!userLocation && (
                <p style={{ fontSize: 11, color: 'var(--b-orange)', marginTop: 4 }}>
                  Location grant karein to radius use ho
                </p>
              )}
            </div>
          )}

          {/* Session 128.15 — Map category chips: explicit 8px gap +
              guaranteed horizontal scroll (no wrap). Inactive uses dark ink
              on a soft chip surface (was translucent-white on gradient which
              made the dark-text on yellow gradient unreadable). */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
              overflowX: 'auto',
              overflowY: 'hidden',
              flexWrap: 'nowrap',
              scrollbarWidth: 'none',
              paddingBottom: 2,
              paddingRight: 16,
              marginRight: -16,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {CATEGORY_CHIPS.map(chip => {
              const active = selectedCategory === chip.value;
              return (
                <button
                  key={chip.value}
                  onClick={() => setSelectedCategory(chip.value)}
                  className="b-tap"
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    background: active ? '#fff' : 'var(--b-chip-bg)',
                    color: active ? 'var(--b-ink)' : 'var(--b-on-grad)',
                    border: active ? 'none' : '1px solid var(--b-chip-line)',
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
        <div className="px-4 pt-3">
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 20,
              height: 380,
              border: '1px solid var(--f-glass-border-2)',
              boxShadow: '0 6px 18px rgba(24,16,8,0.08)',
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
            ) : mapMode === '3d' && userLocation ? (
              /* Session 122: 3D isometric view — real stores projected onto the grid. */
              <IsoMap stores={isoStores} focused={selectedStore?.id} onSelect={handleIsoSelect} accent="var(--b-magenta-ink)" />
            ) : isLoaded ? (
              /* Session 128.19: drop the `&& userLocation` gate so the map
                 renders even before the user grants location. Falls back to
                 India centroid (20.5, 78.96) at zoom 5 — a useful default
                 that beats an infinite "Loading map…" spinner when the user
                 declined or hasn't been asked yet. The user-dot Marker only
                 renders when userLocation arrives. */
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={userLocation ?? { lat: 20.5937, lng: 78.9629 }}
                zoom={userLocation ? 13 : 5}
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
                {/* User dot — only when location is available */}
                {userLocation && (
                  <Marker
                    position={userLocation}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 10,
                      fillColor: 'var(--b-orange)',
                      fillOpacity: 1,
                      strokeWeight: 3,
                      strokeColor: '#ffffff',
                    }}
                    zIndex={100}
                  />
                )}

                {/* Store markers */}
                {validStores.map(store => {
                  const catDef = CATEGORIES.find(c => matchCategory(store.category, c.value));
                  const pinColor = catDef?.color || 'var(--b-orange)';
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
                    style={{ borderColor: 'var(--f-glass-border-2)', borderTopColor: 'var(--b-magenta-ink)' }}
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
                border: '1px solid rgba(199,126,0,0.30)',
                boxShadow: 'var(--b-elev-card)',
              }}
            >
              <span style={{ color: 'var(--b-magenta-ink)', fontSize: 11, textShadow: 'none' }}>●</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--f-text-1)' }}>
                <span style={{ color: 'var(--b-magenta-ink)', fontWeight: 800 }}>{validStores.length}</span> stores nearby
              </span>
            </div>

            {/* 3D ↔ Map toggle (top-right) — Session 128.17: renders
                unconditionally (was `{userLocation && …}` which made it
                disappear while location was still resolving, which the
                founder hit). Whisper-soft elevation, no neon halo. */}
            <div
              className="absolute top-3 right-3 flex"
              style={{
                padding: 3, borderRadius: 9999, gap: 2,
                background: '#fff',
                border: '1px solid var(--b-line)', boxShadow: 'var(--b-elev-card)',
              }}
            >
              {([
                { k: '3d' as const, icon: Layers, label: '3D' },
                { k: 'map' as const, icon: MapPin, label: 'Map' },
              ]).map(m => {
                const Icon = m.icon;
                const active = mapMode === m.k;
                return (
                  <button
                    key={m.k}
                    onClick={() => setMapMode(m.k)}
                    className="flex items-center gap-1"
                    style={{
                      padding: '6px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
                      background: active ? 'var(--b-grad)' : 'transparent',
                      color: active ? 'var(--b-on-grad)' : 'var(--b-gray-2)', border: 'none',
                    }}
                  >
                    <Icon size={12} color={active ? 'var(--b-on-grad)' : 'var(--b-gray-2)'} /> {m.label}
                  </button>
                );
              })}
            </div>

            {/* Recenter FAB (re-center handler preserved; dead no-op settings FAB removed — Session 122) */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-2">
              <button
                onClick={recenterMap}
                style={{ ...fabStyle, border: '1px solid rgba(234,154,0,0.45)', boxShadow: 'var(--b-elev-2)' }}
                aria-label="Re-center map"
              >
                <Crosshair size={18} color="var(--b-orange)" />
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
                    border: '2px solid var(--b-magenta-ink)',
                    boxShadow: 'var(--b-elev-card)',
                  }}
                >
                  {selectedStore.logoUrl ? (
                    <img src={selectedStore.logoUrl} className="w-full h-full object-cover" alt="logo" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-lg" style={{ color: 'var(--b-magenta-ink)' }}>
                      {selectedStore.storeName?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold truncate" style={{ fontSize: 15, color: 'var(--f-text-1)' }}>{selectedStore.storeName}</p>
                      {selectedStore.category && (
                        <p style={{ fontSize: 12, color: 'var(--b-magenta-ink)', fontWeight: 600, marginTop: 1 }}>{selectedStore.category}</p>
                      )}
                    </div>
                    <button onClick={() => setSelectedStore(null)}>
                      <X size={16} color="var(--f-text-3)" />
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {selectedStoreDistance && (
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>📍</span>
                        <span style={{ fontSize: 12, color: 'var(--f-text-2)' }}>{selectedStoreDistance} away</span>
                      </div>
                    )}
                    {storeStatus && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} color={statusColor(storeStatus.color)} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: statusColor(storeStatus.color), fontWeight: 600 }}>{storeStatus.label}</span>
                      </div>
                    )}
                    {selectedStore.address && (
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0, opacity: 0.55 }}>📍</span>
                        <span className="truncate" style={{ fontSize: 12, color: 'var(--f-text-3)' }}>{selectedStore.address}</span>
                      </div>
                    )}
                    {selectedStore.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} color="var(--f-text-3)" style={{ flexShrink: 0 }} />
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
                  <Store size={14} color="var(--f-text-1)" />
                  View Store
                </Link>
                <a
                  href={selectedStore.latitude && selectedStore.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${selectedStore.latitude},${selectedStore.longitude}` : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--b-grad)', color: 'white', boxShadow: 'var(--b-elev-card)' }}
                >
                  <Navigation size={14} color="white" />
                  Navigate
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Session 128.18: bottom sheet refactored AGAIN — Session 128.17
            shipped this as an inline block under the map, but the founder
            says it now expands DOWN inline whereas they want it to expand
            UPWARD (drawer-style, growing over the map area). Solution:
            anchor as `position: sticky; bottom: 0` over a `paddingBottom`
            spacer on the main scroll container, so the page is fully
            scrollable AND the sheet sits glued to the bottom of the
            viewport. In the expanded layout, the panel header sits at the
            BOTTOM of the sheet (clickable to collapse) and the scrollable
            list renders ABOVE it via `flex-direction: column-reverse` — so
            the visual growth direction is upward, matching the founder's
            mental model. Glow shadows replaced with whisper-soft elevation
            (Rule: app-wide neon strip from 128.17). */}
        {validStores.length > 0 && (
          <div
            className="px-4"
            style={{
              position: 'sticky',
              bottom: 80, // sits just above the 72px BottomNav + a 8px gap
              zIndex: 25,
              marginTop: 12,
            }}
          >
            <div>
              {/* ── Expanded: list ABOVE header (column-reverse) ── */}
              {listExpanded && (
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 20,
                    border: '1px solid var(--b-line)',
                    boxShadow: 'var(--b-elev-2)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    maxHeight: '55vh',
                    marginBottom: 8,
                  }}
                >
                  <button
                    onClick={() => setListExpanded(false)}
                    className="w-full flex items-center justify-between py-3 px-4 flex-shrink-0"
                    style={{ borderTop: '1px solid var(--b-line)', background: '#fff' }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--b-ink)' }}>
                      Stores near you · <span style={{ color: 'var(--b-magenta-ink)' }}>{validStores.length}</span>
                    </p>
                    <ChevronDown size={16} color="var(--b-gray-2)" />
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
                              border: selectedStore?.id === store.id ? '1.5px solid var(--b-magenta-ink)' : '1px solid var(--f-glass-border)',
                            }}
                          >
                            <button onClick={() => { flyToStore(store); setListExpanded(false); }} className="w-full text-left p-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0 overflow-hidden" style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--f-glass-bg-2)' }}>
                                  {store.logoUrl ? <img src={store.logoUrl} className="w-full h-full object-cover" alt={store.storeName} loading="lazy" decoding="async" /> : <div className="w-full h-full flex items-center justify-center" style={{ fontSize: 20 }}>🏪</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold truncate" style={{ fontSize: 14, color: 'var(--f-text-1)' }}>{store.storeName}</p>
                                  {store.category && <p style={{ fontSize: 11, color: 'var(--b-magenta-ink)', fontWeight: 600, marginTop: 1 }}>{store.category}</p>}
                                  <div className="flex items-center gap-3 mt-1">
                                    {dist && <div className="flex items-center gap-1"><span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>📍</span><span style={{ fontSize: 11, color: 'var(--f-text-2)' }}>{dist}</span></div>}
                                    {sStatus && <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(sStatus.color) }}>● {sStatus.label}</span>}
                                  </div>
                                </div>
                              </div>
                            </button>
                            <div className="flex gap-2 px-3 pb-3">
                              <Link to={`/store/${store.id}`} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold" style={{ background: 'var(--f-glass-bg-2)', color: 'var(--f-text-1)', border: '1px solid var(--f-glass-border)' }}><Store size={12} color="var(--f-text-1)" /> View Store</Link>
                              <a href={store.latitude && store.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}` : '#'} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold" style={{ background: 'var(--b-grad)', color: 'white' }}><Navigation size={12} color="white" /> Navigate</a>
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
                    background: '#fff',
                    borderRadius: 20,
                    border: '1px solid var(--b-line)',
                    boxShadow: 'var(--b-elev-2)',
                    overflow: 'hidden',
                  }}
                >
                  <button onClick={() => setListExpanded(true)} className="w-full flex items-center justify-between py-3 px-4" style={{ borderBottom: '1px solid var(--b-line)' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--b-ink)' }}>
                      Stores near you · <span style={{ color: 'var(--b-magenta-ink)' }}>{validStores.length}</span>
                    </p>
                    <span style={{ fontSize: 11, color: 'var(--b-gray-2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ArrowUp size={10} color="var(--b-gray-2)" /> Swipe up
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
                            border: selectedStore?.id === store.id ? '1.5px solid var(--b-magenta-ink)' : '1px solid var(--f-glass-border)',
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
              <MapPin size={40} color="var(--f-text-4)" />
            </div>
            <p style={{ fontSize: 14, color: 'var(--f-text-2)', fontWeight: 600 }}>No stores found nearby</p>
            <p style={{ fontSize: 12, color: 'var(--f-text-3)', marginTop: 4 }}>Try changing the category filter</p>
          </div>
        )}

      </div>
    </div>
  );
}
