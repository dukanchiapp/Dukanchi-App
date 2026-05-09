// Single source of truth for API base URL + Capacitor-aware auth.
// Web (PWA): relative paths + httpOnly cookies (current behavior).
// Native (Capacitor iOS/Android): absolute URL + Bearer token header.
//
// IMPORTANT: No @capacitor/* imports here — uses window.Capacitor global.
// When Capacitor is installed in Session 80+, swap localStorage
// for @capacitor/preferences in this file only.

export const API_BASE = import.meta.env.VITE_API_URL || '';

const TOKEN_KEY = 'dk_token';

/** Returns true if running inside Capacitor native app (iOS/Android). */
export function isNative(): boolean {
  return typeof window !== 'undefined' &&
    (window as any).Capacitor?.isNativePlatform?.() === true;
}

/** Get auth token. Native only — web uses cookies. */
export function getToken(): string | null {
  if (!isNative()) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Save auth token. Native only. No-op on web. */
export function setToken(token: string): void {
  if (!isNative()) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.error('[api] setToken failed', e);
  }
}

/** Clear auth token. Native only. No-op on web. */
export function clearToken(): void {
  if (!isNative()) return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.error('[api] clearToken failed', e);
  }
}

/**
 * Universal fetch — replaces direct fetch() calls across the app.
 * Web: relative path + credentials:'include' (cookie auth, unchanged).
 * Native: absolute URL + Authorization: Bearer header.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = isNative() ? `${API_BASE}${path}` : path;

  const headers = new Headers(options.headers || {});

  if (isNative()) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: isNative() ? 'omit' : 'include',
  });
}
