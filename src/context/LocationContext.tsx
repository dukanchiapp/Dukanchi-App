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
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`, { credentials: 'include',  headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address || {};
    return a.neighbourhood || a.suburb || a.city_district || a.county || a.city || a.town || a.village || 'your area';
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch {}
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

  // Auto-detect on first load if nothing is cached
  useEffect(() => {
    if (!location) {
      detectCurrentLocation();
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
