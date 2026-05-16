import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useUserLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { captureEvent } from '../lib/posthog';
import { CATEGORIES as ALL_CATEGORIES, matchCategory } from '../constants/categories';
import { usePageMeta } from '../hooks/usePageMeta';
import { FIcon } from '../components/futuristic/FIcon';
import { FLogo } from '../components/futuristic/FLogo';

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
      .catch(() => {});
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

  const filteredStores = useMemo(() => results.stores
    .filter(s => matchCategory(s.category, selectedCategory))
    .sort((a, b) => {
      const aOpen = getStoreStatus(a.openingTime, a.closingTime, a.is24Hours, a.workingDays)?.isOpen ? 0 : 1;
      const bOpen = getStoreStatus(b.openingTime, b.closingTime, b.is24Hours, b.workingDays)?.isOpen ? 0 : 1;
      return aOpen - bOpen;
    }),
    [results.stores, selectedCategory]
  );

  const hasFilters = selectedCategory || sortBy !== 'relevance';
  const clearFilters = () => { setSelectedCategory(''); setSortBy('relevance'); };

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
      } catch {
        showToast('Area nahi mila, dobara try karo');
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
    } catch {
      showToast('Network error, dobara try karo');
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
        {/* Sticky header */}
        <div
          className="sticky top-0 z-20"
          style={{
            background: 'var(--f-sticky-bg)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid var(--f-glass-border)',
          }}
        >
          <div
            style={{
              padding: '14px 16px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FLogo size={36} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: 'var(--f-text-1)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                  }}
                >
                  Dukanchi
                </span>
                <span style={{ fontSize: 10, color: 'var(--f-text-3)', lineHeight: 1.15 }}>
                  apna bazaar, apni dukaan
                </span>
              </div>
            </div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                background: 'var(--f-glass-bg-2)',
                border: '1px solid var(--f-glass-border)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FIcon name="bell" size={18} color="var(--f-text-1)" />
            </div>
          </div>
        </div>

        <main className="px-4 pt-5 pb-4">
          {/* Big heading */}
          <h1
            className="f-display"
            style={{
              fontSize: 22,
              color: 'var(--f-text-1)',
              marginBottom: 14,
            }}
          >
            Kya dhoondh rahe ho?
          </h1>

          {/* Search input + filter button */}
          <div className="relative" ref={suggestionsRef}>
            <div className="flex items-center gap-2 mb-0">
              <div
                className="flex items-center gap-2 flex-1"
                style={{
                  background: 'var(--f-glass-bg)',
                  border: '1px solid var(--f-glass-border)',
                  borderRadius: 14,
                  padding: '11px 14px',
                }}
              >
                <FIcon name="search" size={16} color="var(--f-text-3)" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search products, brands, or stores..."
                  value={query}
                  onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--f-text-1)' }}
                />
                {query ? (
                  <button onClick={() => { setQuery(''); setSuggestions([]); setCorrectedQuery(null); }}>
                    <FIcon name="x" size={15} color="var(--f-text-3)" />
                  </button>
                ) : null}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 46, height: 46, borderRadius: 14,
                  background: hasFilters || showFilters
                    ? 'linear-gradient(135deg, #FF6B35, #FF2A8C)'
                    : 'var(--f-glass-bg-2)',
                  border: '1px solid ' + (hasFilters || showFilters ? 'rgba(255,42,140,0.45)' : 'var(--f-glass-border-2)'),
                }}
              >
                <FIcon name="sliders" size={18} color={hasFilters || showFilters ? 'white' : 'var(--f-text-1)'} />
              </button>
            </div>

            {/* Autocomplete suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && query.length >= 1 && (
              <div
                className="absolute left-0 right-12 z-30 mt-1 overflow-hidden"
                style={{
                  background: 'var(--f-modal-bg)',
                  borderRadius: 14,
                  border: '1px solid var(--f-glass-border-2)',
                  backdropFilter: 'blur(28px)',
                  WebkitBackdropFilter: 'blur(28px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
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
                    <FIcon name="search" size={14} color="var(--f-text-3)" />
                    <span style={{ fontSize: 13, color: 'var(--f-text-1)', flex: 1 }}>
                      {s.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, j) =>
                        part.toLowerCase() === query.toLowerCase()
                          ? <strong key={j} style={{ color: '#FF6BB4' }}>{part}</strong>
                          : <span key={j}>{part}</span>
                      )}
                    </span>
                    <FIcon name="arrowR" size={12} color="var(--f-text-3)" />
                  </button>
                ))}
              </div>
            )}
          </div>

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
              <FIcon name="search" size={14} color="#FF6BB4" />
              <span style={{ fontSize: 13, color: 'var(--f-text-2)' }}>
                Showing results for{' '}
                <button
                  onClick={() => setQuery(correctedQuery)}
                  style={{ fontWeight: 700, color: '#FF6BB4', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}
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
                  <button onClick={clearFilters} style={{ fontSize: 12, color: '#FF6BB4', fontWeight: 700 }}>Clear all</button>
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
                        ? { background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)', color: 'white', border: 'none', boxShadow: '0 0 12px rgba(255,42,140,0.4)' }
                        : { background: 'var(--f-glass-bg-2)', color: 'var(--f-text-2)', border: '1px solid var(--f-glass-border)' }
                    }
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
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
                        ? { background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)', color: 'white', border: 'none', boxShadow: '0 0 12px rgba(255,42,140,0.4)' }
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
              {/* Trending near you */}
              <section className="mb-6" style={{ marginTop: 16 }}>
                <p style={{ ...eyebrow, marginBottom: 12 }}>Trending near you</p>
                <div className="flex flex-wrap gap-2">
                  {TRENDING.map((item, idx) => (
                    <button
                      key={item}
                      onClick={() => setQuery(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{
                        background: 'var(--f-bg-elev)',
                        color: 'var(--f-text-1)',
                        border: '1px solid var(--f-glass-border)',
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
                <div className="grid grid-cols-4 gap-2.5">
                  {ALL_CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setQuery(cat.label)}
                      className="flex flex-col items-center justify-center gap-1.5 active:opacity-70"
                      style={{
                        background: 'var(--f-bg-elev)',
                        border: '1px solid var(--f-glass-border)',
                        borderRadius: 16,
                        padding: '14px 6px 12px',
                      }}
                    >
                      <span style={{ fontSize: 22, lineHeight: 1 }}>{cat.emoji}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--f-text-1)', lineHeight: 1.2, textAlign: 'center' }}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Recent searches */}
              {searchHistory.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <p style={eyebrow}>Recent searches</p>
                    <button onClick={clearAllHistory} className="text-xs font-semibold" style={{ color: '#FF6BB4' }}>
                      Clear all
                    </button>
                  </div>
                  <div>
                    {searchHistory.map((q, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-2.5"
                        style={{ borderBottom: i < searchHistory.length - 1 ? '1px solid var(--f-glass-border)' : 'none' }}
                      >
                        <button
                          onClick={() => setQuery(q)}
                          className="flex items-center gap-2.5 flex-1 text-left"
                        >
                          <FIcon name="clock" size={15} color="var(--f-text-3)" />
                          <span style={{ fontSize: 14, color: 'var(--f-text-1)' }}>{q}</span>
                        </button>
                        <button onClick={() => removeHistoryItem(q)} className="ml-2 p-1">
                          <FIcon name="x" size={14} color="var(--f-text-3)" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
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
                                      border: '2px solid #FF2A8C',
                                      boxShadow: '0 0 14px rgba(255,42,140,0.35)',
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
                                          <FIcon name="mapPin" size={10} color="#FF6BB4" />
                                          {distance} away
                                        </span>
                                      )}
                                      {status && (
                                        <span
                                          className="flex items-center gap-1"
                                          style={{ fontSize: 12, fontWeight: 600, color: statusColor(status.color) }}
                                        >
                                          <FIcon name="clock" size={10} color={statusColor(status.color)} />
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
                                    <FIcon name="storeIc" size={13} color="var(--f-text-1)" />
                                    View Store
                                  </Link>
                                  <button
                                    onClick={e => { e.stopPropagation(); openDirections(store); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
                                    style={{ background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)', color: 'white', boxShadow: '0 0 14px rgba(255,42,140,0.4)' }}
                                  >
                                    <FIcon name="navigation" size={13} color="white" />
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
                        <FIcon name="sliders" size={36} color="var(--f-text-4)" />
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--f-text-2)' }}>
                        No results match your filters.
                      </p>
                      <button onClick={clearFilters} className="mt-2 text-sm font-semibold" style={{ color: '#FF6BB4' }}>
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <FIcon name="search" size={44} color="var(--f-text-4)" />
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
                    border: '1px solid rgba(255,42,140,0.30)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    boxShadow: '0 0 32px rgba(255,42,140,0.20), inset 0 1px 0 rgba(255,255,255,0.12)',
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span style={{ fontSize: 26, filter: 'drop-shadow(0 0 12px rgba(255,42,140,0.7))' }}>📍</span>
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
                        background: 'linear-gradient(135deg, #FF6B35 0%, #FF2A8C 100%)',
                        color: 'white',
                        boxShadow: '0 0 24px rgba(255,42,140,0.45), inset 0 1px 0 rgba(255,255,255,0.25)',
                      }}
                    >
                      Nearby shops se poocho
                      <FIcon name="chevR" size={15} color="white" />
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
                  <FIcon name="x" size={20} color="var(--f-text-3)" />
                </button>
              </div>

              {askResult ? (
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
                    <FIcon name="check" size={36} color="white" stroke={3} />
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
                    style={{ background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)', color: 'white', boxShadow: '0 0 20px rgba(255,42,140,0.4)' }}
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
                              ? { background: 'linear-gradient(135deg, #FF6B35, #FF2A8C)', color: 'white', border: 'none', boxShadow: '0 0 12px rgba(255,42,140,0.4)' }
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
                        <p style={{ fontSize: 13, color: '#FFA94D' }}>Location detect nahi ho rahi — settings check karo</p>
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
                      <span className="f-mono" style={{ fontSize: 15, fontWeight: 700, color: '#FF2A8C' }}>{askRadius} km ke andar</span>
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
                      style={{ accentColor: '#FF2A8C' }}
                    />
                  </div>

                  {/* Send button */}
                  <button
                    onClick={handleAskSend}
                    disabled={askSending || askGeocodingArea}
                    className="w-full py-3.5 rounded-xl font-bold text-sm"
                    style={{
                      background: 'linear-gradient(135deg, #FF6B35 0%, #FF2A8C 100%)',
                      color: 'white',
                      boxShadow: '0 0 24px rgba(255,42,140,0.45)',
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
