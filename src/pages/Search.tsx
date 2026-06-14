import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStoreStatus, statusColor } from '../lib/storeUtils';
import { useUserLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../lib/api';
import { captureEvent } from '../lib/posthog';
import { Sentry } from '../lib/sentry-frontend';
import { useCategories } from '../hooks/useCategories';
import { PageMeta } from '../components/PageMeta';
import { Search, X, SlidersHorizontal, ArrowRight, Clock, Store, Navigation, ChevronRight, Check, MapPin } from 'lucide-react';
import { RadarPulse } from '../components/futuristic/RadarPulse';
import { useJsApiLoader } from '@react-google-maps/api';

export default function SearchPage() {
  const { token } = useAuth();
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
  const [searchRadius, setSearchRadius] = useState(5); // 0 = all, 1-20 km
  const [searchAreaMode, setSearchAreaMode] = useState<'my' | 'all'>('my');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [correctedQuery, setCorrectedQuery] = useState<string | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ask Nearby modal state
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [askQuery, setAskQuery] = useState('');
  const [askImages, setAskImages] = useState<File[]>([]);
  const [askAreaMode, setAskAreaMode] = useState<'my' | 'custom'>('my');
  const [askCustomArea, setAskCustomArea] = useState('');
  const [askRadius, setAskRadius] = useState(5);
  const [askSending, setAskSending] = useState(false);
  const [askResult, setAskResult] = useState<{ sentTo: number; storeNames: string[] } | null>(null);
  const [askGeocodingArea, setAskGeocodingArea] = useState(false);
  const [askAreaPredictions, setAskAreaPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [askAreaSelectedPlaceId, setAskAreaSelectedPlaceId] = useState<string | null>(null);
  const [askQuerySuggestions, setAskQuerySuggestions] = useState<string[]>([]);
  const [showAskQuerySuggestions, setShowAskQuerySuggestions] = useState(false);

  // Ask Limit state
  const [askLimitStatus, setAskLimitStatus] = useState<{count: number; max: number; resetAt: number; remainingMs: number} | null>(null);
  const [askCountdown, setAskCountdown] = useState(0);

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/ask-nearby/limit-status')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setAskLimitStatus(data);
          setAskCountdown(data.remainingMs);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!askLimitStatus || askLimitStatus.count < askLimitStatus.max) return;
    if (askCountdown <= 0) return;
    const t = setInterval(() => {
      setAskCountdown(prev => {
        if (prev <= 1000) {
          clearInterval(t);
          setAskLimitStatus(s => s ? { ...s, count: 0 } : null);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [askLimitStatus, askCountdown]);

  const formatCountdown = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [libraries] = useState<("places" | "drawing" | "geometry" | "visualization")[]>(['places']);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: mapsKey,
    id: 'google-map-script',
    libraries,
  });

  const autocompleteService = useMemo(() => {
    if (isLoaded && window.google) return new window.google.maps.places.AutocompleteService();
    return null;
  }, [isLoaded]);

  const geocoder = useMemo(() => {
    if (isLoaded && window.google) return new window.google.maps.Geocoder();
    return null;
  }, [isLoaded]);

  useEffect(() => {
    if (!askCustomArea.trim() || askAreaSelectedPlaceId) {
      setAskAreaPredictions([]);
      return;
    }
    if (!autocompleteService) return;
    const t = setTimeout(() => {
      autocompleteService.getPlacePredictions({ input: askCustomArea, componentRestrictions: { country: 'in' }, types: ['(regions)'] }, (preds, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && preds) {
          setAskAreaPredictions(preds);
        } else {
          setAskAreaPredictions([]);
        }
      });
    }, 400);
    return () => clearTimeout(t);
  }, [askCustomArea, autocompleteService, askAreaSelectedPlaceId]);

  useEffect(() => {
    if (askQuery.trim().length < 2) {
      setAskQuerySuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      apiFetch(`/api/search/suggestions?q=${encodeURIComponent(askQuery.trim())}`)
        .then(res => res.ok ? res.json() : { suggestions: [] })
        .then(data => {
          setAskQuerySuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setShowAskQuerySuggestions(true);
        })
        .catch(() => setAskQuerySuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [askQuery]);

  const navigate = useNavigate();
  const { location: userLocCtx } = useUserLocation();
  const { showToast } = useToast();
  const userLocation = userLocCtx ? { lat: userLocCtx.lat, lng: userLocCtx.lng } : null;
  const { categories: dynamicCategories } = useCategories();

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
      .filter(s => {
        const matchesCat = !selectedCategory || (
          s.category?.toLowerCase() === selectedCategory.toLowerCase() ||
          (dynamicCategories.find(c => c.value === selectedCategory)?.aliases?.some(alias => s.category?.toLowerCase().includes(alias)))
        );
        return matchesCat;
      })
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
    if (askLimitStatus && askLimitStatus.count >= askLimitStatus.max && askCountdown > 0) {
      showToast(`Limit reached. Please wait ${formatCountdown(askCountdown)}`);
      return;
    }
    setAskQuery(query || '');
    setAskImages([]);
    setAskAreaMode('my');
    setAskCustomArea('');
    setAskAreaSelectedPlaceId(null);
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
      if (!askCustomArea.trim() || !askAreaSelectedPlaceId) { showToast('Area ka naam likho aur select karo'); return; }
      if (!geocoder) { showToast('Maps API not loaded yet'); return; }
      setAskGeocodingArea(true);
      try {
        const res = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
          geocoder.geocode({ placeId: askAreaSelectedPlaceId }, (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results) resolve(results);
            else reject(new Error('Geocode failed: ' + status));
          });
        });
        
        if (!res || !res[0]) {
          showToast('Area nahi mila, dobara try karo');
          setAskGeocodingArea(false);
          return;
        }
        lat = res[0].geometry.location.lat();
        lng = res[0].geometry.location.lng();
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
      let uploadedImageUrls: string[] = [];
      if (askImages.length > 0) {
        const uploadPromises = askImages.map(async (file) => {
          const formData = new FormData();
          formData.append('image', file);
          const res = await apiFetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) throw new Error('Upload failed');
          const data = await res.json();
          return data.url;
        });
        uploadedImageUrls = await Promise.all(uploadPromises);
      }

      const res = await apiFetch('/api/ask-nearby/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: askQuery.trim(), radiusKm: askRadius, latitude: lat, longitude: lng, areaLabel, images: uploadedImageUrls }),
      });
      const data = await res.json();
      if (!res.ok) { 
        if (res.status === 429 && data.resetAt) {
          showToast(data.error || 'Limit exceed ho gayi');
          setAskLimitStatus({ count: 10, max: 10, resetAt: data.resetAt, remainingMs: data.remainingMs });
          setAskCountdown(data.remainingMs);
        } else {
          showToast(data.error || 'Kuch problem aayi, dobara try karo'); 
        }
        return; 
      }
      if (data.found === 0) { showToast(data.message || 'Koi matching store nahi mila'); return; }
      setAskResult({ sentTo: data.sentTo, storeNames: data.storeNames });
      setAskLimitStatus(prev => prev ? { ...prev, count: prev.count + 1 } : null);
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
    <>
    <PageMeta
      title="Search Local Stores"
      description="Find shops, products, and services near you. Smart search across local retailers in your area."
      canonical="https://dukanchi.com/search"
    />
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
              <div className="mb-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-3 rounded-xl outline-none text-sm font-medium"
                  style={{
                    background: 'var(--f-bg-elev)',
                    border: '1px solid var(--f-glass-border)',
                    color: 'var(--f-text-1)',
                  }}
                >
                  <option value="">All Categories</option>
                  {dynamicCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.fullLabel}</option>
                  ))}
                </select>
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
              {/* Session 128.17: "Aur dhundho nearby?" (bulk Ask-Nearby) tile
                  promoted into discovery state, ABOVE Browse by category. */}
              <section className="mb-6" style={{ marginTop: 16 }}>
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
                      disabled={askLimitStatus ? askLimitStatus.count >= askLimitStatus.max && askCountdown > 0 : false}
                      className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                      style={{ background: 'var(--c-action, var(--b-green))', color: '#fff', border: 'none' }}
                    >
                      {askLimitStatus && askLimitStatus.count >= askLimitStatus.max && askCountdown > 0 
                        ? `Wait ${formatCountdown(askCountdown)}...`
                        : 'Nearby shops se poocho'}
                      {!(askLimitStatus && askLimitStatus.count >= askLimitStatus.max && askCountdown > 0) && <ChevronRight size={15} color="#fff" />}
                    </button>
                  </div>
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
                  {dynamicCategories.slice(0, 12).map(cat => (
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

            <div className="px-6 pt-4 pb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--f-text-1)', letterSpacing: '-0.03em' }}>
                  ✨ Ask Nearby Shops
                </h2>
                <button onClick={() => { setAskModalOpen(false); setAskResult(null); }} style={{ background: 'var(--f-glass-bg-2)', padding: 8, borderRadius: '50%', border: 'none', cursor: 'pointer' }}>
                  <X size={18} color="var(--f-text-2)" />
                </button>
              </div>

              {askSending ? (
                /* Broadcasting state */
                <div className="text-center py-8" style={{ animation: 'f-fade-up 0.3s var(--f-ease)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <RadarPulse size={220} color="#EA9A00" shopCount={12} />
                  </div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--f-text-1)', margin: '24px 0 8px', letterSpacing: '-0.03em' }}>
                    Broadcasting…
                  </h2>
                  <p style={{ fontSize: 14, color: 'var(--f-text-2)', fontWeight: 500 }}>
                    Asking shops in {askRadius}km radius
                  </p>
                </div>
              ) : askResult ? (
                /* Success state */
                <div className="text-center py-8">
                  <div
                    style={{
                      width: 88, height: 88, borderRadius: '50%', margin: '0 auto 20px',
                      background: 'linear-gradient(135deg, #10B981, #34D399)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 12px 32px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    <Check size={40} color="white" strokeWidth={3.5} />
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--f-text-1)', marginTop: 4, letterSpacing: '-0.02em' }}>
                    {askResult.sentTo} shops notified!
                  </p>
                  <p style={{ fontSize: 14, color: 'var(--f-text-2)', marginTop: 8, lineHeight: 1.5, padding: '0 16px' }}>
                    Store owners who have this item will reply to you directly in your Chats.
                  </p>
                  {askResult.storeNames.length > 0 && (
                    <div className="mt-6 text-left" style={{ background: 'var(--f-glass-bg-2)', borderRadius: 20, padding: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--f-text-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Pinged Stores</p>
                      {askResult.storeNames.slice(0, 4).map((n, i) => (
                        <p key={i} style={{ fontSize: 14, fontWeight: 600, color: 'var(--f-text-1)', marginBottom: 4 }}>• {n}</p>
                      ))}
                      {askResult.storeNames.length > 4 && (
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--f-text-3)', marginTop: 4 }}>+ {askResult.storeNames.length - 4} more stores</p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => { setAskModalOpen(false); setAskResult(null); navigate('/messages'); }}
                    className="mt-8 w-full"
                    style={{ 
                      padding: '18px 0', borderRadius: 20, fontSize: 16, fontWeight: 800, 
                      background: 'var(--b-ink)', color: '#fff', border: 'none', cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                    }}
                  >
                    Go to Messages
                  </button>
                </div>
              ) : (
                  <>
                    {/* Section 1: Query */}
                    <div className="mb-6 relative z-30">
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', marginBottom: 10 }}>
                        What are you looking for?
                      </label>
                      <div style={{ position: 'relative' }}>
                        <textarea
                          placeholder="e.g. Paracetamol 500mg ya Ashirvad Atta 5kg"
                          value={askQuery}
                          onChange={(e) => { setAskQuery(e.target.value); setShowAskQuerySuggestions(true); }}
                          maxLength={60}
                          rows={4}
                          className="w-full p-4 rounded-2xl mb-2"
                          style={{
                            background: '#F9FAFB',
                            color: 'var(--f-text-1)',
                            border: '1px solid #D1D5DB',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                            fontSize: 16,
                            fontWeight: 600,
                            resize: 'none',
                            paddingBottom: 54, // room for image button
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--b-green)'}
                          onBlur={(e) => e.target.style.borderColor = '#D1D5DB'}
                        />
                        
                        {/* Session 128: 3 Image Upload Support */}
                        <div style={{ position: 'absolute', bottom: 20, left: 16, right: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                          <label style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10,
                            background: '#fff', border: '1px solid #D1D5DB', cursor: 'pointer', color: 'var(--b-ink)',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.05)', transition: 'all 0.2s'
                          }}>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                if (e.target.files) {
                                  const newFiles = Array.from(e.target.files);
                                  setAskImages(prev => [...prev, ...newFiles].slice(0, 3));
                                }
                              }}
                            />
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                          </label>
                          {askImages.map((file, idx) => (
                            <div key={idx} style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, overflow: 'hidden', border: '1px solid #D1D5DB' }}>
                              <img src={URL.createObjectURL(file)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <button
                                onClick={() => setAskImages(prev => prev.filter((_, i) => i !== idx))}
                                style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', borderRadius: '50%', padding: 3, border: 'none', cursor: 'pointer' }}
                              >
                                <X size={12} color="#fff" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {showAskQuerySuggestions && askQuerySuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-20" style={{ background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}>
                            {askQuerySuggestions.map((sug, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setAskQuery(sug);
                                  setShowAskQuerySuggestions(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50"
                                style={{ borderBottom: i < askQuerySuggestions.length - 1 ? '1px solid #F3F4F6' : 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}
                              >
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Search size={16} color="var(--f-text-2)" />
                                </div>
                                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--f-text-1)' }}>{sug}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Section 2: Area */}
                    <div className="mb-6 relative z-20">
                      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', marginBottom: 10 }}>
                        Where to search?
                      </label>
                      <div style={{ display: 'flex', background: '#F3F4F6', borderRadius: 16, padding: 4, border: '1px solid #E5E7EB' }}>
                        {(['my', 'custom'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setAskAreaMode(mode)}
                            style={{
                              flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                              background: askAreaMode === mode ? '#fff' : 'transparent',
                              color: askAreaMode === mode ? 'var(--b-ink)' : '#6B7280',
                              boxShadow: askAreaMode === mode ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                              transition: 'all 0.2s'
                            }}
                          >
                            {mode === 'my' ? '📍 My Location' : '🔍 Custom Area'}
                          </button>
                        ))}
                      </div>
                      
                      {askAreaMode === 'my' ? (
                        userLocCtx ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '16px', background: '#ECFDF5', borderRadius: 16, border: '1px solid #6EE7B7' }}>
                            <span style={{ fontSize: 20 }}>📍</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#047857' }}>{userLocCtx.name}</span>
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: 'var(--b-orange)', marginTop: 12, fontWeight: 600 }}>Please enable location access in settings.</p>
                      )
                    ) : (
                      <div className="relative" style={{ marginTop: 12 }}>
                        <MapPin size={18} color="var(--f-text-3)" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                          type="text"
                          value={askCustomArea}
                          onChange={e => {
                            setAskCustomArea(e.target.value);
                            setAskAreaSelectedPlaceId(null);
                          }}
                          placeholder="Enter area (e.g. Bandra West)"
                          className="w-full"
                          style={{
                            padding: '16px 16px 16px 44px',
                            borderRadius: 16,
                            fontSize: 15,
                            fontWeight: 600,
                            background: 'var(--f-glass-bg-2)',
                            color: 'var(--f-text-1)',
                            border: '2px solid transparent',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                          }}
                          onFocus={(e) => e.target.style.borderColor = 'var(--b-magenta-ink)'}
                          onBlur={(e) => e.target.style.borderColor = 'transparent'}
                        />
                        {askAreaPredictions.length > 0 && (
                          <div className="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-20" style={{ background: '#fff', border: '1px solid var(--f-glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.16)' }}>
                            {askAreaPredictions.map((pred, i) => (
                              <button
                                key={pred.place_id}
                                onClick={() => {
                                  setAskCustomArea(pred.description);
                                  setAskAreaSelectedPlaceId(pred.place_id);
                                  setAskAreaPredictions([]);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                                style={{ borderBottom: i < askAreaPredictions.length - 1 ? '1px solid var(--f-glass-border)' : 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}
                              >
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--f-glass-bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <MapPin size={16} color="var(--b-magenta-ink)" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate" style={{ fontSize: 15, fontWeight: 800, color: 'var(--f-text-1)' }}>{pred.structured_formatting?.main_text || pred.description}</p>
                                  <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--f-text-3)' }}>{pred.structured_formatting?.secondary_text || ''}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section 3: Radius slider */}
                  <div className="mb-8">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-2)' }}>
                        Search Radius
                      </label>
                      <div style={{ background: 'var(--b-tint)', color: 'var(--b-magenta-ink)', padding: '6px 14px', borderRadius: 20, fontSize: 15, fontWeight: 800 }}>
                        {askRadius} km
                      </div>
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
                    className="w-full"
                    style={{
                      padding: '18px 0',
                      borderRadius: 20,
                      fontSize: 16,
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
                      opacity: askSending || askGeocodingArea ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'transform 0.1s',
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {askGeocodingArea
                      ? 'Finding Area...'
                      : askSending
                      ? 'Locating Shops...'
                      : <>📨 Send Request to Nearby Shops</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
