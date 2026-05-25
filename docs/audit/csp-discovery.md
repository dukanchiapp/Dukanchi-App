# CSP Discovery — pre-implementation inventory

**Origin:** pre-launch audit `5e2c671`, finding P1 #4 — `src/app.ts:39–47`
disables helmet's `contentSecurityPolicy` in both prod and dev.

**Status:** Discovery only. No source code changed in the commit that adds
this document. A follow-up PR will implement the CSP policy in
`Content-Security-Policy-Report-Only` mode first, then flip to enforcement
after 24–48 hours of clean reports.

**Branch state at discovery:** `main` @ `d067215`.

---

## 1. Third-party origins inventory

### 1a. Browser-loaded (in scope for CSP)

| Domain | Used by | Required directive(s) | Notes |
|---|---|---|---|
| `https://eu.i.posthog.com` | `src/lib/posthog.ts` (default `VITE_POSTHOG_HOST`) | `script-src`, `connect-src`, `img-src` | Allow `https://*.i.posthog.com` to cover regional routing |
| Sentry ingest (build-time, `VITE_SENTRY_DSN`) | `src/lib/sentry-frontend.ts` | `connect-src`, `worker-src` | Host pattern: `https://*.ingest.sentry.io` and `https://*.ingest.us.sentry.io` |
| `https://maps.googleapis.com` | `@react-google-maps/api` (`src/pages/Map.tsx`), Static Maps img (`StoreFormFields.tsx:146`) | `script-src`, `img-src`, `connect-src` | Maps JS loads subresources from `maps.gstatic.com` too |
| `https://maps.gstatic.com` | Loaded transitively by Google Maps JS API | `script-src`, `img-src` | |
| `https://nominatim.openstreetmap.org` | `src/context/LocationContext.tsx:28`, `src/components/LocationPicker.tsx:47`, `src/pages/Search.tsx:229` | `connect-src` | Browser `fetch()` |
| `https://fonts.googleapis.com` | `public/landing.html:35–36` | `style-src` | Google Fonts CSS (Sora + Kalam) |
| `https://fonts.gstatic.com` | Resolved transitively from above stylesheet | `font-src` | Actual font binaries |
| `https://images.unsplash.com` | `src/pages/Home.tsx:106–115` (hero fallbacks) | `img-src` | Candidate for removal — replace with `R2_PUBLIC_URL` assets |
| `https://picsum.photos` | `src/components/PostCard.tsx:169`, `src/components/futuristic/FPostCard.tsx:233` (placeholder fallbacks) | `img-src` | Candidate for removal |
| `https://unpkg.com` | `src/pages/LandingPage.tsx:238` — three.js CDN | `script-src` | Migration path: self-host or remove the Three.js hero |
| **R2 public bucket** — `env.R2_PUBLIC_URL` | `src/middlewares/upload.middleware.ts:292–353` builds image URLs from this env | `img-src` | Host is runtime/env-determined. Need to wire env into the CSP middleware so the host is allowlisted explicitly. |
| `wss://dukanchi.com` (same-origin) | Socket.IO client via `src/lib/api.ts:196` (`getSocketUrl`) | `connect-src 'self'` (or explicit `wss:` if Capacitor diverges) | Capacitor native uses `capacitor://localhost` — needs separate handling |

### 1b. Backend-only (NOT in scope for browser CSP)

These call from Node, never from the browser — safe to ignore:

| Domain | Used by |
|---|---|
| `https://generativelanguage.googleapis.com` | `src/modules/search/search.service.ts:165`, `src/modules/stores/bulkImport.service.ts:151`, `src/services/geminiEmbeddings.ts:18` |
| `https://api.postalpincode.in` | `src/modules/stores/store.controller.ts:114` |

### 1c. User-clickable anchors (NOT in scope — not a loaded resource)

- `https://www.google.com/maps/dir/?api=1&...` — directions links in `StoreInfoCard`, `StoreProfile`, `Search`. These are `href` targets opened in a new tab; they do not require a CSP allowlist.

### 1d. Test/dev-only (NOT in scope)

- `https://example.test` — appears only in `src/test-helpers/fixtures.ts` and `src/__tests__/*` test files
- `http://127.0.0.1`, `http://localhost`, `https://localhost` — dev / Capacitor schemes
- `http://www.w3.org/2000/svg` — SVG namespace string, not a network fetch

---

## 2. Inline content inventory

### 2a. Inline `<script>` blocks

| File | Lines | Purpose | Classification |
|---|---|---|---|
| `index.html` | 26–74 | Pre-React PWA-redirect / landing-bounce guard | 🚨 NEEDS NONCE OR `'unsafe-inline'` |
| `public/landing.html` | 5–~30 | PWA standalone-detect + sticky redirect | 🚨 NEEDS NONCE OR `'unsafe-inline'` |
| `public/landing.html` | 734–~796 | "PWA installed" banner gate | 🚨 NEEDS NONCE OR `'unsafe-inline'` |
| `public/landing.html` | 798–1007 | Main install/iOS-modal logic (~200 lines) | 🚨 NEEDS NONCE OR `'unsafe-inline'` |

**Total: 4 inline-script blocks** (1 in index.html, 3 in landing.html).
External-file `<script type="module" src="/src/main.tsx">` at `index.html:78` is `'self'`-covered.

### 2b. Inline event handlers in HTML

| File:line | Handler |
|---|---|
| `public/landing.html:305` | `onclick="window.location.href='/'"` |
| `public/landing.html:308` | `onclick="resetInstall()"` |
| `public/landing.html:346` | `onclick="continueInBrowser(); return false;"` |
| `public/landing.html:351` | `onclick="openApp()"` |
| `public/landing.html:676` | `onclick="continueInBrowser(); return false;"` |
| `public/landing.html:681` | `onclick="openApp()"` |
| `public/landing.html:973` | `onclick="if(event.target===this)closeIOSModal()"` |
| `public/landing.html:1002` | `onclick="closeIOSModal()"` |

**Total: 8 inline event handlers in `landing.html`.**

🚨 Important: inline event handlers like `onclick="..."` are blocked by CSP
even with `'unsafe-inline'` if a nonce or hash is present (the nonce-based
spec disables `'unsafe-inline'` automatically for backward incompatibility).
So either:
- (a) keep `'unsafe-inline'` and skip nonce, OR
- (b) rewrite landing.html to use `addEventListener` and then drop
  `'unsafe-inline'` from `script-src`.

Recommended migration: option (b) — landing.html is a static file we control,
the rewrite is mechanical, and it's the only file with this pattern.

### 2c. Inline `<style>` blocks and `style=""` attributes

| Pattern | Count | Files |
|---|---|---|
| `<style>` tag | 2 | `public/landing.html:37` (full theme CSS block), `src/components/PWAInstallPrompt.tsx:93` (`<style>{`@keyframes slideUp…`}</style>`) |
| `style="..."` attributes (HTML) | several | landing.html (per-element inline styles on buttons/banners) |
| `style={{ ... }}` (React JSX) | **~1,160** | Across `src/` — entire UI relies on inline `style` prop |

🚨 React's `style={{...}}` becomes an inline `style="..."` attribute at
runtime — CSP treats both the same. Without `style-src 'unsafe-inline'`, the
entire app's visual layer breaks.

Long-term migration path: move to Tailwind / CSS Modules / vanilla-extract.
At the React-component scale shown (1,160 hits), this is a multi-week
refactor, not a launch-week task. For now, `'unsafe-inline'` on `style-src`
is the pragmatic answer.

### 2d. `eval()` / `new Function()`

```
$ grep -rn 'eval(\|new Function(' src/ --include='*.tsx' --include='*.ts' --include='*.js'
# (no matches)
```

✅ Zero matches in `src/`. Third-party deps (PostHog, three.js, Google Maps,
@react-google-maps/api) **may** use them internally — verify in Report-Only
mode before enforcement. If a dependency violates `script-src`, we'll see it
in CSP reports and decide whether to:
- add `'unsafe-eval'` (last resort), or
- pin to a build that doesn't use eval, or
- replace the dependency.

### 2e. `<iframe>` usage

```
$ grep -rn '<iframe' src/ public/ --include='*.tsx' --include='*.html'
# (no matches)
```

✅ Zero iframes. Safe to set `frame-src 'none'` and `frame-ancestors 'none'`.

---

## 3. Web Workers / Service Workers

| Item | Location | Classification |
|---|---|---|
| ServiceWorker registration | `src/main.tsx:36` → `/sw.js` (Workbox via `VitePWA` in `vite.config.ts:64`) | ✅ SAFE — covered by `worker-src 'self'` |
| Push notification SW | `src/hooks/usePushNotifications.ts:28` (`navigator.serviceWorker.ready`) | ✅ SAFE — same SW |
| BullMQ worker | `src/workers/notification.worker.ts:9` | NOT applicable — server-side Node worker, not a browser Web Worker |
| Frontend `new Worker(...)` | (none) | ✅ — no client-side Web Workers spawned |

Workbox **may** spawn an internal blob-URL worker for caching. Allow
`worker-src 'self' blob:` defensively.

---

## 4. data: / blob: URI usage

| Scheme | Used in | Required directive |
|---|---|---|
| `blob:` | `src/components/profile/PostsGrid.tsx`, `src/components/dashboard/AiBioModal.tsx`, `src/pages/Chat.tsx` — image/audio uploads via `FileReader` / `URL.createObjectURL` | `img-src blob:`, `media-src blob:`, `worker-src blob:` |
| `data:image/svg+xml;...` | `src/pages/Map.tsx:302` — pin icons | `img-src data:` |

---

## 5. CSP risk assessment

| Finding | Classification | Action |
|---|---|---|
| Same-origin assets (`'self'`) | ✅ SAFE | Default-src `'self'` covers |
| PostHog (eu.i.posthog.com) | ⚠️ NEEDS DIRECTIVE | Allow in `script-src`, `connect-src`, `img-src` |
| Sentry ingest | ⚠️ NEEDS DIRECTIVE | Allow in `connect-src` (host from VITE_SENTRY_DSN at build time) |
| Google Maps + gstatic | ⚠️ NEEDS DIRECTIVE | Allow in `script-src`, `img-src`, `connect-src` |
| Nominatim (OpenStreetMap) | ⚠️ NEEDS DIRECTIVE | Allow in `connect-src` |
| Google Fonts | ⚠️ NEEDS DIRECTIVE | Allow `fonts.googleapis.com` in `style-src`, `fonts.gstatic.com` in `font-src` |
| Unsplash + Picsum + unpkg three.js | ⚠️ NEEDS DIRECTIVE | Allow in `img-src` / `script-src`. **Recommended:** remove these instead — they're cosmetic fallbacks / a static-asset CDN we can self-host |
| Cloudflare R2 (env-driven host) | ⚠️ NEEDS DIRECTIVE + ENV WIRING | `img-src` — middleware must read `R2_PUBLIC_URL` at boot and inject into the policy string |
| WebSocket (same-origin) | ✅ SAFE | `connect-src 'self'` + `wss:` for Capacitor |
| ServiceWorker `/sw.js` | ✅ SAFE | `worker-src 'self' blob:` |
| Inline `<script>` (4 blocks) | 🚨 NEEDS `'unsafe-inline'` (short-term) → migrate to external + nonce (long-term) | See Section 6 migration plan |
| Inline `onclick=` handlers (8 in landing.html) | 🚨 NEEDS `'unsafe-inline'` OR full rewrite to `addEventListener` | Rewrite is cleaner and unblocks dropping `'unsafe-inline'` later |
| Inline `<style>` (2 blocks) | 🚨 NEEDS `'unsafe-inline'` | Acceptable for now — only 2 occurrences |
| ~1,160 React `style={{...}}` props | 🚨 NEEDS `'unsafe-inline'` (style-src) | Long-term: move to Tailwind / CSS Modules. Not a launch-week task. |
| `eval()` / `new Function()` in our code | ✅ SAFE | Zero matches. Dependency-side TBD via Report-Only mode. |
| `<iframe>` | ✅ SAFE | None. `frame-src 'none'`. |
| `blob:` (images/audio) | ⚠️ NEEDS DIRECTIVE | `img-src blob:`, `media-src blob:`, `worker-src blob:` |
| `data:` (SVG icons) | ⚠️ NEEDS DIRECTIVE | `img-src data:` |

---

## 6. Recommendation for follow-up PR

### Phase 1 — Report-Only (24–48h)

Add a `Content-Security-Policy-Report-Only` header via helmet config + custom
middleware (helmet's CSP helper accepts directive objects, but we'll likely
hand-roll for the env-driven `R2_PUBLIC_URL` substitution).

Proposed initial directives (subject to violation reports):

```
default-src 'self';
script-src 'self' 'unsafe-inline'
  https://*.i.posthog.com
  https://maps.googleapis.com
  https://maps.gstatic.com
  https://unpkg.com;
style-src 'self' 'unsafe-inline'
  https://fonts.googleapis.com;
img-src 'self' data: blob:
  https://*.i.posthog.com
  https://maps.googleapis.com
  https://maps.gstatic.com
  https://images.unsplash.com
  https://picsum.photos
  ${R2_PUBLIC_URL};
font-src 'self' https://fonts.gstatic.com;
connect-src 'self'
  https://*.i.posthog.com
  https://*.ingest.sentry.io
  https://*.ingest.us.sentry.io
  https://nominatim.openstreetmap.org
  https://maps.googleapis.com
  wss://dukanchi.com
  wss:;
worker-src 'self' blob:;
media-src 'self' blob:;
frame-src 'none';
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
object-src 'none';
upgrade-insecure-requests;
report-uri /api/csp-report;
```

Add a minimal `/api/csp-report` endpoint that logs violations to Sentry
(structured `csp_violation` events).

### Phase 2 — Flip to enforce (after clean reports)

Same directives, change `Content-Security-Policy-Report-Only` →
`Content-Security-Policy`. Keep `/api/csp-report` for ongoing telemetry.

### Phase 3 — Tighten over time

In priority order:
1. Rewrite 8 `onclick=` handlers in `public/landing.html` to use
   `addEventListener`; this enables `script-src` nonce-based hardening for the
   4 inline-script blocks.
2. Remove cosmetic external image CDNs (Unsplash, Picsum) — replace with
   self-hosted assets in R2.
3. Replace `unpkg.com` three.js with self-hosted bundle OR remove the
   LandingPage Three.js hero entirely.
4. Drop `'unsafe-inline'` from `script-src` once Phase 3.1 lands.
5. Migrate React inline `style={{...}}` to Tailwind / CSS Modules over
   subsequent sprints; eventually drop `'unsafe-inline'` from `style-src`.

### Capacitor / native considerations

- Capacitor schemes (`capacitor://localhost`, `http://localhost`) bypass
  origin-based CSP because the webview's loaded origin matches. Same-origin
  `'self'` should cover most native cases.
- WebSocket from Capacitor uses `wss://dukanchi.com` (same `getSocketUrl()`
  helper), so `connect-src` allowlist for `wss://dukanchi.com` covers both
  web and native.

### Risks / unknowns to verify in Report-Only

- Does Google Maps JS API trigger inline `eval()` or load any extra origins
  we haven't seen statically?
- Does PostHog's `posthog-js` initialization load anything from
  `us.i.posthog.com` despite our `eu.i.posthog.com` host? (Yes for surveys,
  no for capture — confirm with a real session.)
- Does Workbox runtime require a blob-URL worker? (Likely — `worker-src blob:`
  is defensive.)
- Sentry replay integration loads workers from blob URLs — confirmed safe
  with `worker-src blob:`.

---

## 7. Out-of-scope items flagged during discovery

- `src/app.ts:39–47` — helmet `contentSecurityPolicy: false` is the audit
  finding. **Other** helmet headers (HSTS, X-Content-Type-Options, etc.) are
  active; only CSP is disabled.
- The comment at `src/app.ts:39` says "CSP still off — handled by Nginx" —
  there is **no Nginx in front of Fly.io** post-migration (we run Express
  directly). Update the comment when implementing CSP.

---

## 8. Verification commands (for the implementation PR)

```bash
# After deploying to Fly with Report-Only mode:
curl -sI https://dukanchi.com/ | grep -i content-security-policy
# → Content-Security-Policy-Report-Only: default-src 'self'; ...

# After 24-48h with no violation noise, flip to enforce:
curl -sI https://dukanchi.com/ | grep -i content-security-policy
# → Content-Security-Policy: default-src 'self'; ...

# Probe the CSP report endpoint:
curl -X POST https://dukanchi.com/api/csp-report \
  -H "Content-Type: application/csp-report" \
  -d '{"csp-report":{"document-uri":"https://dukanchi.com/","violated-directive":"script-src"}}'
# → 204 No Content (or 200, depending on Express handler)
```
