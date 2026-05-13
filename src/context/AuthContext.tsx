import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { apiFetch, getToken as getNativeToken, setToken as setNativeToken, clearToken as clearNativeToken, isNative } from '../lib/api';
import { setSentryUser } from '../lib/sentry-frontend';
import { identifyUser, captureEvent } from '../lib/posthog';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isTeamMember: boolean;
  login: (user: User, token: string, isTeamMember?: boolean) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiFetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        if (data && !data.error && data.id) {
          setUser(data);
          // On native: restore the actual JWT from storage so !!token checks pass across all pages.
          // Fallback to "native" string if auth succeeded but token somehow unreadable.
          setToken(isNative() ? (getNativeToken() || "native") : "cookie");
          const wasTeamMember = localStorage.getItem('isTeamMember') === 'true';
          setIsTeamMember(wasTeamMember);
          // Restore observability identity on session revival (page reload).
          // Both helpers are graceful no-ops when their env vars are unset.
          setSentryUser({ id: data.id, role: data.role });
          identifyUser({ id: data.id, role: data.role });
        }
      })
      .catch(err => {
        if (!cancelled) console.error('[AUTH] /me failed:', err);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    return () => { cancelled = true; };
  }, []);

  const login = (newUser: User, newToken: string, teamMember: boolean = false) => {
    setUser(newUser);
    // On native, persist JWT so apiFetch attaches it as Authorization: Bearer.
    // On web, this is a no-op — the httpOnly cookie does the work.
    if (isNative() && newToken) {
      setNativeToken(newToken);
    }
    setToken(isNative() ? newToken : "cookie");
    setIsTeamMember(teamMember);
    localStorage.setItem('isTeamMember', String(teamMember));
    setAuthChecked(true);
    // Observability: attach user identity to Sentry + PostHog. Both are
    // graceful no-ops when their respective env vars are unset.
    setSentryUser({ id: newUser.id, role: newUser.role });
    identifyUser({ id: newUser.id, role: newUser.role });
    // PostHog event: user_logged_in. captureEvent is a no-op when PostHog
    // is disabled or running in dev (opt-out via initPostHog loaded hook).
    captureEvent('user_logged_in', {
      role: newUser.role,
      is_team_member: teamMember,
    });
  };

  const logout = () => {
    apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    // Clear native token (no-op on web)
    clearNativeToken();
    setUser(null);
    setToken(null);
    setIsTeamMember(false);
    localStorage.removeItem('isTeamMember');
    // Observability: clear user identity on logout (PostHog reset assigns
    // a fresh anonymous distinct_id so future events aren't attributed
    // to the now-logged-out user).
    setSentryUser(null);
    identifyUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isTeamMember, login, logout, isLoading: !authChecked }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
