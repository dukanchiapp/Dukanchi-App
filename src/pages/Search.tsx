import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useUserLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { captureEvent } from '../lib/posthog';
import { Sentry } from '../lib/sentry-frontend';
import { CATEGORIES as ALL_CATEGORIES, matchCategory } from '../constants/categories';
import { usePageMeta } from '../hooks/usePageMeta';
import { Search, X, SlidersHorizontal, ArrowRight, Clock, Store, Navigation, ChevronRight, Check } from 'lucide-react';
import { RadarPulse } from '../components/futuristic/RadarPulse';

const TRENDING = ['PS5', 'iPhone 15', 'perfumes', 'earbuds'];

export default function SearchPage() {
  usePageMeta({ title: 'Search' });
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<{ products: any[]; stores: any[] }>({
    products: [],
    stores: [],
  });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  // Session 128.19: founder asked for radius + area selector inside the
  // Search filter panel. Filter is applied client-side over the AI search
  // results — backend semantics unchanged. `searchRadius` = 0 means "all"
  // (no radius cap). `searchAreaMode` = 'my' uses userLocation; 'custom'
  // future-extends to geocoding a typed area (placeholder for now).
  const [searchRadius, setSearchRadius] = useState(0); // 0 = all, 1-20 km
  const [searchAreaMode, setSearchAreaMode] = useState<'my' | 'all'>('all');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ask Nearby modal state
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [askQuery, setAskQuery] = useState('');
  const [askAreaMode, setAskAreaMode] = useState<'my' | 'custom'>('my');
  const [askCustomArea, setAskCustomArea] = useState('');
  const [askRadius, setAskRadius] = useState(5);
  const [askSending, setAskSending] = useState(false);
  const [askResult, setAskResult] = useState<{ sentTo: number; storeNames: string[] } | null>(null);
  const [askGeocodingArea, setAskGeocodingArea] = useState(false);

  const { token } = useAuth();
  const navigate = useNavigate();
  const { location: userLocCtx } = useUserLocation();
  const { showToast } = useToast();
  const userLocation = userLocCtx ? { lat: userLocCtx.lat, lng: userLocCtx.lng } : null;

  useEffect(() => {
    if (!token) return;
    const fetchHistory = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) return;
        const res = await apiFetch(`/api/users/${user.id}/search-history`);
        if (res.ok) {
          const data = await res.json();
          const unique = [...new Set(data.map((d: any) => d.query))] as string[];
          setSearchHistory(unique.slice(0, 8));
        }
      } catch (err) {
        console.error('fetchSearchHistory failed:', err);
      }
    };
    fetchHistory();
  }, [token]);

  const saveSearch = (q: string) => {
    if (!q.trim() || !token) return;
    apiFetch('/api/search/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q.trim() }),
    })
      .then(() => {
        setSearchHistory(prev => {
          const filtered = prev.filter(s => s.toLowerCase() !== q.trim().toLowerCase());
          return [q.trim(), ...filtered].slice(0, 8);
        });
      })
      .catch((err) => {
        // History persist is best-effort — no toast (search itself succeeded).
        Sentry.captureException(err, { extra: { context: 'search.historyPersist' } });
      });
  };

  const removeHistoryItem = (item: string) => {
    setSearchHistory(prev => prev.filter(s => s !== item));
  };

  const clearAllHistory = async () => {
    if (!token) return;
    try {
      await apiFetch('/api/search/history', { method: 'DELETE' });
      setSearchHistory([]);
    } catch (err) {
      console.error('clearAllHistory failed:', err);
    }
  };

  // Single 300ms debounce for all search operations
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (debouncedQuery.length < 1 || !token) {
      setSuggestions([]);
      return;
    }
    apiFetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`)
      .then(res => res.ok ? res.json() : { suggestions: [] })
      .then(data => setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []))
      .catch(() => setSuggestions([]));
  }, [debouncedQuery, token]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults({ products: [], stores: [] });
      setCorrectedQuery(null);
      return;
    }
    setLoading(true);
    setShowSuggestions(false);
    saveSearch(debouncedQuery);
    apiFetch(`/api/search/ai?q=${encodeURIComponent(debouncedQuery)}`)
      .then(res => (res.ok ? res.json() : { products: [], stores: [] }))
      .then(data => {
        const products = Array.isArray(data.products) ? data.products : [];
        const stores = Array.isArray(data.stores) ? data.stores : [];
        setResults({ products, stores });
        setCorrectedQuery(data.correctedQuery || null);
        setLoading(false);
        // PostHog: search_performed — capture metrics ONLY, not the query text
        // (privacy: search queries may contain PII like phone numbers, addresses).
        captureEvent('search_performed', {
          query_length: debouncedQuery.length,
          products_count: products.length,
          stores_count: stores.length,
          had_correction: !!data.correctedQuery,
        });
      })
      .catch(() => setLoading(false));
  }, [debouncedQuery]);

  const hasResults = results.stores.length > 0;

  // Session 128.19: extended client-side filter pipeline.
  //   1. Category (chip select) — unchanged.
  //   2. Radius (slider) — drop stores beyond `searchRadius` km when set.
  //      Only applies when areaMode is 'my' and userLocation is known.
  //   3. Sort: relevance (insert order) or name A-Z; opens-first still wins.
  const filteredStores = useMemo(() => {
    const haversine = (lat: number, lng: number): number | null => {
      if (!userLocation || !lat || !lng) return null;
      const R = 6371;
      const dLat = (lat - userLocation.lat) * Math.PI / 180;
      const dLon = (lng - userLocation.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180)
        * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };
    return results.stores
      .filter(s => matchCategory(s.category, selectedCategory))
      .filter(s => {
        if (searchAreaMode !== 'my' || searchRadius <= 0) return true;
        const d = haversine(s.latitude, s.longitude);
        return d == null ? true : d <= searchRadius;
      })
      .sort((a, b) => {
        const aOpen = getStoreStatus(a.openingTime, a.closingTime, a.is24Hours, a.workingDays)?.isOpen ? 0 : 1;
        const bOpen = getStoreStatus(b.openingTime, b.closingTime, b.is24Hours, b.workingDays)?.isOpen ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        if (sortBy === 'name') {
          return (a.storeName || '').localeCompare(b.storeName || '');
        }
        return 0;
      });
  }, [results.stores, selectedCategory, searchRadius, searchAreaMode, sortBy, userLocation]);

  const hasFilters = !!selectedCategory || sortBy !== 'relevance' || searchRadius > 0 || searchAreaMode !== 'all';
  const clearFilters = () => {
    setSelectedCategory('');
    setSortBy('relevance');
    setSearchRadius(0);
    setSearchAreaMode('all');
  };

  const getDistance = (storeLat: number, storeLng: number): string | null => {
    if (!userLocation || !storeLat || !storeLng) return null;
    const R = 6371;
    const dLat = (storeLat - userLocation.lat) * (Math.PI / 180);
    const dLon = (storeLng - userLocation.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((storeLat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
  };

  const openDirections = (store: any) => {
    if (store.latitude && store.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`,
        '_blank'
      );
    } else if (store.address) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(store.address)}`,
        '_blank'
      );
    }
  };

  const openAskModal = () => {
    setAskQuery(query || '');
    setAskAreaMode('my');
    setAskCustomArea('');
    setAskRadius(5);
    setAskResult(null);
    setAskModalOpen(true);
  };

  const handleAskSend = async () => {
    if (!askQuery.trim() || askQuery.trim().length < 3) {
      showToast('Kya chahiye? Thoda aur likho');
      return;
    }
    if (!token) { showToast('Pehle login karo'); return; }

    let lat: number, lng: number, areaLabel: string | undefined;

    if (askAreaMode === 'my') {
      if (!userLocation) { showToast('Location on karo'); return; }
      lat = userLocation.lat;
      lng = userLocation.lng;
      areaLabel = userLocCtx?.name;
    } else {
      if (!askCustomArea.trim()) { showToast('Area ka naam likho'); return; }
      setAskGeocodingArea(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(askCustomArea)}&limit=1`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data = await res.json();
        if (!data?.length) {
          showToast('Area nahi mila, dobara try karo');
          setAskGeocodingArea(false);
          return;
        }
        lat = parseFloat(data[0].lat);
        lng = parseFloat(data[0].lon);
        areaLabel = askCustomArea.trim();
      } catch (err) {
        showToast('Area nahi mila, dobara try karo');
        Sentry.captureException(err, { extra: { context: 'search.areaGeocoding', area: askCustomArea } });
        setAskGeocodingArea(false);
        return;
      } finally {
        setAskGeocodingArea(false);
      }
    }

    setAskSending(true);
    try {
      const res = await apiFetch('/api/ask-nearby/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: askQuery.trim(), radiusKm: askRadius, latitude: lat, longitude: lng, areaLabel }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Kuch problem aayi, dobara try karo'); return; }
      if (data.found === 0) { showToast(data.message || 'Koi matching store nahi mila'); return; }
      setAskResult({ sentTo: data.sentTo, storeNames: data.storeNames });
    } catch (err) {
      showToast('Network error, dobara try karo');
      Sentry.captureException(err, { extra: { context: 'search.askNearbySend' } });
    } finally {
      setAskSending(false);
    }
  };

  const isSearching = query.length >= 2;

  // ── Futuristic style helpers ───────────────────────────────────────
  const eyebrow = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    color: 'var(--f-text-3)',
  };

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
        {/* Session 128.14 — Bright Skin Search header (per SearchScreen.jsx
            lines 11-23): yellow gradient block + b-head mesh sheen + big 23px
            Sora title + white inline search bar with magnifier + filter pill.
            Mounts in the same sticky slot the bespoke Header occupied. */}
        <div
          className="b-head sticky top-0 z-20"
          style={{
            background: 'var(--b-grad)',
            padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 16px 16px',
          }}
        >
          <h1
            style={{
              fontSize: 23,
              fontWeight: 800,
              fontFamily: 'var(--b-display)',
              color: 'var(--b-on-grad)',
              letterSpacing: '-0.03em',
              marginBottom: 14,
            }}
          >
            Kya dhoondh rahe ho?
          </h1>

          {/* Search input + filter button */}
          <div className="relative" ref={suggestionsRef}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#fff',
                borderRadius: 14,
                padding: '12px 14px',
              }}
            >
              <Search size={20} color="var(--b-gray-2)" strokeWidth={2} style={{ flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Shops, products, categories…"
                value={query}
                onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                style={{
                  border: 'none',
                  outline: 'none',
                  flex: 1,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  color: 'var(--b-ink)',
                  background: 'transparent',
                  minWidth: 0,
                }}
              />
              {query ? (
                <button
                  onClick={() => { setQuery(''); setSuggestions([]); setCorrectedQuery(null); }}
                  style={{ background: 'transparent', border: 'none', display: 'flex', cursor: 'pointer', padding: 0 }}
                  aria-label="Clear search"
                >
                  <X size={15} color="var(--b-gray-2)" />
                </button>
              ) : null}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="b-tap"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: hasFilters || showFilters ? 'var(--b-grad)' : 'var(--b-tint)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                aria-label="Filters"
              >
                <SlidersHorizontal size={17} color={hasFilters || showFilters ? 'var(--b-on-grad)' : 'var(--b-orange)'} strokeWidth={2} />
              </button>
            </div>

            {/* Autocomplete suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && query.length >= 1 && (
              <div
                className="absolute left-0 right-0 z-30 mt-1 overflow-hidden"
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  border: '1px solid var(--b-line)',
                  boxShadow: 'var(--b-elev-2)',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
                    style={{ borderBottom: i < suggestions.length - 1 ? '1px solid var(--f-glass-border)' : 'none' }}
                    onMouseDown={(e) => { e.preventDefault(); setQuery(s); setShowSuggestions(false); }}
                  >
                    <Search size={14} color="var(--f-text-3)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--f-text-1)', flex: 1 }}>
                      {s.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, j) =>
                        part.toLowerCase() === query.toLowerCase()
                          ? <strong key={j} style={{ color: 'var(--b-magenta-ink)' }}>{part}</strong>
                          : <span key={j}>{part}</span>
                      )}
                    </span>
                    <ArrowRight size={12} color="var(--f-text-3)" style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Session 128.14 — body surface (everything below the gradient header) */}
        <main style={{ padding: '16px 16px 24px', background: 'var(--b-surface)' }}>
          {/* Did you mean? correction banner */}
          {correctedQuery && isSearching && (
            <div
              className="flex items-center gap-2 mb-3 mt-2 px-3 py-2.5"
              style={{
                background: 'var(--f-glass-bg)',
                borderRadius: 12,
                border: '1px solid var(--f-glass-border)',
              }}
            >
              <Search size={14} color="var(--b-magenta-ink)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--f-text-2)' }}>
                Showing results for{' '}
                <button
                  onClick={() => setQuery(correctedQuery)}
                  style={{ fontWeight: 700, color: 'var(--b-magenta-ink)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}
                >
                  {correctedQuery}
                </button>
              </span>
            </div>
          )}

          {/* Filter panel */}
          {showFilters && (
            <div
              className="f-glass"
              style={{ borderRadius: 18, padding: 16, marginTop: 12, marginBottom: 16 }}
            >
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--f-text-1)' }}>Filters</p>
                {hasFilters && (
                  <button onClick={clearFilters} style={{ fontSize: 12, color: 'var(--b-magenta-ink)', fontWeight: 700 }}>Clear all</button>
                )}
              </div>
              {/* Category */}
              <p style={{ ...eyebrow, marginBottom: 8 }}>Category</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {ALL_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(selectedCategory === cat.value ? '' : cat.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={
                      selectedCategory === cat.value
                        ? { background: 'var(--b-grad)', color: 'var(--b-on-grad)', border: 'none', boxShadow: 'var(--b-elev-2)' }
                        : { background: 'var(--f-glass-bg-2)', color: 'var(--f-text-2)', border: '1px solid var(--f-glass-border)' }
                    }
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
              {/* Session 128.19: founder asked filter to expose radius +
                  area + category. Category is the chips block above. Area
                  toggles between 'all' (no location cap) and 'my' (use
                  userLocation + radius). Radius slider only enables when
                  'my' is selected. */}
              <p style={{ ...eyebrow, marginBottom: 8 }}>Area</p>
              <div className="flex gap-2 mb-4">
                {([
                  { key: 'all' as const, label: '🌐 All India' },
                  { key: 'my' as const, label: '📍 Meri location' },
                ]).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSearchAreaMode(opt.key)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold"
                    style={
                      searchAreaMode === opt.key
                        ? { background: 'var(--b-grad)', color: 'var(--b-on-grad)', border: 'none', boxShadow: 'var(--b-elev-2)' }
                        : { background: 'var(--f-glass-bg-2)', color: 'var(--f-text-2)', border: '1px solid var(--f-glass-border)' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {searchAreaMode === 'my' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p style={eyebrow}>Radius</p>
                    <span className="text-xs font-bold" style={{ color: 'var(--b-magenta-ink)' }}>
                      {searchRadius === 0 ? 'No limit' : `${searchRadius} km`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={searchRadius}
                    onChange={e => setSearchRadius(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: 'var(--b-magenta-ink)' }}
                    disabled={!userLocation}
                  />
                  {!userLocation && (
                    <p style={{ fontSize: 11, color: 'var(--b-orange)', marginTop: 4 }}>
                      Location grant karein to radius filter use ho sake
                    </p>
                  )}
                </div>
              )}

              {/* Sort */}
              <p style={{ ...eyebrow, marginBottom: 8 }}>Sort by</p>
              <div className="flex gap-2 flex-wrap">
                {[{ key: 'relevance', label: 'Relevance' }, { key: 'name', label: 'Name A-Z' }].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSortBy(opt.key)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={
                      sortBy === opt.key
                        ? { background: 'var(--b-grad)', color: 'var(--b-on-grad)', border: 'none', boxShadow: 'var(--b-elev-2)' }
                        : { background: 'var(--f-glass-bg-2)', color: 'var(--f-text-2)', border: '1px solid var(--f-glass-border)' }
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Discovery state */}
          {!isSearching && (
            <>
              {/* Session 128.15 — Trending: horizontal-scroll row per spec
                  (SearchScreen.jsx makes them a `flex-wrap` but bright.html
                  shows them as a single non-wrapping row). overflow-x:auto
                  + flexWrap:nowrap keeps them visible without clipping. */}
              <section className="mb-6" style={{ marginTop: 16 }}>
                <p style={{ ...eyebrow, marginBottom: 12 }}>Trending near you</p>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    paddingBottom: 4,
                    paddingRight: 16,
                    marginRight: -16,
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                  }}
                >
                  {TRENDING.map((item, idx) => (
                    <button
                      key={item}
                      onClick={() => setQuery(item)}
                      className="b-tap"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '9px 15px',
                        borderRadius: 9999,
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--b-ink)',
                        background: '#fff',
                        border: '1px solid var(--b-line)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {idx === 0 && <span>🔥</span>}
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              {/* Browse by category */}
              <section className="mb-6">
                <p style={{ ...eyebrow, marginBottom: 12 }}>Browse by category</p>
                {/* Session 128.15 — Category 4-col grid: explicit 16px right
                    padding (per founder direction) so the 4th column never
                    clips at the safe-area / scrollbar edge. */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 10,
                    boxSizing: 'border-box',
                    width: '100%',
                    paddingRight: 16,
                  }}
                >
                  {ALL_CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setQuery(cat.label)}
                      className="b-tap flex flex-col items-center justify-center gap-2"
                      style={{
                        background: 'var(--f-bg-elev)',
                        border: '1px solid var(--f-glass-border)',
                        borderRadius: 18,
                        padding: '14px 4px 12px',
                      }}
                    >
                      {/* Claymorphic colored icon tile — cat.color at 13% alpha bg */}
                      <span className="b-clay" style={{
                        width: 46, height: 46, background: cat.color + '22', fontSize: 24, lineHeight: 1, flexShrink: 0,
                      }}>
                        <span className="b-clay-emoji">{cat.emoji}</span>
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--f-text-1)', lineHeight: 1.15, textAlign: 'center',
                        width: '100%', padding: '0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Recent searches — Session 128.17: capped to 3 most-recent
                  per founder direction (was up to 8). The full history still
                  lives server-side; this just trims the UI. */}
              {searchHistory.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <div className="flex items-center justify-between mb-3">
                    <p style={eyebrow}>Recent searches</p>
                    <button onClick={clearAllHistory} className="text-xs font-semibold" style={{ color: 'var(--b-magenta-ink)' }}>
                      Clear all
                    </button>
                  </div>
                  <div>
                    {searchHistory.slice(0, 3).map((q, i) => {
                      const visibleCount = Math.min(searchHistory.length, 3);
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between py-2.5"
                          style={{ borderBottom: i < visibleCount - 1 ? '1px solid var(--f-glass-border)' : 'none' }}
                        >
                          <button
                            onClick={() => setQuery(q)}
                            className="flex items-center gap-2.5 flex-1 text-left"
                          >
                            <Clock size={15} color="var(--f-text-3)" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 14, color: 'var(--f-text-1)' }}>{q}</span>
                          </button>
                          <button onClick={() => removeHistoryItem(q)} className="ml-2 p-1">
                            <X size={14} color="var(--f-text-3)" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Session 128.17: "Aur dhundho nearby?" (bulk Ask-Nearby) tile
                  promoted into discovery state, BELOW Recent Searches — was
                  previously only visible WHILE typing. Founder wanted this as
                  a discoverable entry point. Same handler (openAskModal); no
                  neon glow halo (Rule: app-wide glow strip). */}
              <section>
                <div
                  className="overflow-hidden"
                  style={{
                    borderRadius: 18,
                    background: '#fff',
                    border: '1px solid var(--b-line)',
                    boxShadow: 'var(--b-elev-card)',
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>📍</span>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--b-ink)', marginBottom: 3, letterSpacing: '-0.02em' }}>
                          Aur dhundho nearby?
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--b-gray-2)', lineHeight: 1.5 }}>
                          Aapke area ki shops se seedha poocho — sirf wahi dikhenge jiske paas stock hai
                        </p>
                      </div>
                    </div>
                    {/* Session 128.19: Ask Nearby CTA → green gradient per
                        founder ("ask near by green radient sab jagah jahan
                        bhi ye feature hain"). All 4 entry points (discovery
                        tile + in-search tile + modal Send + Messages-mein-
                        jaao) switched to var(--c-action / --b-green). */}
                    <button
                      onClick={openAskModal}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                      style={{ background: 'var(--c-action, var(--b-green))', color: '#fff', border: 'none' }}
                    >
                      Nearby shops se poocho
                      <ChevronRight size={15} color="#fff" />
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Search results state */}
          {isSearching && (
            <>
              {/* Results count */}
              <div className="flex items-center mb-4" style={{ marginTop: 14 }}>
                <span style={{ fontSize: 13, color: 'var(--f-text-2)' }}>
                  {loading ? 'Searching...' : hasResults ? `${filteredStores.length} store${filteredStores.length !== 1 ? 's' : ''} found` : ''}
                </span>
              </div>

              {/* Loading skeletons */}
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="f-glass" style={{ borderRadius: 16, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--f-glass-bg-2)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: '55%', height: 12, borderRadius: 6, background: 'var(--f-glass-bg-2)' }} />
                        <div style={{ width: '35%', height: 9, borderRadius: 6, background: 'var(--f-glass-bg)', marginTop: 7 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : hasResults ? (
                <div className="space-y-6">
                  {filteredStores.length > 0 && (
                    <div>
                      <p style={{ ...eyebrow, marginBottom: 12 }}>Stores ({filteredStores.length})</p>
                      <div className="space-y-3">
                        {filteredStores.map(store => {
                          const status = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
                          const distance = getDistance(store.latitude, store.longitude);
                          return (
                            <div
                              key={store.id}
                              className="f-glass overflow-hidden cursor-pointer"
                              style={{ borderRadius: 18 }}
                              onClick={() => navigate(`/store/${store.id}`)}
                            >
                              <div className="p-4">
                                <div className="flex items-start gap-3 mb-3">
                                  <div
                                    className="w-12 h-12 overflow-hidden flex-shrink-0 flex items-center justify-center"
                                    style={{
                                      borderRadius: '50%',
                                      background: store.logoUrl ? '#000' : 'var(--f-glass-bg-2)',
                                      border: '2px solid var(--b-magenta-ink)',
                                      boxShadow: 'var(--b-elev-card)',
                                    }}
                                  >
                                    {store.logoUrl
                                      ? <img src={store.logoUrl} alt={store.storeName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                      : <span style={{ fontSize: 22 }}>🏪</span>
                                    }
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-bold leading-tight" style={{ fontSize: 14, color: 'var(--f-text-1)' }}>
                                      {store.storeName}
                                    </h3>
                                    {store.category && (
                                      <p style={{ fontSize: 12, color: 'var(--f-text-3)', marginTop: 2 }}>
                                        {store.category}
                                      </p>
                                    )}
                                    <div className="flex flex-col gap-1 mt-1">
                                      {distance && (
                                        <span className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--f-text-2)' }}>
                                          <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>📍</span>
                                          {distance} away
                                        </span>
                                      )}
                                      {/* Session 128.20: area + city from
                                          profile details, per founder ask. */}
                                      {(store.city || store.postalCode || store.address) && (
                                        <span className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--f-text-3)' }}>
                                          <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0 }}>🏙️</span>
                                          {[store.city, store.postalCode].filter(Boolean).join(' · ') || store.address}
                                        </span>
                                      )}
                                      {status && (
                                        <span
                                          className="flex items-center gap-1"
                                          style={{ fontSize: 12, fontWeight: 600, color: statusColor(status.color) }}
                                        >
                                          <Clock size={10} color={statusColor(status.color)} style={{ flexShrink: 0 }} />
                                          {status.label}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className="flex gap-2 pt-3"
                                  style={{ borderTop: '1px solid var(--f-glass-border)' }}
                                >
                                  <Link
                                    to={`/store/${store.id}`}
                                    onClick={e => e.stopPropagation()}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                                    style={{ background: 'var(--f-glass-bg-2)', color: 'var(--f-text-1)', border: '1px solid var(--f-glass-border)' }}
                                  >
                                    <Store size={13} color="var(--f-text-1)" />
                                    View Store
                                  </Link>
                                  {/* Session 128.20: Navigate → blue gradient,
                                      matching the Direction-to-Store CTA. */}
                                  <button
                                    onClick={e => { e.stopPropagation(); openDirections(store); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                                    style={{
                                      background: 'linear-gradient(135deg, #2E9BFF 0%, #1D4ED8 100%)',
                                      color: '#fff', boxShadow: '0 6px 18px rgba(37,99,235,0.32)',
                                    }}
                                  >
                                    <Navigation size={13} color="white" />
                                    Navigate
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {filteredStores.length === 0 && hasFilters && (
                    <div className="text-center py-12">
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                        <SlidersHorizontal size={36} color="var(--f-text-4)" />
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--f-text-2)' }}>
                        No results match your filters.
                      </p>
                      <button onClick={clearFilters} className="mt-2 text-sm font-semibold" style={{ color: 'var(--b-magenta-ink)' }}>
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <Search size={44} color="var(--f-text-4)" />
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--f-text-2)' }}>
                    No results for "{query}"
                  </p>
                </div>
              )}

              {/* Ask Nearby suggestion card — show when typing */}
              {isSearching && !loading && (
                <div
                  className="mt-4 overflow-hidden"
                  style={{
                    borderRadius: 22,
                    background: 'var(--f-modal-bg)',
                    border: '1px solid rgba(199,126,0,0.30)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span style={{ fontSize: 26, filter: 'none' }}>📍</span>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--f-text-1)', marginBottom: 3, letterSpacing: '-0.02em' }}>
                          Aur dhundho nearby?
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--f-text-2)', lineHeight: 1.5 }}>
                          Aapke area ki shops se seedha poocho — sirf wahi dikhenge jiske paas stock hai
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={openAskModal}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm"
                      style={{
                        background: 'var(--c-action, var(--b-green))',
                        color: '#fff',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
                      }}
                    >
                      Nearby shops se poocho
                      <ChevronRight size={15} color="#fff" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Ask Nearby Bottom Sheet Modal ── */}
      {askModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(5,5,15,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setAskModalOpen(false); setAskResult(null); } }}
        >
          <div
            className="w-full max-w-md mx-auto overflow-hidden"
            style={{
              borderRadius: '28px 28px 0 0',
              background: 'var(--f-modal-bg)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid var(--f-glass-border-2)',
              borderBottom: 'none',
              maxHeight: '90vh',
              overflowY: 'auto',
              paddingBottom: 32,
              animation: 'f-fade-up 0.3s var(--f-ease)',
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--f-text-3)' }} />
            </div>

            <div className="px-5 pt-2 pb-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="f-display" style={{ fontSize: 20, color: 'var(--f-text-1)' }}>
                  📍 Nearby Shops se Poocho
                </h2>
                <button onClick={() => { setAskModalOpen(false); setAskResult(null); }}>
                  <X size={20} color="var(--f-text-3)" />
                </button>
              </div>

              {askSending ? (
                /* Broadcasting state — RadarPulse during the REAL in-flight
                   /api/ask-nearby/send broadcast (no fake timer; shows for the
                   actual network duration, then flips to success on askResult). */
                <div className="text-center py-6" style={{ animation: 'f-fade-up 0.3s var(--f-ease)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <RadarPulse size={220} color="#EA9A00" shopCount={12} />
                  </div>
                  <h2 className="f-display" style={{ fontSize: 20, color: 'var(--f-text-1)', margin: '16px 0 4px' }}>
                    Broadcasting… <span className="f-grad-text">nearby shops</span>
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--f-text-3)' }}>
                    "{askQuery.trim()}" · {askRadius}km radius
                  </p>
                </div>
              ) : askResult ? (
                /* Success state */
                <div className="text-center py-6">
                  <div
                    style={{
                      width: 80, height: 80, borderRadius: '50%', margin: '0 auto 14px',
                      background: 'linear-gradient(135deg, #2EE7A1, #00E5FF)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 30px rgba(0,229,255,0.5), 0 0 60px rgba(46,231,161,0.4)',
                    }}
                  >
                    <Check size={36} color="white" strokeWidth={3} />
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--f-text-1)', marginTop: 4 }}>
                    {askResult.sentTo} shops ko message gaya!
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--f-text-2)', marginTop: 6, lineHeight: 1.5 }}>
                    Jo haan bolein woh Chat mein aayenge. Check karo Messages tab.
                  </p>
                  {askResult.storeNames.length > 0 && (
                    <div className="f-glass mt-4 text-left" style={{ borderRadius: 14, padding: 12 }}>
                      <p style={{ ...eyebrow, marginBottom: 6 }}>Shops notified</p>
                      {askResult.storeNames.slice(0, 5).map((n, i) => (
                        <p key={i} style={{ fontSize: 13, color: 'var(--f-text-1)', marginBottom: 2 }}>• {n}</p>
                      ))}
                      {askResult.storeNames.length > 5 && (
                        <p style={{ fontSize: 12, color: 'var(--f-text-3)' }}>+{askResult.storeNames.length - 5} more</p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => { setAskModalOpen(false); setAskResult(null); navigate('/messages'); }}
                    className="mt-5 w-full py-3 rounded-xl font-bold text-sm"
                    style={{ background: 'var(--c-action, var(--b-green))', color: '#fff', boxShadow: 'var(--b-elev-card)' }}
                  >
                    Messages mein jaao
                  </button>
                </div>
              ) : (
                <>
                  {/* Section 1: Query */}
                  <div className="mb-5">
                    <p style={{ ...eyebrow, marginBottom: 8 }}>Kya chahiye?</p>
                    <input
                      type="text"
                      value={askQuery}
                      onChange={e => setAskQuery(e.target.value)}
                      placeholder="e.g. PS5, iPhone 15, red kurta..."
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{
                        background: 'var(--f-glass-bg)',
                        color: 'var(--f-text-1)',
                        border: '1px solid var(--f-glass-border)',
                      }}
                    />
                  </div>

                  {/* Section 2: Area */}
                  <div className="mb-5">
                    <p style={{ ...eyebrow, marginBottom: 8 }}>Kahan dhundho?</p>
                    <div className="flex gap-2 mb-3">
                      {(['my', 'custom'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setAskAreaMode(mode)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                          style={
                            askAreaMode === mode
                              ? { background: 'var(--b-grad)', color: 'var(--b-on-grad)', border: 'none', boxShadow: 'var(--b-elev-2)' }
                              : { background: 'var(--f-glass-bg-2)', color: 'var(--f-text-2)', border: '1px solid var(--f-glass-border)' }
                          }
                        >
                          {mode === 'my' ? '📍 Meri location' : '🔍 Alag area'}
                        </button>
                      ))}
                    </div>
                    {askAreaMode === 'my' ? (
                      userLocCtx ? (
                        <p style={{ fontSize: 13, color: 'var(--f-text-2)' }}>
                          📍 {userLocCtx.name}
                        </p>
                      ) : (
                        <p style={{ fontSize: 13, color: 'var(--b-orange)' }}>Location detect nahi ho rahi — settings check karo</p>
                      )
                    ) : (
                      <input
                        type="text"
                        value={askCustomArea}
                        onChange={e => setAskCustomArea(e.target.value)}
                        placeholder="Area ka naam ya pincode (e.g. Kurla West, 400070)"
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{
                          background: 'var(--f-glass-bg)',
                          color: 'var(--f-text-1)',
                          border: '1px solid var(--f-glass-border)',
                        }}
                      />
                    )}
                  </div>

                  {/* Section 3: Radius slider */}
                  <div className="mb-6">
                    <p style={{ ...eyebrow, marginBottom: 8 }}>Kitne door tak?</p>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontSize: 13, color: 'var(--f-text-2)' }}>1 km</span>
                      <span className="f-mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--b-magenta-ink)' }}>{askRadius} km ke andar</span>
                      <span style={{ fontSize: 13, color: 'var(--f-text-2)' }}>20 km</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={askRadius}
                      onChange={e => setAskRadius(Number(e.target.value))}
                      className="w-full"
                      style={{ accentColor: 'var(--b-magenta-ink)' }}
                    />
                  </div>

                  {/* Send button */}
                  <button
                    onClick={handleAskSend}
                    disabled={askSending || askGeocodingArea}
                    className="w-full py-3.5 rounded-xl font-bold text-sm"
                    style={{
                      background: 'var(--c-action, var(--b-green))',
                      color: '#fff',
                      boxShadow: 'var(--b-elev-card)',
                      opacity: askSending || askGeocodingArea ? 0.7 : 1,
                    }}
                  >
                    {askGeocodingArea
                      ? 'Area dhundh rahe hain...'
                      : askSending
                      ? 'Shops dhundh rahe hain...'
                      : `📨 ${askRadius} km mein shops ko poocho`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
