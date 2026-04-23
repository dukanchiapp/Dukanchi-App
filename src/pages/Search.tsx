import { useState, useEffect } from 'react';
import { Search as SearchIcon, Filter, MapPin, Store, X, SlidersHorizontal, Navigation, Clock, Mic } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import { getStoreStatus } from '../lib/storeUtils';

const TRENDING = ['PS5', 'iPhone 15', 'perfumes', 'earbuds'];

const CATEGORIES = [
  { label: 'Electronics', emoji: '📱', bg: '#FFF1E6', color: '#7A3810' },
  { label: 'Fashion', emoji: '👕', bg: '#E1F5EE', color: '#0F6E56' },
  { label: 'Beauty', emoji: '💄', bg: '#FBEAF0', color: '#72243E' },
  { label: 'Grocery', emoji: '🛒', bg: '#EAF3DE', color: '#27500A' },
  { label: 'Food', emoji: '🍕', bg: '#FAEEDA', color: '#633806' },
  { label: 'Home', emoji: '🏠', bg: '#E6F1FB', color: '#0C447C' },
  { label: 'Health', emoji: '💊', bg: '#EEEDFE', color: '#3C3489' },
  { label: 'Jewellery', emoji: '💍', bg: '#FCEBEB', color: '#791F1F' },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ products: any[]; stores: any[] }>({
    products: [],
    stores: [],
  });
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState('relevance');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetchHistory = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.id) return;
        const res = await fetch(`/api/users/${user.id}/search-history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const unique = [...new Set(data.map((d: any) => d.query))] as string[];
          setSearchHistory(unique.slice(0, 8));
        }
      } catch {}
    };
    fetchHistory();
  }, [token]);

  const saveSearch = (q: string) => {
    if (!q.trim() || !token) return;
    fetch('/api/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      await fetch('/api/search-history', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSearchHistory([]);
    } catch {}
  };

  useEffect(() => {
    if (query.length < 2) {
      setResults({ products: [], stores: [] });
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      saveSearch(query);
      fetch(`/api/search/ai?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => (res.ok ? res.json() : { products: [], stores: [] }))
        .then(data => {
          setResults({
            products: Array.isArray(data.products) ? data.products : [],
            stores: Array.isArray(data.stores) ? data.stores : [],
          });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = results.products.length > 0 || results.stores.length > 0;

  const filteredProducts = results.products
    .filter(p => {
      if (selectedCategory && p.category?.toLowerCase() !== selectedCategory.toLowerCase())
        return false;
      if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_low') return a.price - b.price;
      if (sortBy === 'price_high') return b.price - a.price;
      if (sortBy === 'name') return a.productName.localeCompare(b.productName);
      return 0;
    });

  const filteredStores = results.stores
    .filter(s => {
      if (selectedCategory && s.category?.toLowerCase() !== selectedCategory.toLowerCase())
        return false;
      return true;
    })
    .sort((a, b) => {
      const aOpen = getStoreStatus(a.openingTime, a.closingTime, a.is24Hours, a.workingDays)?.isOpen ? 0 : 1;
      const bOpen = getStoreStatus(b.openingTime, b.closingTime, b.is24Hours, b.workingDays)?.isOpen ? 0 : 1;
      return aOpen - bOpen;
    });

  const hasFilters = selectedCategory || sortBy !== 'relevance' || priceRange[0] > 0 || priceRange[1] < 10000;
  const clearFilters = () => { setSelectedCategory(''); setPriceRange([0, 10000]); setSortBy('relevance'); };

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
          <div className="flex items-center gap-2 mb-2">
            <div
              className="flex items-center gap-2 flex-1"
              style={{ background: 'var(--dk-surface)', borderRadius: 14, padding: '10px 12px' }}
            >
              <SearchIcon size={18} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search products, brands, or stores..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--dk-text-primary)' }}
              />
              {query ? (
                <button onClick={() => setQuery('')}>
                  <X size={16} style={{ color: 'var(--dk-text-tertiary)' }} />
                </button>
              ) : (
                <button onClick={() => console.log('TODO: mic input')}>
                  <Mic size={18} style={{ color: 'var(--dk-accent)' }} />
                </button>
              )}
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
                {['Electronics', 'Fashion', 'Grocery', 'Food', 'Beauty', 'Health', 'Jewellery'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{
                      background: selectedCategory === cat ? 'var(--dk-accent)' : 'var(--dk-surface)',
                      color: selectedCategory === cat ? 'white' : 'var(--dk-text-secondary)',
                      border: '0.5px solid var(--dk-border)',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* Sort */}
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--dk-text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sort by</p>
              <div className="flex gap-2 flex-wrap">
                {[{ key: 'relevance', label: 'Relevance' }, { key: 'price_low', label: 'Price ↑' }, { key: 'price_high', label: 'Price ↓' }, { key: 'name', label: 'Name A-Z' }].map(opt => (
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
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.label}
                      onClick={() => setQuery(cat.label)}
                      className="flex flex-col items-center justify-center gap-1 p-3 transition-opacity active:opacity-70"
                      style={{
                        background: cat.bg,
                        color: cat.color,
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
              {/* Filter bar */}
              <div className="flex items-center justify-between mb-4">
                <span style={{ fontSize: 13, color: 'var(--dk-text-secondary)' }}>
                  {loading ? 'Searching...' : hasResults ? `${filteredStores.length + filteredProducts.length} results` : ''}
                </span>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold relative"
                  style={
                    showFilters || hasFilters
                      ? { background: 'var(--dk-accent)', color: 'white' }
                      : { background: 'var(--dk-surface)', color: 'var(--dk-text-secondary)' }
                  }
                >
                  <SlidersHorizontal size={13} />
                  Filters
                  {hasFilters && !showFilters && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
                  )}
                </button>
              </div>

              {/* Filter panel */}
              {showFilters && (
                <div
                  className="mb-4 p-4 rounded-xl space-y-4"
                  style={{
                    background: 'var(--dk-bg-warm)',
                    border: '0.5px solid var(--dk-border)',
                  }}
                >
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--dk-text-tertiary)' }}>
                      Category
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map(cat => (
                        <button
                          key={cat.label}
                          onClick={() => setSelectedCategory(selectedCategory === cat.label ? '' : cat.label)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                          style={
                            selectedCategory === cat.label
                              ? { background: 'var(--dk-accent)', color: 'white' }
                              : { background: 'white', color: 'var(--dk-text-secondary)', border: '0.5px solid var(--dk-border)' }
                          }
                        >
                          {cat.emoji} {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--dk-text-tertiary)' }}>
                      Price Range
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        value={priceRange[0]}
                        onChange={e => setPriceRange([Number(e.target.value), priceRange[1]])}
                        className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'white', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                        placeholder="Min"
                      />
                      <span style={{ color: 'var(--dk-text-tertiary)' }}>–</span>
                      <input
                        type="number"
                        min="0"
                        value={priceRange[1]}
                        onChange={e => setPriceRange([priceRange[0], Number(e.target.value)])}
                        className="w-24 px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'white', border: '0.5px solid var(--dk-border)', color: 'var(--dk-text-primary)' }}
                        placeholder="Max"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--dk-text-tertiary)' }}>
                      Sort by
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'relevance', label: 'Relevance' },
                        { id: 'price_low', label: 'Price ↑' },
                        { id: 'price_high', label: 'Price ↓' },
                        { id: 'name', label: 'Name A-Z' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => setSortBy(opt.id)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                          style={
                            sortBy === opt.id
                              ? { background: 'var(--dk-accent)', color: 'white' }
                              : { background: 'white', color: 'var(--dk-text-secondary)', border: '0.5px solid var(--dk-border)' }
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="text-xs font-semibold flex items-center gap-1"
                      style={{ color: 'var(--dk-danger)' }}
                    >
                      <X size={12} /> Clear filters
                    </button>
                  )}
                </div>
              )}

              {/* Loading skeletons */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="bg-white p-4 flex gap-4 animate-pulse"
                      style={{ borderRadius: 'var(--dk-radius-lg)', border: '0.5px solid var(--dk-border)' }}
                    >
                      <div
                        className="w-16 h-16 bg-gray-200 flex-shrink-0"
                        style={{ borderRadius: 'var(--dk-radius-md)' }}
                      />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-gray-200 rounded w-3/4" />
                        <div className="h-2 bg-gray-200 rounded w-1/2" />
                        <div className="h-3 bg-gray-200 rounded w-1/4 mt-3" />
                      </div>
                    </div>
                  ))}
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
                                    className="w-12 h-12 overflow-hidden flex-shrink-0"
                                    style={{ borderRadius: '50%', background: 'black' }}
                                  >
                                    <img
                                      src={store.logoUrl || '/uploads/default-logo.png'}
                                      alt={store.storeName}
                                      className="w-full h-full object-cover"
                                    />
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
                                          style={{ fontSize: 12, fontWeight: 500, color: status.isOpen ? 'var(--dk-success)' : 'var(--dk-danger)' }}
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

                  {filteredProducts.length > 0 && (
                    <div>
                      <p
                        className="text-xs font-semibold uppercase tracking-wider mb-3"
                        style={{ color: 'var(--dk-text-tertiary)' }}
                      >
                        Products ({filteredProducts.length})
                      </p>
                      <div className="space-y-3">
                        {filteredProducts.map(product => (
                          <div
                            key={product.id}
                            className="bg-white p-4 flex gap-4"
                            style={{ borderRadius: 'var(--dk-radius-lg)', border: '0.5px solid var(--dk-border)' }}
                          >
                            <div
                              className="w-20 h-20 overflow-hidden flex-shrink-0"
                              style={{ borderRadius: 'var(--dk-radius-md)', background: 'var(--dk-surface)' }}
                            >
                              <img
                                src={`https://picsum.photos/seed/${product.id}/200/200`}
                                alt={product.productName}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                                loading="lazy"
                              />
                            </div>
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <h3 className="font-semibold leading-tight" style={{ fontSize: 14, color: 'var(--dk-text-primary)' }}>
                                  {product.productName}
                                </h3>
                                {product.brand && (
                                  <p style={{ fontSize: 12, color: 'var(--dk-text-tertiary)', marginTop: 2 }}>
                                    {product.brand}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-end justify-between mt-2">
                                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--dk-accent)' }}>
                                  ₹{product.price.toLocaleString()}
                                </p>
                                <Link
                                  to={`/store/${product.storeId}`}
                                  className="flex items-center gap-1"
                                  style={{ fontSize: 11, color: 'var(--dk-text-tertiary)' }}
                                >
                                  <Store size={11} />
                                  {product.store?.storeName}
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredProducts.length === 0 && filteredStores.length === 0 && hasFilters && (
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}
