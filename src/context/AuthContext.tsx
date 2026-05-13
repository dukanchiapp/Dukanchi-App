import { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import {
  apiFetch,
  getToken as getNativeToken,
  setTokens,
  clearTokens,
  isNative,
} from '../lib/api';
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
  /**
   * Login state setter. Day 5 / Session 92: accepts refreshToken as a
   * 4th optional positional arg so native (Capacitor) clients can persist
   * BOTH tokens to localStorage. Web ignores this — cookies carry both.
   */
  login: (user: User, accessToken: string, isTeamMember?: boolean, refreshToken?: string) => void;
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

  const login = (
    newUser: User,
    newAccessToken: string,
    teamMember: boolean = false,
    newRefreshToken?: string,
  ) => {
    setUser(newUser);
    // Day 5: native persists BOTH tokens via setTokens (writes to
    // localStorage). Web is a no-op — httpOnly cookies were set by the
    // server's Set-Cookie headers on the login response.
    if (isNative()) {
      setTokens({
        accessToken: newAccessToken,
        ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
      });
    }
    setToken(isNative() ? newAccessToken : "cookie");
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
    // Day 5: clear BOTH tokens (access + refresh) on native. No-op on web
    // (cookies cleared server-side by /logout's res.clearCookie calls).
    clearTokens();
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

  // Day 5: silent-refresh failure handler. When apiFetch's interceptor
  // can't recover from a 401 (refresh token expired/revoked/stolen), it
  // dispatches 'auth:expired'. Treat as forced logout — clears state.
  // Components observing `user` will react (redirect to /login).
  useEffect(() => {
    const handler = () => {
      // Don't POST /logout — the server has already invalidated the
      // session (that's why refresh failed). Just clear local state.
      clearTokens();
      setUser(null);
      setToken(null);
      setIsTeamMember(false);
      localStorage.removeItem('isTeamMember');
      setSentryUser(null);
      identifyUser(null);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('auth:expired', handler);
      return () => window.removeEventListener('auth:expired', handler);
    }
  }, []);

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
