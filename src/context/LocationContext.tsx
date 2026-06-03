import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
  name: string;
}

interface LocationContextType {
  location: UserLocation | null;
  setLocation: (loc: UserLocation) => void;
  isDetecting: boolean;
  detectCurrentLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType>({
  location: null,
  setLocation: () => {},
  isDetecting: false,
  detectCurrentLocation: async () => {},
});

const STORAGE_KEY = 'dk_user_location';

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (key && key !== 'YOUR_GOOGLE_MAPS_API_KEY') {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        let sublocality = '';
        let locality = '';
        const comps = data.results[0].address_components;
        for (const comp of comps) {
          if (comp.types.includes('sublocality') || comp.types.includes('neighborhood') || comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality_level_2')) {
            sublocality = sublocality || comp.short_name;
          }
          if (comp.types.includes('locality')) {
            locality = comp.long_name;
          }
        }
        if (sublocality && locality && sublocality !== locality) return `${sublocality}, ${locality}`;
        if (sublocality) return sublocality;
        if (locality) return locality;
        
        // Fallback to the first part of the formatted address
        return data.results[0].formatted_address.split(',')[0];
      }
    }
  } catch (err) {
    console.error('Google Maps reverse geocode failed', err);
  }

  // Fallback to Nominatim OSM
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address || {};
    const specific = a.residential || a.neighbourhood || a.suburb || a.road || a.city_district || a.village;
    const city = a.city || a.town || a.county;
    
    if (specific && city && specific !== city) {
      const combined = `${specific}, ${city}`;
      return combined.length > 35 ? specific : combined;
    }
    return specific || city || 'your area';
  } catch {
    return 'your area';
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<UserLocation | null>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [isDetecting, setIsDetecting] = useState(false);

  const setLocation = (loc: UserLocation) => {
    setLocationState(loc);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch { /* localStorage unavailable — non-fatal */ }
  };

  const detectCurrentLocation = async () => {
    if (!navigator.geolocation) return;
    setIsDetecting(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000 })
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      const name = await reverseGeocode(lat, lng);
      setLocation({ lat, lng, name });
    } catch {
      // permission denied or timeout — keep whatever is stored
    } finally {
      setIsDetecting(false);
    }
  };

  // Auto-detect on first load if nothing cached, or if cached name is the fallback
  // (happens when Nominatim was blocked by CORS and stored 'your area')
  useEffect(() => {
    if (!location) {
      detectCurrentLocation();
    } else if (location.name === 'your area' && location.lat !== 0) {
      // Coordinates are valid but name failed — re-geocode silently
      reverseGeocode(location.lat, location.lng).then(name => {
        if (name !== 'your area') setLocation({ ...location, name });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LocationContext.Provider value={{ location, setLocation, isDetecting, detectCurrentLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useUserLocation = () => useContext(LocationContext);
