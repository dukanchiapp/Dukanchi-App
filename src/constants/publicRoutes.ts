/**
 * publicRoutes — single source of truth for paths reachable WITHOUT
 * authentication or PWA gating.
 *
 * DPDP Act 2023 requires the legal documents (Privacy Policy, Terms, etc.)
 * to be readable before a user creates an account, so every /legal/* route
 * is public.
 *
 * Consumers:
 *  - FlowController (src/App.tsx) — skips the standalone → /signup redirect
 *    for these paths.
 *  - index.html "Pre-React browser guard" — a static <script> that runs
 *    before the bundle loads and therefore cannot import this module; it
 *    keeps an inline copy of the `/legal/` prefix check. Keep the two in
 *    sync — see the comment in index.html.
 */

/** Exact paths that are always public. */
export const PUBLIC_EXACT_PATHS: readonly string[] = ['/login', '/signup', '/landing'];

/** Path prefixes that are always public (prefix match). */
export const PUBLIC_PATH_PREFIXES: readonly string[] = ['/legal/'];

/** True when `pathname` is reachable without auth / PWA gating. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
