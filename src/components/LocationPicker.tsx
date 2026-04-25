import { useState, useEffect, useRef } from 'react';
import { X, MapPin, LocateFixed, Search, ChevronRight } from 'lucide-react';
import { useUserLocation, reverseGeocode, UserLocation } from '../context/LocationContext';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

function getShortName(result: NominatimResult): string {
  const a = result.address || {};
  return a.neighbourhood || a.suburb || a.city_district || a.county || a.city || a.town || a.village || result.display_name.split(',')[0];
}

function getSubtitle(result: NominatimResult): string {
  const parts = result.display_name.split(', ');
  return parts.slice(1, 4).join(', ');
}

interface Props {
  onClose: () => void;
}

export default function LocationPicker({ onClose }: Props) {
  const { location, setLocation, isDetecting, detectCurrentLocation } = useUserLocation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=7`, { credentials: 'include',  headers: { 'Accept-Language': 'en' } }
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, [query]);

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    await detectCurrentLocation();
    setLocating(false);
    onClose();
  };

  const handleSelect = (result: NominatimResult) => {
    const loc: UserLocation = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      name: getShortName(result),
    };
    setLocation(loc);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto"
        style={{
          background: 'var(--dk-bg)',
          borderRadius: '20px 20px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--dk-border-strong)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--dk-text-primary)' }}>
            Choose location
          </span>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--dk-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} style={{ color: 'var(--dk-text-secondary)' }} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 pb-3">
          <div
            className="flex items-center gap-2"
            style={{ background: 'var(--dk-surface)', border: '0.5px solid var(--dk-border)', borderRadius: 14, padding: '10px 12px' }}
          >
            <Search size={16} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search city, area or locality…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--dk-text-primary)' }}
            />
            {query.length > 0 && (
              <button onClick={() => setQuery('')}>
                <X size={14} style={{ color: 'var(--dk-text-tertiary)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 16 }}>
          {/* Use current location */}
          {!query && (
            <button
              onClick={handleUseCurrentLocation}
              disabled={locating || isDetecting}
              className="w-full flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '0.5px solid var(--dk-border)' }}
            >
              <div
                style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,107,53,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <LocateFixed size={18} style={{ color: 'var(--dk-accent)' }} />
              </div>
              <div className="flex-1 text-left">
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--dk-accent)' }}>
                  {locating || isDetecting ? 'Detecting…' : 'Use my current location'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--dk-text-tertiary)' }}>
                  {locating || isDetecting ? 'Getting your location via GPS' : 'Auto-detect via GPS'}
                </p>
              </div>
            </button>
          )}

          {/* Current location info */}
          {!query && location && (
            <div className="px-4 pt-3 pb-1">
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--dk-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Current location
              </p>
              <div
                className="flex items-center gap-3 p-3 rounded-2xl"
                style={{ background: 'var(--dk-bg-soft)', border: '0.5px solid var(--dk-border)' }}
              >
                <MapPin size={16} style={{ color: 'var(--dk-accent)', flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--dk-text-primary)' }}>{location.name}</span>
              </div>
            </div>
          )}

          {/* Search results */}
          {searching && (
            <div className="px-4 py-8 text-center">
              <p style={{ fontSize: 13, color: 'var(--dk-text-tertiary)' }}>Searching…</p>
            </div>
          )}

          {!searching && results.length > 0 && (
            <div className="px-4 pt-3">
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--dk-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                Results
              </p>
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '0.5px solid var(--dk-border)' }}>
                {results.map((r, i) => (
                  <button
                    key={r.place_id}
                    onClick={() => handleSelect(r)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left"
                    style={{ background: 'white', borderBottom: i < results.length - 1 ? '0.5px solid var(--dk-border)' : 'none' }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--dk-surface)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MapPin size={14} style={{ color: 'var(--dk-text-tertiary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--dk-text-primary)' }} className="truncate">
                        {getShortName(r)}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--dk-text-tertiary)' }} className="truncate">
                        {getSubtitle(r)}
                      </p>
                    </div>
                    <ChevronRight size={14} style={{ color: 'var(--dk-text-tertiary)', flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {!searching && query.trim().length > 0 && results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p style={{ fontSize: 13, color: 'var(--dk-text-tertiary)' }}>No results for "{query}"</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
