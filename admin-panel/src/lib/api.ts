import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

// With the Vite proxy, all /api calls go through localhost:5173 → localhost:3000.
// Using an empty baseURL makes requests same-origin, so SameSite=Lax cookies are sent correctly.
export const API_URL = '';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// ── Silent refresh — Day 5 / Session 92 / Phase 4 ──────────────────────────
//
// On 401, attempt POST /api/auth/refresh ONCE then retry the original
// request. Cookies (dk_admin_token + dk_admin_refresh) are sent and
// updated automatically by the browser; we never read body tokens on web
// (XSS protection invariant — admin panel runs in a browser context).
//
// Cross-origin note: the admin panel is hosted on a separate origin from
// the API in production. Backend cookies are configured with
// sameSite='none' for admin (Day 5 Phase 3 setAuthCookies helper) so they
// flow correctly cross-origin. withCredentials:true on axios sends them.

// Paths that MUST NOT trigger refresh — either ARE refresh itself
// (infinite loop) or are entry points where 401 = wrong creds, not expiry.
const REFRESH_BYPASS_PATHS = [
  '/api/auth/refresh',
  '/api/auth/login',
  '/api/auth/users',
  '/api/auth/logout',
];

interface RetryConfig extends InternalAxiosRequestConfig {
  _isRefreshRetry?: boolean;
}

function shouldAttemptRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return !REFRESH_BYPASS_PATHS.some((p) => url === p || url.startsWith(p + '?'));
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._isRefreshRetry &&
      shouldAttemptRefresh(original.url)
    ) {
      original._isRefreshRetry = true;
      try {
        // Refresh via cookie. Set-Cookie on response updates dk_admin_*
        // automatically. Body tokens IGNORED (XSS invariant on web).
        await axios.post('/api/auth/refresh', null, { withCredentials: true });
        return api(original);
      } catch {
        // Refresh failed — admin session expired or revoked. Redirect to
        // login so the operator re-authenticates.
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export const getAdminHeaders = () => {
  return {};
};

// For image URLs — use same origin in production, localhost:3000 in dev
export const imgUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = import.meta.env.PROD ? '' : 'http://localhost:3000';
  return `${base}${path}`;
};

export default api;
