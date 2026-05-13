// Single source of truth for API base URL + Capacitor-aware auth.
//
// Web (PWA): relative paths + httpOnly cookies for both access AND refresh.
//   - dk_token   (15-min access, path=/)
//   - dk_refresh (30-day refresh, path=/api/auth)
//   Web NEVER reads tokens from response bodies — XSS protection relies on
//   cookies being unreadable from JS.
//
// Native (Capacitor iOS/Android): absolute URL + Bearer access header +
// X-Refresh-Token header for /api/auth/refresh. Tokens persisted in
// localStorage because Capacitor WebView cookie handling is unreliable.
//
// IMPORTANT: No @capacitor/* imports here — uses window.Capacitor global.
// When Capacitor preferences API migration lands, swap localStorage for
// @capacitor/preferences in this file only.

export const API_BASE = import.meta.env.VITE_API_URL || '';

// localStorage keys (native only — web uses httpOnly cookies)
const ACCESS_KEY = 'dk_token';
const REFRESH_KEY = 'dk_refresh';

/** Returns true if running inside Capacitor native app (iOS/Android). */
export function isNative(): boolean {
  return typeof window !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true;
}

// ── Access token storage (native-only) ──────────────────────────────────────

/** Get access token. Native only — web uses cookies. */
export function getToken(): string | null {
  if (!isNative()) return null;
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

/** Save access token. Native only. No-op on web. */
export function setToken(token: string): void {
  if (!isNative()) return;
  try {
    localStorage.setItem(ACCESS_KEY, token);
  } catch (e) {
    console.error('[api] setToken failed', e);
  }
}

/** Clear access token. Native only. No-op on web. */
export function clearToken(): void {
  if (!isNative()) return;
  try {
    localStorage.removeItem(ACCESS_KEY);
  } catch (e) {
    console.error('[api] clearToken failed', e);
  }
}

// ── Refresh token storage (native-only — Day 5 / Session 92) ────────────────

/** Get refresh token. Native only — web uses httpOnly cookie. */
export function getRefreshToken(): string | null {
  if (!isNative()) return null;
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

/** Save refresh token. Native only. No-op on web. */
export function setRefreshToken(token: string): void {
  if (!isNative()) return;
  try {
    localStorage.setItem(REFRESH_KEY, token);
  } catch (e) {
    console.error('[api] setRefreshToken failed', e);
  }
}

/** Clear refresh token. Native only. No-op on web. */
export function clearRefreshToken(): void {
  if (!isNative()) return;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch (e) {
    console.error('[api] clearRefreshToken failed', e);
  }
}

/**
 * Set both tokens at once after a successful login or refresh.
 *
 * CRITICAL WEB SECURITY INVARIANT (Day 5 spec):
 * On web, this is a NO-OP. Web frontend MUST NEVER read accessToken or
 * refreshToken from response bodies — the httpOnly cookies set by the
 * server's Set-Cookie headers are the sole source of truth. Reading body
 * tokens on web would defeat the XSS protection of httpOnly entirely.
 *
 * On native, persists both into localStorage so apiFetch can attach them
 * to subsequent requests (cookies are unreliable in Capacitor WebView).
 */
export function setTokens(args: { accessToken?: string; refreshToken?: string }): void {
  if (!isNative()) {
    // Web: cookies were just set by Set-Cookie. DO NOT read body tokens.
    return;
  }
  if (args.accessToken) setToken(args.accessToken);
  if (args.refreshToken) setRefreshToken(args.refreshToken);
}

/** Clear both tokens (logout). */
export function clearTokens(): void {
  clearToken();
  clearRefreshToken();
}

// ── Socket.IO helpers (unchanged from Day 2.5) ──────────────────────────────

const SOCKET_RECONNECT_OPTS = {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,       // 1s before first retry
  reconnectionDelayMax: 5000,    // cap at 5s between retries
  timeout: 20000,                // 20s before giving up on initial handshake
};

/**
 * Get Socket.IO connection options for both web and native.
 * Web: withCredentials uses the httpOnly cookie.
 * Native: passes JWT in the `auth` payload (server reads socket.handshake.auth.token).
 */
export function getSocketAuthOptions() {
  if (isNative()) {
    const token = getToken();
    return {
      auth: token ? { token } : undefined,
      withCredentials: false,
      transports: ['websocket'] as string[],
      ...SOCKET_RECONNECT_OPTS,
    };
  }
  return {
    withCredentials: true,
    transports: ['websocket'] as string[],
    ...SOCKET_RECONNECT_OPTS,
  };
}

/**
 * Get the Socket.IO server URL.
 * Web: same origin (relative '/').
 * Native: absolute API_BASE so the WebView can reach the server.
 */
export function getSocketUrl(): string {
  return isNative() ? API_BASE : '/';
}

// ── Silent refresh — Day 5 / Session 92 / Phase 4 ───────────────────────────

/**
 * Paths that MUST NOT trigger silent-refresh on 401. These either ARE the
 * refresh flow itself (infinite loop) or are the entry points where 401 is
 * a normal "wrong credentials" response, not an expired-token signal.
 */
const REFRESH_BYPASS_PATHS = [
  '/api/auth/refresh',
  '/api/auth/login',
  '/api/auth/users', // signup
  '/api/auth/logout',
];

function shouldAttemptRefresh(path: string): boolean {
  return !REFRESH_BYPASS_PATHS.some((p) => path === p || path.startsWith(p + '?'));
}

/**
 * Attempt to refresh the access token. Returns true on success, false on
 * any failure (caller should treat false as "user must log in again").
 *
 * Web: POSTs to /api/auth/refresh with `credentials: 'include'` so the
 *      dk_refresh cookie is sent. Response Set-Cookie updates the cookie
 *      automatically. Body tokens IGNORED (XSS protection invariant).
 *
 * Native: reads refresh token from localStorage, sends as X-Refresh-Token
 *         header. Reads new tokens from response body and persists to
 *         localStorage via setTokens.
 */
async function attemptRefresh(): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    let body: string | undefined;

    if (isNative()) {
      const rt = getRefreshToken();
      if (!rt) return false;
      headers['X-Refresh-Token'] = rt;
    }

    const url = isNative() ? `${API_BASE}/api/auth/refresh` : '/api/auth/refresh';
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      credentials: isNative() ? 'omit' : 'include',
    });

    if (!res.ok) return false;

    if (isNative()) {
      // Native: read body, persist both tokens to localStorage.
      const data = await res.json().catch(() => null);
      if (!data?.accessToken || !data?.refreshToken) return false;
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    }

    // Web: cookies were updated by Set-Cookie on the response. We do NOT
    // read the body — XSS protection invariant. Discard the response body
    // by not calling .json()/.text(); the browser will GC the buffer.
    return true;
  } catch {
    return false;
  }
}

// ── Universal fetch with silent refresh ─────────────────────────────────────

interface ApiFetchOptions extends RequestInit {
  /** Internal: set after a refresh retry to prevent infinite loops. */
  __isRefreshRetry?: boolean;
}

/**
 * Universal fetch — replaces direct fetch() calls across the app.
 *
 * Day 5 silent-refresh behavior:
 *   - On 401 from a non-auth path, attempt POST /api/auth/refresh once.
 *   - If refresh succeeds, retry the original request with new tokens.
 *   - If refresh fails (or 401 from a bypass path), clear local state
 *     and dispatch 'auth:expired' event so AuthContext can redirect.
 *
 * The infinite-loop guard (__isRefreshRetry) ensures that a 401 from the
 * retry itself does NOT trigger another refresh — it falls through to the
 * caller's normal 401 handler.
 *
 * Web: relative path + credentials:'include' (cookie auth).
 * Native: absolute URL + Authorization: Bearer header.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> {
  const url = isNative() ? `${API_BASE}${path}` : path;

  const headers = new Headers(options.headers || {});

  if (isNative()) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: isNative() ? 'omit' : 'include',
  });

  // 401 silent-refresh — once per request, only on non-auth paths.
  if (
    res.status === 401 &&
    !options.__isRefreshRetry &&
    shouldAttemptRefresh(path)
  ) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      // Retry the original request. The retry flag prevents recursive
      // refresh if the new access token is also 401-rejected (which
      // would mean genuine auth failure beyond expiry).
      return apiFetch(path, { ...options, __isRefreshRetry: true });
    }
    // Refresh failed → clear local state, signal AuthContext to redirect.
    clearTokens();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
  }

  return res;
}
