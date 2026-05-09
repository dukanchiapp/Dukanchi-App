import { useState, useEffect, useRef, useMemo } from 'react';
import { Search as SearchIcon, Filter, MapPin, Store, X, SlidersHorizontal, Navigation, Clock, Mic, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useUserLocation, reverseGeocode } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';

import { CATEGORIES as ALL_CATEGORIES, matchCategory } from '../constants/categories';
import { StoreCardSkeleton } from '../components/Skeleton';
import { usePageMeta } from '../hooks/usePageMeta';

const TRENDING = ['PS5', 'iPhone 15', 'perfumes', 'earbuds'];

const CATEGORY_BG: Record<string, { bg: string; color: string }> = {
  Electronics: { bg: '#FFF1E6', color: '#7A3810' },
  Fashion:     { bg: '#E1F5EE', color: '#0F6E56' },
  Beauty:      { bg: '#FBEAF0', color: '#72243E' },
  Grocery:     { bg: '#EAF3DE', color: '#27500A' },
  Food:        { bg: '#FAEEDA', color: '#633806' },
  Home:        { bg: '#E6F1FB', color: '#0C447C' },
  Health:      { bg: '#EEEDFE', color: '#3C3489' },
  Jewellery:   { bg: '#FCEBEB', color: '#791F1F' },
};

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
        setResults({
          products: Array.isArray(data.products) ? data.products : [],
          stores: Array.isArray(data.stores) ? data.stores : [],
        });
        setCorrectedQuery(data.correctedQuery || null);
        setLoading(false);
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

  return (
    <div style={{ background: 'var(--dk-bg)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="max-w-md mx-auto">
        {/* Sticky header */}
        <div
          className="sticky top-0 z-20"
          style={{ background: 'var(--dk-bg)', borderBottom: '0.5px solid var(--dk-border)' }}
        >
          <AppHeader />
        </div>

        <main className="px-4 pt-5 pb-4">
          {/* Big heading */}
          <h1
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: 'var(--dk-text-primary)',
              marginBottom: 14,
              letterSpacing: '-0.3px',
            }}
          >
            Kya dhoondh rahe ho?
          </h1>

          {/* Search input + filter button */}
          <div className="relative" ref={suggestionsRef}>
            <div className="flex items-center gap-2 mb-0">
              <div
                className="flex items-center gap-2 flex-1"
                style={{ background: 'var(--dk-surface)', borderRadius: 14, padding: '10px 12px' }}
              >
                <SearchIcon size={18} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search products, brands, or stores..."
                  value={query}
                  onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--dk-text-primary)' }}
                />
                {query ? (
                  <button onClick={() => { setQuery(''); setSuggestions([]); setCorrectedQuery(null); }}>
                    <X size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
                  </button>
                ) : null}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 46, height: 46, borderRadius: 14,
                  background: hasFilters || showFilters ? '#1A1A1A' : 'var(--dk-surface)',
                  border: '0.5px solid var(--dk-border)',
                }}
              >
                <SlidersHorizontal size={18} color={hasFilters || showFilters ? 'white' : 'var(--dk-text-secondary)'} />
              </button>
            </div>

            {/* Autocomplete suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && query.length >= 1 && (
              <div
                className="absolute left-0 right-12 z-30 mt-1 overflow-hidden"
                style={{
                  background: 'white',
                  borderRadius: 14,
                  border: '0.5px solid var(--dk-border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
                    style={{ borderBottom: i < suggestions.length - 1 ? '0.5px solid var(--dk-border)' : 'none' }}
                    onMouseDown={(e) => { e.preventDefault(); setQuery(s); setShowSuggestions(false); }}
                  >
                    <SearchIcon size={14} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--dk-text-primary)', flex: 1 }}>
                      {s.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, j) =>
                        part.toLowerCase() === query.toLowerCase()
                          ? <strong key={j} style={{ color: 'var(--dk-accent)' }}>{part}</strong>
                          : <span key={j}>{part}</span>
                      )}
                    </span>
                    <ArrowUpRight size={12} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
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
                background: 'var(--dk-bg-warm)',
                borderRadius: 12,
                border: '0.5px solid var(--dk-border)',
              }}
            >
              <SearchIcon size={14} style={{ color: 'var(--dk-accent)' }} />
              <span style={{ fontSize: 13, color: 'var(--dk-text-secondary)' }}>
                Showing results for{' '}
                <button
                  onClick={() => setQuery(correctedQuery)}
                  style={{ fontWeight: 700, color: 'var(--dk-accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}
                >
                  {correctedQuery}
                </button>
              </span>
            </div>
          )}

          {/* Filter panel */}
          {showFilters && (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: 'white', border: '0.5px solid var(--dk-border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--dk-text-primary)' }}>Filters</p>
                {hasFilters && (
                  <button onClick={clearFilters} style={{ fontSize: 12, color: 'var(--dk-accent)', fontWeight: 600 }}>Clear all</button>
                )}
              </div>
              {/* Category */}
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--dk-text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Category</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {ALL_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(selectedCategory === cat.value ? '' : cat.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{
                      background: selectedCategory === cat.value ? 'var(--dk-accent)' : 'var(--dk-surface)',
                      color: selectedCategory === cat.value ? 'white' : 'var(--dk-text-secondary)',
                      border: '0.5px solid var(--dk-border)',
                    }}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--dk-text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sort by</p>
              <div className="flex gap-2 flex-wrap">
                {[{ key: 'relevance', label: 'Relevance' }, { key: 'name', label: 'Name A-Z' }].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSortBy(opt.key)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{
                      background: sortBy === opt.key ? '#1A1A1A' : 'var(--dk-surface)',
                      color: sortBy === opt.key ? 'white' : 'var(--dk-text-secondary)',
                      border: '0.5px solid var(--dk-border)',
                    }}
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
              <section className="mb-6">
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: 'var(--dk-text-tertiary)' }}
                >
                  Trending near you
                </p>
                <div className="flex flex-wrap gap-2">
                  {TRENDING.map((item, idx) => (
                    <button
                      key={item}
                      onClick={() => setQuery(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                      style={{
                        background: 'var(--dk-bg-warm)',
                        color: 'var(--dk-text-primary)',
                        border: '0.5px solid var(--dk-border)',
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
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: 'var(--dk-text-tertiary)' }}
                >
                  Browse by category
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {ALL_CATEGORIES.filter(c => CATEGORY_BG[c.value]).map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setQuery(cat.label)}
                      className="flex flex-col items-center justify-center gap-1 p-3 transition-opacity active:opacity-70"
                      style={{
                        background: CATEGORY_BG[cat.value].bg,
                        color: CATEGORY_BG[cat.value].color,
                        borderRadius: 14,
                      }}
                    >
                      <span style={{ fontSize: 20, lineHeight: 1 }}>{cat.emoji}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>
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
                    <p
                      className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--dk-text-tertiary)' }}
                    >
                      Recent searches
                    </p>
                    <button
                      onClick={clearAllHistory}
                      className="text-xs font-medium"
                      style={{ color: 'var(--dk-accent)' }}
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--dk-border)' }}>
                    {searchHistory.map((q, i) => (
                      <div key={i} className="flex items-center justify-between py-2.5">
                        <button
                          onClick={() => setQuery(q)}
                          className="flex items-center gap-2.5 flex-1 text-left"
                        >
                          <Clock size={15} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
                          <span style={{ fontSize: 14, color: 'var(--dk-text-primary)' }}>{q}</span>
                        </button>
                        <button
                          onClick={() => removeHistoryItem(q)}
                          className="ml-2 p-1"
                        >
                          <X size={14} style={{ color: 'var(--dk-text-tertiary)' }} />
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
              <div className="flex items-center mb-4">
                <span style={{ fontSize: 13, color: 'var(--dk-text-secondary)' }}>
                  {loading ? 'Searching...' : hasResults ? `${filteredStores.length} store${filteredStores.length !== 1 ? 's' : ''} found` : ''}
                </span>
              </div>

              {/* Loading skeletons */}
              {loading ? (
                <div style={{ paddingTop: 4 }}>
                  {[1, 2, 3, 4].map(i => <StoreCardSkeleton key={i} />)}
                </div>
              ) : hasResults ? (
                <div className="space-y-6">
                  {filteredStores.length > 0 && (
                    <div>
                      <p
                        className="text-xs font-semibold uppercase tracking-wider mb-3"
                        style={{ color: 'var(--dk-text-tertiary)' }}
                      >
                        Stores ({filteredStores.length})
                      </p>
                      <div className="space-y-3">
                        {filteredStores.map(store => {
                          const status = getStoreStatus(store.openingTime, store.closingTime, store.is24Hours, store.workingDays);
                          const distance = getDistance(store.latitude, store.longitude);
                          return (
                            <div
                              key={store.id}
                              className="bg-white overflow-hidden cursor-pointer"
                              style={{ borderRadius: 'var(--dk-radius-lg)', border: '0.5px solid var(--dk-border)' }}
                              onClick={() => navigate(`/store/${store.id}`)}
                            >
                              <div className="p-4">
                                <div className="flex items-start gap-3 mb-3">
                                  <div
                                    className="w-12 h-12 overflow-hidden flex-shrink-0 flex items-center justify-center"
                                    style={{ borderRadius: '50%', background: store.logoUrl ? 'black' : 'var(--dk-surface)', border: '0.5px solid var(--dk-border)' }}
                                  >
                                    {store.logoUrl
                                      ? <img src={store.logoUrl} alt={store.storeName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                      : <span style={{ fontSize: 22 }}>🏪</span>
                                    }
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3
                                      className="font-semibold leading-tight"
                                      style={{ fontSize: 14, color: 'var(--dk-text-primary)' }}
                                    >
                                      {store.storeName}
                                    </h3>
                                    {store.category && (
                                      <p style={{ fontSize: 12, color: 'var(--dk-text-tertiary)', marginTop: 2 }}>
                                        {store.category}
                                      </p>
                                    )}
                                    <div className="flex flex-col gap-1 mt-1">
                                      {distance && (
                                        <span className="flex items-center gap-1" style={{ fontSize: 12, color: 'var(--dk-text-secondary)' }}>
                                          <MapPin size={10} style={{ color: 'var(--dk-accent)' }} />
                                          {distance} away
                                        </span>
                                      )}
                                      {status && (
                                        <span
                                          className="flex items-center gap-1"
                                          style={{ fontSize: 12, fontWeight: 500, color: statusColor(status.color) }}
                                        >
                                          <Clock size={10} />
                                          {status.label}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className="flex gap-2 pt-3"
                                  style={{ borderTop: '0.5px solid var(--dk-border)' }}
                                >
                                  <Link
                                    to={`/store/${store.id}`}
                                    onClick={e => e.stopPropagation()}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                                    style={{ background: 'var(--dk-surface)', color: 'var(--dk-text-secondary)' }}
                                  >
                                    <Store size={13} />
                                    View Store
                                  </Link>
                                  <button
                                    onClick={e => { e.stopPropagation(); openDirections(store); }}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-colors"
                                    style={{ background: 'var(--dk-accent)', color: 'white' }}
                                  >
                                    <Navigation size={13} />
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
                      <Filter size={36} style={{ color: 'var(--dk-border-strong)', margin: '0 auto 8px' }} />
                      <p style={{ fontSize: 14, color: 'var(--dk-text-secondary)' }}>
                        No results match your filters.
                      </p>
                      <button
                        onClick={clearFilters}
                        className="mt-2 text-sm font-medium"
                        style={{ color: 'var(--dk-accent)' }}
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <SearchIcon size={44} style={{ color: 'var(--dk-border-strong)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 14, color: 'var(--dk-text-secondary)' }}>
                    No results for "{query}"
                  </p>
                </div>
              )}

              {/* Ask Nearby suggestion card — show when typing */}
              {isSearching && !loading && (
                <div
                  className="mt-4 rounded-2xl overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2a1a00 100%)', border: '0.5px solid #333' }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span style={{ fontSize: 26 }}>📍</span>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 3 }}>
                          Aur dhundho nearby?
                        </p>
                        <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>
                          Aapke area ki shops se seedha poocho — sirf wahi dikhenge jiske paas stock hai
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={openAskModal}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm"
                      style={{ background: 'var(--dk-accent)', color: 'white' }}
                    >
                      Nearby shops se poocho
                      <ChevronRight size={15} />
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
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setAskModalOpen(false); setAskResult(null); } }}
        >
          <div
            className="w-full max-w-md mx-auto rounded-t-3xl overflow-hidden"
            style={{ background: 'var(--dk-bg)', maxHeight: '90vh', overflowY: 'auto', paddingBottom: 32 }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--dk-border-strong)' }} />
            </div>

            <div className="px-5 pt-2 pb-4">
              <div className="flex items-center justify-between mb-5">
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--dk-text-primary)' }}>
                  📍 Nearby Shops se Poocho
                </h2>
                <button onClick={() => { setAskModalOpen(false); setAskResult(null); }}>
                  <X size={20} style={{ color: 'var(--dk-text-tertiary)' }} />
                </button>
              </div>

              {askResult ? (
                /* Success state */
                <div className="text-center py-6">
                  <div style={{ fontSize: 48 }}>✅</div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--dk-text-primary)', marginTop: 12 }}>
                    {askResult.sentTo} shops ko message gaya!
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--dk-text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
                    Jo haan bolein woh Chat mein aayenge. Check karo Messages tab.
                  </p>
                  {askResult.storeNames.length > 0 && (
                    <div className="mt-4 text-left rounded-xl p-3" style={{ background: 'var(--dk-surface)' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--dk-text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>
                        Shops notified
                      </p>
                      {askResult.storeNames.slice(0, 5).map((n, i) => (
                        <p key={i} style={{ fontSize: 13, color: 'var(--dk-text-primary)', marginBottom: 2 }}>• {n}</p>
                      ))}
                      {askResult.storeNames.length > 5 && (
                        <p style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>+{askResult.storeNames.length - 5} more</p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => { setAskModalOpen(false); setAskResult(null); navigate('/messages'); }}
                    className="mt-5 w-full py-3 rounded-xl font-semibold text-sm"
                    style={{ background: 'var(--dk-accent)', color: 'white' }}
                  >
                    Messages mein jaao
                  </button>
                </div>
              ) : (
                <>
                  {/* Section 1: Query */}
                  <div className="mb-5">
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--dk-text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>
                      Kya chahiye?
                    </p>
                    <input
                      type="text"
                      value={askQuery}
                      onChange={e => setAskQuery(e.target.value)}
                      placeholder="e.g. PS5, iPhone 15, red kurta..."
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{
                        background: 'var(--dk-surface)',
                        color: 'var(--dk-text-primary)',
                        border: '0.5px solid var(--dk-border)',
                      }}
                    />
                  </div>

                  {/* Section 2: Area */}
                  <div className="mb-5">
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--dk-text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>
                      Kahan dhundho?
                    </p>
                    <div className="flex gap-2 mb-3">
                      {(['my', 'custom'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setAskAreaMode(mode)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                          style={{
                            background: askAreaMode === mode ? 'var(--dk-accent)' : 'var(--dk-surface)',
                            color: askAreaMode === mode ? 'white' : 'var(--dk-text-secondary)',
                            border: '0.5px solid var(--dk-border)',
                          }}
                        >
                          {mode === 'my' ? '📍 Meri location' : '🔍 Alag area'}
                        </button>
                      ))}
                    </div>
                    {askAreaMode === 'my' ? (
                      userLocCtx ? (
                        <p style={{ fontSize: 13, color: 'var(--dk-text-secondary)' }}>
                          📍 {userLocCtx.name}
                        </p>
                      ) : (
                        <p style={{ fontSize: 13, color: '#f97316' }}>Location detect nahi ho rahi — settings check karo</p>
                      )
                    ) : (
                      <input
                        type="text"
                        value={askCustomArea}
                        onChange={e => setAskCustomArea(e.target.value)}
                        placeholder="Area ka naam ya pincode (e.g. Kurla West, 400070)"
                        className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                        style={{
                          background: 'var(--dk-surface)',
                          color: 'var(--dk-text-primary)',
                          border: '0.5px solid var(--dk-border)',
                        }}
                      />
                    )}
                  </div>

                  {/* Section 3: Radius slider */}
                  <div className="mb-6">
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--dk-text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>
                      Kitne door tak?
                    </p>
                    <div className="flex items-center justify-between mb-2">
                      <span style={{ fontSize: 13, color: 'var(--dk-text-secondary)' }}>1 km</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--dk-accent)' }}>{askRadius} km ke andar</span>
                      <span style={{ fontSize: 13, color: 'var(--dk-text-secondary)' }}>20 km</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={askRadius}
                      onChange={e => setAskRadius(Number(e.target.value))}
                      className="w-full"
                      style={{ accentColor: 'var(--dk-accent)' }}
                    />
                  </div>

                  {/* Send button */}
                  <button
                    onClick={handleAskSend}
                    disabled={askSending || askGeocodingArea}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm"
                    style={{ background: 'var(--dk-accent)', color: 'white', opacity: askSending || askGeocodingArea ? 0.7 : 1 }}
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
