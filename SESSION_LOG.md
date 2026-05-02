# G-AI — Session Change Log

> **One entry per development session or commit.**
> Add new entries at the TOP (newest first).
> Format: date, commit hash, what changed and why.

---

## 2026-05-02 — Session 59 (KYC approval flow + button layout)
- Profile.tsx: Empty store + KYC approved → forced "KYC Approved! 🎉" screen with "Complete Your Store Profile" button
- Profile.tsx: Edit Profile + New Post buttons now in same flex row
- PostsGrid.tsx: New Post button hidden (display:none), triggered via data-new-post-trigger from Profile

---

## 2026-05-02 — Session 58 (CRITICAL FIX — wrong /me URL)

- `AuthContext` was calling `/api/me` which does not exist
- Real endpoint is `/api/auth/me` (mounted via `app.use('/api/auth', authRoutes)`, `router.get('/me')`)
- Express returned HTML for non-existent route → JSON parse failed on every refresh
- Every refresh broke auth → forced `/login` redirect
- Fixed: `src/context/AuthContext.tsx` `/api/me` → `/api/auth/me`
- Fixed misleading comment in `src/app.ts`

---

## 2026-05-02 — Session 56 (PWA refresh bug — sessionStorage sticky flag)

- Chrome `matchMedia` race condition on PWA refresh fixed with `sessionStorage` sticky flag
- `sessionStorage` flag (`dk-pwa`) set ONLY when `matchMedia` confirms standalone — never from URL or other signals
- Per-window `sessionStorage` cannot leak to browser tabs (unlike `localStorage`)
- `index.html` IIFE, `src/App.tsx` FlowController, `public/landing.html` all use same logic
- Refresh in PWA now stays on current path instead of wrongly redirecting to `/landing`

---

## 2026-05-02 — Session 55 (PWA detection fix — minimal-ui false positive)

- Removed `minimal-ui` and `fullscreen` from standalone detection in `index.html` IIFE, `src/App.tsx` FlowController, and `public/landing.html`
- These were triggering false-positive PWA detection in DevTools responsive/fullscreen mode
- Now only true PWA signals: `display-mode:standalone`, iOS `navigator.standalone`, `android-app://` referrer
- Browser `localhost:3000` now correctly redirects to `/landing`
- Removed debug console.log added in Session 54

---

## 2026-05-02 — Session 54 (FINAL: SW disabled in dev mode)

- `src/main.tsx`: SW only registers in `import.meta.env.PROD`
- Dev mode automatically unregisters existing SW + clears all caches
- This fixes: stale HTML caching, IIFE redirect failures, JSON parse errors from SW serving cached HTML as API responses
- Production builds still get full SW + offline support
- `index.html` IIFE verified correct — no changes needed

---

## 2026-05-02 — Session 53 (SW HTML cache fix)

- `public/sw.js` rewritten: navigation requests + `/`, `/landing`, `*.html` → **always network, never cached**; only static assets (icons, manifest) use cache-first
- Old SW (v10) was caching `index.html`, so even after the IIFE was updated browsers kept getting the stale pre-redirect HTML and stayed on `/login` instead of bouncing to `/landing`
- `CACHE_NAME` bumped `dukanchi-v10` → `dukanchi-v11`
- `activate` now wraps cache-purge + `clients.claim()` in `Promise.all` so the new SW immediately controls open tabs
- API requests (`/api/*`) bypass SW entirely (`return;` without `respondWith`)
- USER ACTION: DevTools → Application → Service Workers → **Unregister** old `dukanchi-v*`; → Storage → **Clear site data**; close all Dukanchi tabs; reopen → `/login` should bounce to `/landing`
- `npx tsc --noEmit` → 0 errors

---

## 2026-05-02 — Session 51 (PWA flow — Play Store style, FINAL)

- `index.html` IIFE: simple matchMedia check, removed all sessionStorage logic
- `src/App.tsx` FlowController: same simple `isStandalone` check (matchMedia standalone/minimal-ui + iOS standalone + Android TWA referrer)
- `public/landing.html` top script: simple matchMedia, no leak risk; only redirects PWA windows away from landing
- `localStorage.dukanchi-pwa-v1` is the source of truth for "is installed" — set on `appinstalled`, cleared by user via reset link
- "Open App" button enhanced: larger, with helper text ("Button kaam nahi kiya? Home screen se app icon click karein") and separate reset link
- Both `.open-app-wrap` blocks updated (preserved unique IDs `pwa-download-again` / `pwa-download-again-cta` so existing reset wiring keeps working)
- `public/sw.js`: bumped `dukanchi-v9` → `dukanchi-v10`
- Browser AFTER install → Landing with prominent "Open App" button (via existing `showInstalledState()`)
- `npx tsc --noEmit` → 0 errors

---

## 2026-05-02 — Session 50 (PWA detection leak fix)

- Removed `?source=pwa` URL param as authoritative signal — was leaking PWA detection to plain browser tabs (shared links carried the param)
- `sessionStorage['dk-is-pwa']` now ONLY set when `matchMedia(display-mode: standalone)` (or iOS/TWA equivalent) explicitly confirms standalone — single source of truth
- `index.html` IIFE: `isPWA = matchMedia OR sessionFlag`; `?source=pwa` no longer trusted alone
- `src/App.tsx` FlowController: same authoritative pattern — direct check first, then sessionStorage fallback
- `public/landing.html`: same pattern in top-of-`<head>` redirect script
- `public/sw.js`: bumped `dukanchi-v8` → `dukanchi-v9`
- Browser tabs cannot inherit PWA detection: per-tab sessionStorage + matchMedia=false → always redirects to `/landing`
- `npx tsc --noEmit` → 0 errors

---

## 2026-05-02 — Session 49 (PWA refresh redirect bug fix)

- Bulletproof PWA detection: matchMedia + URL param + sessionStorage
- `index.html` IIFE: persists PWA detection across refreshes (`sessionStorage['dk-is-pwa']`)
- `src/App.tsx` FlowController: same multi-layer detection (matchMedia standalone/minimal-ui, iOS standalone, Android TWA referrer, sessionStorage flag)
- `public/landing.html`: same logic for redirect-out check; sets sessionStorage flag whenever PWA detected so subsequent navigations stick
- `public/sw.js`: bumped `dukanchi-v7` → `dukanchi-v8`
- Fixes: PWA refresh after signup/KYC was redirecting to `/landing` because Chrome's `display-mode: standalone` matchMedia intermittently returns false on refresh inside PWA window
- `npx tsc --noEmit` → 0 errors

---

## 2026-05-02 — Session 48 (PWA install URL bug fix)

- `public/landing.html`: synchronous standalone check at TOP of `<head>` (right after `<meta charset>`) — fires before any CSS/JS so PWA users never see a flicker
- `public/manifest.json`: `start_url` → `/?source=pwa`, added `scope: "/"` — PWA always launches at root regardless of which URL user installed from
- `public/sw.js`: bumped `dukanchi-v6` → `dukanchi-v7`; `/landing` requests bypass cache (network-only) so stale landing never served to PWA
- `index.html`: pre-React IIFE now also handles PWA-on-`/landing` → redirects to `/` (recovers from stale install start_url)
- Detection covers: Android Chrome (`display-mode: standalone`), Android variants (`minimal-ui`), iOS Safari (`navigator.standalone`), Android TWA (`document.referrer` `android-app://`)
- USER ACTION REQUIRED: uninstall current PWA → hard refresh (Cmd/Ctrl+Shift+R) → visit landing → click "Download Karo" → reinstall fresh to clear stale `start_url`
- `npx tsc --noEmit` → 0 errors

---

## 2026-05-01 — Session 48 (GOD-LEVEL LANDING FIX)

- `src/App.tsx`: removed `BrowserGuard` component entirely — React no longer redirects browser users
- `src/components/ProtectedRoute.tsx`: removed `isStandalone` check + `window.location.replace('/landing')` — auth-only logic
- `public/landing.html`: replaced install script with 3-state system (installed/ready/waiting); `INSTALLED_KEY = 'dukanchi-pwa-v1'`; `appinstalled` → redirects to `/`; added `showInstalledState()`, `showInstallReadyState()`, `showWaitingState()`, `resetInstall()`, `openApp()`
- `public/landing.html`: added `open-app-wrap` divs (hidden by default) after each `.btn-install-wrap` — shown when app already installed
- `public/landing.html`: added "Dobara download?" link in hero + CTA open-app sections; "Dobara download?" span in `#pwa-installed-banner`
- Single source of truth: `index.html` IIFE handles all browser→landing redirects; React only handles auth; landing.html handles its own PWA install state
- `npx tsc --noEmit` → 0 errors

---

## 2026-05-01 — Session 47 (FINAL LAUNCH AUDIT)

- `CustomerDataTabs.tsx`: added `onUnfollow`, `onUnsave`, `onClearHistory` props + action buttons (Unfollow/Remove/Clear All)
- `UserSettings.tsx`: wired the 3 handlers (toggle-follow/toggle-save/delete-history API calls + optimistic state updates)
- `tsconfig.json`: added `include`/`exclude` — frontend-only TS check; backend files excluded
- `public/sw.js`: CACHE_NAME bumped `dukanchi-v5` → `dukanchi-v6`
- Flow audit (8 paths): Profile, RetailerDashboard, UserSettings, useFeed, PostCard, App, AuthContext, SW — all ✓
- `npx tsc --noEmit` → 0 errors

---

## 2026-05-01 — Session 46 (UserSettings split — completed)

- `src/pages/UserSettings.tsx` split (863 → 391 lines): 6 components under `src/components/settings/`
- `ManagePostsTab.tsx` — manage posts tab (post list, bulk/single delete, selection); React.memo
- `ManageTeamTab.tsx` — manage team tab (owner card, member list, add member modal with form); React.memo
- `CustomerDataTabs.tsx` — all 5 customer tabs (following, saved, locations, history, reviews); React.memo
- `AccountDetailsTab.tsx` — personal/sign-up details form; uses useAuth + useToast internally; React.memo
- `BulkUploadTab.tsx` — Excel/CSV import + manual product text; owns importLoading/importResult state; React.memo
- `BusinessSettingsTabs.tsx` — visibility, chat, subscription, marketing, report, help tabs; owns handleToggleSetting; React.memo
- `npx tsc --noEmit` → 0 errors

---

## 2026-04-30 — Session 44 (MEGA SPRINT: map skeleton, SEO meta, Profile+Dashboard split)

- TASK 1: `Map.tsx` — added `storesLoading` state; horizontal store card carousel shows 3 shimmer skeleton cards while stores are fetching
- TASK 2: `src/hooks/usePageMeta.ts` — per-page document.title + og:title + meta description via direct DOM; added to Home, Search, Map, Messages, Profile, StoreProfile (dynamic storeName)
- TASK 3: Profile.tsx split (1342 → 435 lines): extracted `src/components/profile/StoreInfoCard.tsx` (store address/phone/hours/directions), `PostsGrid.tsx` (full posts management: grid + selected post view + new post modal + edit modal + delete confirm; self-contained AI/voice state), `ReviewsTab.tsx` (reviews list)
- TASK 4: RetailerDashboard.tsx split (1163 → 355 lines): extracted `src/components/dashboard/AiBioModal.tsx` (self-contained AI bio generation with voice recording), `StoreFormFields.tsx` (pure UI form fields with logo/cover upload), `KycUploadForm.tsx` (moved existing inline sub-component to own file)
- `npx tsc --noEmit` → 0 errors

---

## 2026-04-30 — Session 43 (SPRINT 2B: Type safety + architecture)

- WIN 1: `src/types/index.ts` — central type definitions (User/Store/Product/Post/Message/Conversation/Interactions/FeedResponse/ApiPagination); fields matched to actual Prisma schema
- WIN 2: Replaced `any` in 4 critical files: `PostCard.tsx` (post: Post, onShare: Post), `Home.tsx` (Post[], Interactions, getLikeCount/handleShare typed), `Messages.tsx` (Conversation[], formatConversations helper), `Chat.tsx` (Message[], sendRaw body typed, socket handler typed)
- WIN 3: `src/hooks/useFeed.ts` — custom hook extracts feed pagination from Home.tsx; handles global/following; returns posts/loading/loadingMore/hasMore/loadMore; Home.tsx now uses useFeed + separate effect for saved tab; ~70 lines removed from Home.tsx
- WIN 4: `src/components/ConversationRow.tsx` — memoized with custom equality (userId+lastMessage+unread); Messages.tsx uses ConversationRow + useCallback handleOpenChat; 3 duplicate `fetch('/api/conversations')` blocks consolidated into `refreshConversations()`
- Profile/RetailerDashboard/UserSettings `any` deferred to Sprint 3
- `npx tsc --noEmit` → 0 errors

---

## 2026-04-30 — Session 42 (SPRINT 2A: Performance & Polish)

- WIN 1: `src/App.tsx` — replaced 10 eager page imports with `React.lazy()`; kept Login/Signup/NotFound eager; wrapped `<Routes>` in `<Suspense>` spinner; chunks now load on demand
- WIN 2: `src/components/PostCard.tsx` — new file, extracted post card JSX from `Home.tsx`; `React.memo` with custom equality (compares isLiked/isSaved/isFollowed/likeCount/distance/imgRatio); moved `renderCaption` + `getImageStyles` helpers into component; `Home.tsx` handlers wrapped in `useCallback` with functional-updater pattern so callbacks are stable (no interactions dependency)
- WIN 3: `src/pages/Search.tsx` — replaced two separate debounce timers (150ms suggestions + 500ms main search) with a single `debouncedQuery` state updated after 300ms; both effects now depend on `debouncedQuery`
- WIN 4: `loading="lazy" decoding="async"` added to below-fold `<img>` tags in `Home.tsx` (via PostCard), `StoreProfile.tsx`, `Profile.tsx`, `Search.tsx`, `Map.tsx`; above-fold hero/cover images unchanged
- WIN 5: `filteredStores` + `validStores` in `Map.tsx` wrapped in `useMemo`; `filteredStores` in `Search.tsx` wrapped in `useMemo`
- `npx tsc --noEmit` → 0 errors

---

## 2026-04-30 — Session 41 (SPRINT 1: Production Readiness)

- Fix 1: Gemini model corrected in `search.service.ts` + `bulkImport.service.ts` → `gemini-2.5-flash` (was `gemini-1.5-flash-latest`); verified 0 old model strings remain
- Fix 2: `vite.config.ts` — `build.minify: 'terser'` with `pure_funcs: ['console.log', 'console.debug', 'console.info']`; production strips debug logs, keeps `console.error/warn`; installed `terser` dev dep
- Fix 3: All silent `catch {}` blocks replaced — frontend action handlers now log + rollback; backend Redis catches annotated; verified 0 empty catches remain
- Fix 4: `src/components/ErrorBoundary.tsx` — class component error boundary with Hinglish UI (😅 "Kuch toot gaya"), dev shows error message, prod shows refresh/home buttons; wired into `App.tsx` wrapping `<Router>`; installed `@types/react@^19` + `@types/react-dom@^19` (required for class component types)
- Fix 5: `toggleLike/toggleSave/toggleFollow` in `Home.tsx` — optimistic update + rollback on `!res.ok`; `toggleFollow` in `StoreProfile.tsx` — made optimistic with rollback

---

## 2026-04-30 — Session 40 (Shimmer skeleton loaders)

- `src/components/Skeleton.tsx`: new file — injects `@keyframes shimmer` CSS once via `document.head`; exports `ShimmerBox`, `PostCardSkeleton`, `ConversationSkeleton`, `StoreCardSkeleton`
- `Home.tsx`: replaced 2-card `animate-pulse` block with 3× `PostCardSkeleton`
- `Messages.tsx`: replaced 3-row gray box skeleton with 5× `ConversationSkeleton`
- `Search.tsx`: replaced 3-card `animate-pulse` block with 4× `StoreCardSkeleton`

---

## 2026-04-30 — Session 39 (Infinite scroll home feed)

- `Home.tsx`: IntersectionObserver infinite scroll — sentinel div at bottom of feed
- `fetchFeed(pageNum)`: accepts page number, appends posts on scroll, deduplicates by id, sets `hasMore` from `pagination.totalPages`
- `loadingMore` state drives 3-dot bounce indicator while fetching next page
- End-of-feed "Sab posts dekh liye!" message when `!hasMore && posts.length > 0`
- Reset to page 1 whenever feedType / locationRange / location changes

---

## 2026-04-30 — Session 38 (Web Push Notifications)

- `npm install web-push @types/web-push`
- VAPID keys generated and added to `.env`; `src/config/env.ts` extended with `VAPID_PUBLIC_KEY/PRIVATE_KEY/MAILTO`
- `prisma/schema.prisma`: `PushSubscription` model added; `User.pushSubscriptions` relation wired; `npx prisma db push` applied
- `src/services/push.service.ts`: `sendPushToUser()` — fetches all subs for user, sends via web-push, auto-removes expired (410/404) subscriptions
- `src/modules/push/push.routes.ts`: `GET /vapid-public-key`, `POST /subscribe` (upsert), `DELETE /unsubscribe`
- `src/app.ts`: `app.use('/api/push', pushRoutes)` registered
- `src/modules/messages/message.service.ts`: fire-and-forget `sendPushToUser()` call after saving message — receiver gets push notification with sender name + message preview
- `src/hooks/usePushNotifications.ts`: React hook — waits 3s after login, fetches VAPID key, subscribes browser, POSTs subscription to backend
- `src/App.tsx`: `usePushNotifications()` called inside `FlowController` (within AuthProvider)

---

## 2026-04-30 — Session 37 (Smart feed ranking + unified categories)

- `post.service.ts`: `haversineKm()` helper added; `getFeed` now fetches `limit * 3` candidates, scores each post (freshness 40% + distance 25% + engagement 20% + follow 15% + opening post +5%), sorts by score, returns top `limit` — replaces pure chronological feed
- `src/constants/categories.ts`: new single source of truth — `CATEGORIES` array with `value/label/fullLabel/emoji/color/aliases`, `matchCategory()` fuzzy helper, `CATEGORY_CHIPS` for UI
- `Map.tsx`: removed local CATEGORY_CHIPS + CATEGORY_COLORS; imports from constants; filter uses `matchCategory()`; markers use `catDef.color` + `catDef.emoji`
- `Search.tsx`: removed local CATEGORIES array; imports `ALL_CATEGORIES` from constants + local `CATEGORY_BG` color map for grid UI; filter uses `matchCategory()`; filter panel chips now cover all 11 categories
- `RetailerDashboard.tsx`: removed 29-item STORE_CATEGORIES array; select now maps from `CATEGORIES` using `fullLabel` as display text
- `public/sw.js`: `dukanchi-v4` → `dukanchi-v5` (cache bust for category changes)

---

## 2026-04-29 — Session 36 (Remove PWARefreshButton, chat fix, no translate)

- `PWARefreshButton.tsx`: deleted; removed import + JSX from `App.tsx` (superseded by per-page `RefreshButton`)
- `Chat.tsx` `sendRaw`: fallback `senderId: saved.senderId || currentUserId` ensures bubble renders on right side even if API omits field; added error logging
- `index.html`: `lang="en" translate="no"` + `<meta name="google" content="notranslate">` — suppresses Chrome/browser translation prompt

---

## 2026-04-29 — Session 35 (Desktop install hint + SW cache bust)

- `public/landing.html`: desktop install button now shows `#desktop-install-hint` div (orange bordered, instructions) instead of redirecting — fixes reload loop on Mac/Chrome
- `public/sw.js`: `dukanchi-v2` → `dukanchi-v3` — forces phone PWA to evict old cache and fetch latest code

---

## 2026-04-29 — Session 34 (Critical chat fix + refresh buttons)

- `Chat.tsx`: replaced `localStorage.getItem('user')` with `useAuth()` — `currentUserId` was always `''` causing messages to never show/send
- `RefreshButton.tsx`: new reusable component (black pill, SVG icon + "Refresh" text)
- `Messages.tsx`: RefreshButton replaces decorative MessageCircle button in header
- `StoreProfile.tsx`: RefreshButton added to floating header (between back and share)
- `Profile.tsx`: RefreshButton added to profile header (before NotificationBell)
- User routes `/:id` and `/:id/store` already existed — no changes needed

---

## 2026-04-29 — Session 33 (7 phone testing fixes)

- `StoreProfile.tsx`: Direction button — black prominent style with shadow
- `Messages.tsx`: passes `state={{ userName: conv.name }}` to `/chat/:id` navigation
- `Chat.tsx`: reads `userNameFromState` from `location.state` for immediate name display — no more "Loading..."
- `AppHeader.tsx`: refresh button → black pill with "Refresh" text
- `geminiVision.ts`: bio prompt "STRICTLY under 320 chars, complete sentence"; slice 180→350
- `RetailerDashboard.tsx`: description textarea `maxLength={350}` + char counter (red at 320+)
- `Map.tsx`: height 300→380, removed `mt-3` gap below map
- `index.html`: `user-scalable=no, maximum-scale=1.0` — no pinch zoom

---

## 2026-04-29 — Session 32 (Chat fix + refresh btn + maps note)

- `message.controller.ts`: `getMessages` uses `authenticatedUserId` from token, removes strict URL param check that caused 403
- `message.routes.ts`: simplified `/:userId/:otherUserId` → `/:otherUserId`
- `Chat.tsx`: updated fetch URL from `/api/messages/${myId}/${otherId}` → `/api/messages/${otherId}`
- `AppHeader.tsx`: refresh button (circular, SVG icon) added before NotificationBell
- `Map.tsx`: documented Google API key HTTP referrer steps as top comment; improved loadError UI

---

## 2026-04-29 — Session 31 (Phone testing bug fixes)

- `store.service.ts`: `toggleFollow` uses composite key `userId_storeId` for delete (was using `.id` which doesn't exist on Follow model)
- `store.controller.ts`: proper 404 for store-not-found in follow handler
- `auth.middleware.ts`: `canChat` now returns `true` for all roles — open marketplace
- `messages.tsx`: fixed field mapping — was reading `conv.storeName`, API returns `conv.name`
- `map.tsx`: added `loadError` handling from `useJsApiLoader` with user-friendly error UI
- Commit: `fix: follow 500, canChat 403, messages name, map loadError`

---

## 2026-04-29 — Session 30 (Vite 6 host validation fix)

- `server.ts`: `allowedHosts: true` in `createViteServer` — disables Vite 6 host header validation that was blocking ngrok requests before Express ran
- `vite.config.ts`: same `allowedHosts: true` for `vite` CLI mode
- Root cause: Vite 6 security feature rejects requests with unrecognised `Host` headers; fix is `true` not string `'all'` (TypeScript enforces `true | string[]`)
- Commit: `fix: Vite 6 allowedHosts true — unblock ngrok testing`

---

## 2026-04-29 — Session 29 (ngrok CORS fix)

- `src/config/env.ts`: added `isNgrokOrigin()` helper — returns true for `*.ngrok-free.dev`, `*.ngrok.io`, `*.ngrok.app` origins in dev mode
- `src/app.ts`: CORS middleware uses `isNgrokOrigin()` to allow any ngrok tunnel without hardcoding the URL; added `ngrok-skip-browser-warning` to allowed headers
- `.env`: added `NGROK_URL=https://recollect-clay-defame.ngrok-free.dev` (update manually when ngrok restarts)
- Commit: `fix: allow ngrok origins in dev CORS — enable phone testing`

---

## 2026-04-29 — Session 27 (Hooks violation fix + correct BrowserGuard)

- `Login.tsx` + `Signup.tsx`: removed all `isStandalone` checks — plain components, no browser detection (hooks violation: `useState` was called after conditional `return null`)
- `src/App.tsx`: added correct `BrowserGuard` component — `useEffect` called unconditionally before any `return`, then `return null` after; wraps `/login` and `/signup` routes
- `ProtectedRoute.tsx`: already correct — uses `window.location.replace('/landing')`
- Commit: `fix: hooks violation — clean Login/Signup + correct BrowserGuard in App.tsx`

---

## 2026-04-29 — Session 26 (Triple-layer browser guard)

- `Login.tsx` + `Signup.tsx`: restored `isStandalone` check — `return null` + `useEffect` redirect to `/landing` for browser mode
- `public/sw.js`: bumped `CACHE_NAME` `dukanchi-v1` → `dukanchi-v2` to force all browsers to evict old SW cache and pick up new `index.html` with IIFE
- Belt-and-suspenders: `index.html` IIFE + component guard + `ProtectedRoute` all active
- Commit: `fix: triple-layer browser guard — Login/Signup isStandalone + SW cache bust`

---

## 2026-04-29 — Session 25 (Blank page fix + PWA installed banner)

- `ProtectedRoute.tsx`: replaced `<Navigate to="/landing">` (React Router — hits NotFound) with `window.location.replace('/landing')` hard redirect for browser mode; PWA standalone still uses `<Navigate to="/login">`
- `public/landing.html`: added `#pwa-installed-banner` (orange, fixed top) shown when `localStorage['dukanchi-pwa-installed'] === '1'` — IIFE runs at script start, `appinstalled` listener already sets the flag
- Commit: `fix: ProtectedRoute hard redirect + PWA installed banner on landing`

---

## 2026-04-29 — Session 24 (Pre-React browser guard)

- `index.html`: added inline IIFE script before `</head>` — checks `isStandalone` and calls `window.location.replace('/landing')` before React loads, eliminating all flash and race conditions
- `src/App.tsx`: removed `BrowserGuard` component entirely; simplified `FlowController` to PWA-only logic (browser case now handled by index.html)
- `src/pages/Login.tsx` + `Signup.tsx`: removed all `isStandalone` checks and `useEffect` redirects — redundant after index.html fix
- Commits: `fix: BrowserGuard useEffect — resolve blank page on browser redirect`, `fix: pre-React browser guard in index.html — zero flash redirect to landing`

---

## 2026-04-28 — Session 23 (Architecture + UX/Performance improvements)

### Architecture Fixes

1. **Graceful shutdown** (`server.ts`) — Added SIGTERM/SIGINT handlers that close HTTP server, disconnect Prisma, and quit Redis pub/sub clients
2. **Health check endpoint** (`app.ts`) — `GET /health` returns `{ status: 'ok', timestamp }` for readiness probes (placed before rate limiter)
3. **Structured logging migration** — Replaced 14 `console.error` calls with Pino `logger.error` across 6 backend controllers:
   - `auth.controller.ts`, `post.controller.ts`, `message.controller.ts`
   - `misc.controller.ts`, `search.controller.ts`, `store.controller.ts`, `store.service.ts`
4. **Dead code removal** (`Search.tsx`) — Removed TODO mic button that logged to console and did nothing

### UX/Performance Improvements

5. **ProtectedRoute PWA-aware redirect** (`ProtectedRoute.tsx`) — Browser users → `/landing`, PWA standalone → `/login` (eliminates login page flash)
6. **Carousel lazy loading** (`Home.tsx`) — Non-active slides use `loading="lazy"`, active slide uses `loading="eager"` for better LCP
7. **Store 404 page** (`StoreProfile.tsx`) — Invalid store links now show a proper 404 with icon, message, and Go Back button instead of blank page

---

## 2026-04-28 — Session 22 (Security hardening — helmet, CORS, ownership, auth routes)

### Features & Fixes

#### 1. Environment-conditional Helmet
**File:** `src/app.ts`
- Production: full helmet protection (HSTS, X-Frame-Options, etc.) — only CSP disabled (handled by Nginx)
- Development: relaxed for iframe previews and local testing

#### 2. CORS origin hardening
**File:** `src/config/env.ts`
- Production fallback returns empty list (must be explicitly configured via ALLOWED_ORIGINS)
- Dev fallback includes `localhost:3000`, `localhost:5173`, `127.0.0.1` variants

#### 3. `updateStore` ownership check added
**File:** `src/modules/stores/store.controller.ts`
- Previously any authenticated user could update any store
- Now verifies `store.ownerId === req.user.userId` before allowing updates

#### 4. Authenticated all data read routes
**File:** `src/modules/stores/store.routes.ts`
- `GET /stores`, `GET /stores/:id`, `GET /stores/:id/posts`, `GET /products` now require `authenticateToken`
- Prevents unauthenticated data scraping / enumeration

#### 5. Fixed missing `credentials: 'include'` across frontend
**Files:** `StoreProfile.tsx`, `Profile.tsx`, `UserSettings.tsx`
- All `fetch()` calls to protected endpoints now send auth cookies
- Prevents 401 errors from newly-protected routes

---

## 2026-04-28 — Session 21 (Critical security + data integrity audit fixes)

### Features & Fixes

#### 1. Global rate limiter applied
**File:** `src/app.ts`
- `generalLimiter` was defined but never mounted → now applied to all `/api` routes
- `uploadLimiter` added to `POST /api/upload` endpoint

#### 2. Duplicate `/api/me` route removed
**File:** `src/app.ts`
- Removed standalone `app.get("/api/me")` (used `authenticateToken` only) — the canonical route in `auth.routes.ts` uses `authenticateAny` for both app + admin cookies

#### 3. `toggleFollow` auth bypass fixed
**Files:** `src/modules/stores/store.controller.ts`, `src/pages/Home.tsx`, `src/pages/StoreProfile.tsx`
- Previously read `userId` from `req.body` → any user could follow/unfollow on behalf of others
- Now uses `(req as any).user.userId` from JWT
- Frontend updated to stop sending `userId` in body

#### 4. `createProduct` ownership check added
**File:** `src/modules/stores/store.controller.ts`
- Previously any authenticated user could create products in any store
- Now verifies `store.ownerId === req.user.userId` before allowing creation

#### 5. Cascade deletes on all FK relations
**File:** `prisma/schema.prisma`
- Added `onDelete: Cascade` to 17 foreign key relations (Follow, Product, Post, Message, Review, Notification, SavedItem, SearchHistory, SavedLocation, TeamMember, Report, Like, Complaint, AskNearbyRequest, AskNearbyResponse)
- Post→Product uses `onDelete: SetNull` (preserve post if product is deleted)
- **Migration:** `20260428135155_cascade_deletes`

#### 6. Socket JWT secret hardening
**File:** `src/config/socket-listeners.ts`
- Replaced dangerous `process.env.JWT_SECRET || 'secret'` fallback with validated `env.JWT_SECRET` import

#### 7. Health check endpoint added
**File:** `src/app.ts`
- Added `GET /health` returning `{ status: 'ok', timestamp }` for load balancer/monitoring probes

---

## 2026-04-28 — Session 20 (Authentication Flow, UI Redesign, and Security Fixes)

### Features & Fixes
- **Routing**: Replaced `PWARedirect` with `FlowController` in `src/App.tsx`. Browser users without sessions are redirected to the landing page. PWA users are correctly routed to auth flows.
- **Auth UI Redesign**: Removed purple gradients and applied Dukanchi's core orange theme (`#FF6B35`) to `Login.tsx` and `Signup.tsx`, including customized Hindi copy.
- **Install Prompt**: Updated `PWAInstallPrompt.tsx` to hide on auth routes. Fixed a critical "Rules of Hooks" crash by ensuring early returns are placed after the `useEffect` hook.
- **Admin Panel Preview**: Changed the Landing Page iframe `src` to `127.0.0.1` in `admin-panel/src/pages/LandingPage.tsx` to bypass strict HSTS caching issues on Chrome. Also disabled `hsts`, `crossOriginOpenerPolicy`, and `crossOriginEmbedderPolicy` in `src/app.ts`.

---

## 2026-04-28 — Session 19 (Admin Panel iframe preview fix)

### Modified Files
- `src/app.ts` — Disabled `xFrameOptions` in `helmet` middleware (`xFrameOptions: false`) to allow the admin panel (running on port 5173) to load the backend's landing page (running on port 3000) within an iframe for live preview.

---

## 2026-04-28 — Session 18 (Landing page CTA removal and PWA refresh button)

### New Files
- `src/components/PWARefreshButton.tsx` — floating refresh button for standalone mode

### Modified Files
- `public/landing.html` — removed "Free mein Join Karo" nav CTA button
- `src/App.tsx` — added `PWARefreshButton` globally

---

## 2026-04-28 — Session 17 (PWA landing page — static HTML, smart button, redirect fixes)

### New Files
- `public/landing.html` — full standalone HTML landing page (Sora font, phone mockup, SVG sketch illustrations, comparison table, scroll-reveal); served by Express at GET /landing before Vite middleware; data-content attributes on all CMS text; fetches /api/landing-content on load

### Modified Files
- `src/app.ts` — added `import path`, `app.get('/landing', res.sendFile('public/landing.html'))` before Vite middleware
- `src/App.tsx` — removed React LandingPage import + route (Express now owns /landing); added `PWARedirect` component (standalone + !user + !isLoading → navigate('/signup', replace)); added `useAuth` import
- `src/components/BottomNav.tsx` — added `/landing` to exclusion list (no bottom nav on landing page)
- `public/landing.html` (iterative improvements):
  - Smart single PWA button: removed all Login/Signup secondary buttons; 4 states (default/loading/success/open); `setInstallState()` updates all buttons in sync
  - Pre-install branding overlay: full-screen orange overlay with "द" logo, bounce-dot animation, 800ms delay before `deferredPrompt.prompt()`; on accept → green success state
  - PWA redirect fixes: `isStandalone` on load → `window.location.replace('/signup')` immediately; `appinstalled` event → `showInstalledAndRedirect()` (hides buttons, shows green pill, `window.location.href = '/signup'` after 1.5s); removed all `window.open()` calls; iOS modal close → same redirect flow
  - `.install-success-msg` element in hero + final CTA sections
- `package.json` / `package-lock.json` — added `canvas` + `vite-plugin-pwa` dev dependencies

---

## 2026-04-28 — Session 16 (PWA — installable app from landing page)

### New Files
- `public/manifest.json` — full PWA manifest (name, short_name, icons, start_url, display:standalone, hi-IN, categories)
- `public/sw.js` — service worker: cache-first static, network-first /api/*, push notifications, notificationclick
- `public/icons/` — 8 icon sizes (72–512px) generated via scripts/generateIcons.cjs (canvas, orange rounded rect + white "द")
- `scripts/generateIcons.cjs` — Node script to regenerate icons (run: `node scripts/generateIcons.cjs`)
- `src/components/PWAInstallPrompt.tsx` — orange bottom banner captures beforeinstallprompt; iOS modal with Share instructions; 3-day localStorage dismiss; success toast

### Modified Files
- `index.html` — added PWA meta tags (manifest, theme-color, apple-mobile-web-app-*, apple-touch-icon, mobile-web-app-capable, description)
- `src/main.tsx` — navigator.serviceWorker.register('/sw.js') on load
- `src/App.tsx` — PWAInstallPrompt rendered globally
- `public/landing.html` — install-btn / install-btn-cta → deferredPrompt.prompt(); iOS modal with step-by-step instructions
- `vite.config.ts` — VitePWA plugin with workbox glob caching + Google Fonts CacheFirst

---

## 2026-04-28 — Session 15 (Landing Page CMS — image upload + live preview)

### Modified Files
- `admin-panel/src/pages/LandingPage.tsx` — ImageField component (upload via /api/admin/settings/upload + paste URL + remove); heroImage field in Hero section; Live Preview toggle button opens side-by-side iframe that reloads after each save; "Open" external link button
- `src/pages/LandingPage.tsx` — Renders hero.heroImage (optional app screenshot) below CTAs if set; added heroImage to DEFAULT

---

## 2026-04-27 — Session 14 (Landing Page CMS — admin editable content)

### New Files
- `src/modules/landing/landing.controller.ts` — defaultContent constant, GET /api/landing-content (public), PUT /api/admin/landing-content (admin only), Prisma upsert
- `src/modules/landing/landing.routes.ts` — landingPublicRoutes + landingAdminRoutes
- `src/pages/LandingPage.tsx` — Full React landing page, fetches from API on mount, falls back to defaults if API fails
- `admin-panel/src/pages/LandingPage.tsx` — CMS editor: section sidebar (Nav/Hero/Problem/Hook Cards/Features/How It Works/Illustration/Campaigns/Final CTA/Footer), inline form fields, list editors with add/remove, unsaved indicator, Save + Preview buttons
- `prisma/migrations/20260427180615_landing_page_content/migration.sql` — LandingPageContent table

### Modified Files
- `prisma/schema.prisma` — Added `LandingPageContent` model (id="main" singleton, Json content)
- `src/app.ts` — Registered `/api/landing-content` (public) and `/api/admin/landing-content` (admin)
- `src/App.tsx` — Added `/landing` route → LandingPage
- `admin-panel/src/App.tsx` — Added `/landing-page` route → LandingPageCMS
- `admin-panel/src/components/Sidebar.tsx` — Added "Landing Page" nav item (Layout icon) under Configuration

---

## 2026-04-27 — Session 13 (Ask Nearby — smart availability broadcast from search)

### New Files
- `src/modules/ask-nearby/ask-nearby.service.ts` — Haversine radius search, product ILIKE filter, Socket.IO broadcast, yes/no respond, auto-message on yes
- `src/modules/ask-nearby/ask-nearby.controller.ts` — Input validation, hourly rate limit (5/user)
- `src/modules/ask-nearby/ask-nearby.routes.ts` — POST /send, POST /respond, GET /my-requests
- `prisma/migrations/20260426193554_ask_nearby/migration.sql` — AskNearbyRequest + AskNearbyResponse tables

### Modified Files
- `prisma/schema.prisma` — Added `AskNearbyRequest`, `AskNearbyResponse` models; relations on User + Store
- `src/app.ts` — Registered `askNearbyRoutes` at `/api/ask-nearby`
- `src/pages/Search.tsx` — Ask Nearby suggestion card after results; full bottom sheet modal (query, area toggle, radius slider, Nominatim geocoding for custom area, success state)
- `src/pages/Messages.tsx` — Socket listener for `ask_nearby_request` → Yes/No stock request cards; socket listener for `ask_nearby_confirmed` → toast + conversation refresh

### Socket Events
- `ask_nearby_request` → emitted to store owner's room: `{ requestId, responseId, query, customerName, areaLabel, radiusKm }`
- `ask_nearby_confirmed` → emitted to customer's room: `{ storeId, storeName, conversationId }`

---

## 2026-04-26 — Session 12 (AI features: photo-to-post, voice-to-post, AI store description)

### New Files
- `src/services/geminiVision.ts` — 3 Gemini 2.0 Flash functions: `analyzeProductImage`, `transcribeAndStructureVoice`, `generateStoreDescription`
- `src/modules/ai/ai.routes.ts` — `/api/ai/analyze-image`, `/api/ai/transcribe-voice`, `/api/ai/generate-store-description`
- `src/modules/ai/ai.controller.ts` — Auth-gated controller with per-user in-memory rate limiting (10/min image/voice, 5/min description)

### Modified Files
- `src/app.ts` — registered `aiRoutes` at `/api/ai`
- `src/pages/Profile.tsx` — New Post modal: "✨ AI se caption banao" button (photo→AI), voice recording (Mic button → MediaRecorder → transcription), AI suggestion card, imports `Sparkles/Mic/MicOff/useRef`
- `src/pages/RetailerDashboard.tsx` — Store bio field: "✨ AI se generate karo" button → bio + tagline suggestion card with "Bio use karo" and "Tagline copy karo" actions

### Behaviour
- All AI calls fire-and-forget; never block post creation
- Frontend compresses images >1200px via canvas before sending
- Hindi fallback messages on quota/error: "Thodi der baad try karo"
- Gemini calls logged with feature name + duration via pino logger

---

## 2026-04-26 — Session 11 (profile fixes: category, star rating, cover photo upload)

### Commit: fix: show category not year, star rating size, cover photo upload in edit profile

#### src/pages/StoreProfile.tsx
- Removed `sinceYear` — show `store.category` in badge row instead of "Since YYYY"
- Added StarRating (size=16) + numeric score directly beside store name (flex row)

#### src/pages/Profile.tsx
- Already showed category (no change needed for Fix 1)
- Added StarRating (size=16) + numeric score beside store name (same pattern)

#### Fix 3 (cover photo) — pending schema confirmation

---

## 2026-04-26 — Session 10 (bug fixes: status, products tab, search, chat suggestions + features: closing countdown, store-only search)

### Commit: fix: store status, remove products tab, search improvements, chat suggestions

#### src/lib/storeUtils.ts
- Added `color: 'green' | 'yellow' | 'red'` and `minutesUntilClose?` to `StoreStatus` interface
- "Closing in X mins" label + yellow color when store closes within 60 minutes
- Exported `statusColor()` helper to map color key → hex value (#F59E0B / #10B981 / #EF4444)

#### src/pages/Home.tsx, Map.tsx, Search.tsx, Profile.tsx, StoreProfile.tsx
- All status displays now use `statusColor(status.color)` — yellow badge for closing-soon stores
- Home.tsx: replaced hardcoded "Store is open" / "Store closed now" with `status.label`
- Map.tsx: replaced hardcoded "Open" / "Open now" / "Closed" with `sStatus.label` and proper color

#### src/pages/StoreProfile.tsx
- Removed "Products" tab from tab bar and its full panel content — only Posts + Reviews remain

#### src/pages/Search.tsx
- Removed product cards from search results — only store cards shown
- Removed price range filter and product-only sort options (Price ↑/↓)
- Results count now shows "X stores found"

#### src/modules/search/search.service.ts
- `performStandardSearch` + `performAISearch`: after fetching products, extract unique `storeId`s and lift matching stores into the stores array (deduped) — fixes "PS5 returns no stores" bug
- Added `console.log` showing match counts per query for debugging

#### src/pages/Messages.tsx
- Suggested stores filter: fetch limit=8, then exclude stores where `ownerId === currentUserId` — own store no longer appears in suggestions

---

## 2026-04-25 — Session 9 (Bulk Excel import with AI column mapping)

### Commit: feat: bulk Excel/CSV product import with AI column mapping

#### src/modules/stores/bulkImport.service.ts (new)
- `parseExcelFile(buffer)` — reads .xlsx/.xls/.csv via `xlsx` lib, returns headers + rows, enforces 1000-row limit
- `mapColumnsWithAI(headers, sampleRows)` — sends first 3 rows to Gemini 2.0 Flash, returns `ColumnMapping`; falls back to keyword matching if AI fails
- `checkRateLimit(storeId)` — Redis counter, max 5 bulk imports per store per day (86400s TTL)
- `importProducts(storeId, rows, mapping)` — upserts products (findFirst + update/create), fires embedding generation in background

#### src/modules/stores/store.routes.ts
- Added `xlsUpload` multer config (memory storage, 5 MB limit, .xlsx/.xls/.csv filter)
- Added `POST /:storeId/bulk-import` route (auth required)

#### src/modules/stores/store.controller.ts
- Added `bulkImport` handler — verifies ownership, checks rate limit, parses → maps → imports, returns `{ success, imported, skipped, mappingUsed, errors }`

#### src/pages/UserSettings.tsx
- Replaced broken `/api/products/upload` handler with new `/api/stores/:storeId/bulk-import`
- Added `importLoading` + `importResult` state
- New UI: spinner while AI reads file, success card showing count + detected column mapping + "View imported products" link
- File input now accepts .xlsx, .xls, .csv

---

## 2026-04-23 — Session 5 (UI redesign phase 1 — tokens, home, search)

### Commit: TBD — ui: premium redesign phase 1 (home + search)

#### src/index.css
- Added Dukanchi design token CSS variables (`--dk-bg`, `--dk-accent`, `--dk-surface`, etc.)

#### src/components/DukanchiLogo.tsx (new)
- 34×34 rounded square with `linear-gradient(135deg, #FF6B35, #FFA94D)`, Devanagari "द" in white

#### src/components/AppHeader.tsx (new)
- Sticky-ready header: DukanchiLogo + "Dukanchi / apna bazaar, apni dukaan" stacked text + NotificationBell

#### src/components/BottomNav.tsx (new)
- Extracted from App.tsx; 5 tabs (Home, Search, Map, Chat, Profile); active = filled orange, inactive = stroke gray
- Messages tab label changed to "Chat"

#### src/App.tsx
- Removed inline BottomNav; imports new BottomNav component; background uses `--dk-bg`

#### src/pages/Home.tsx
- Replaced header with AppHeader + LocationBar ("Showing stores near your area" + Change button)
- Tabs: For you / Following / Saved — dark pill active, transparent inactive
- Removed carousel banner entirely
- Post card: 38px orange-bordered circular avatar, open/distance/category status row, 4:5 black-bg contain image canvas, caption first-sentence-bold, orange Follow pill
- Action bar: Heart+count, Chat, Share2, spacer, Bookmark — no directions button
- Added geolocation + distance calculation for post card status row

#### src/pages/Search.tsx
- Header replaced with AppHeader; big heading "Kya dhoondh rahe ho?"
- New search input: `--dk-surface` bg, radius 14px, mic icon (orange, TODO)
- Trending near you: 4 chips (🔥 PS5, iPhone 15, perfumes, earbuds)
- Browse by category: 8-tile 4-col grid with emoji, colored bg/text per spec
- Recent searches: list with clock icon + per-item ✕ remove
- Results view preserved with Dukanchi design tokens

---

## 2026-04-22 — Session 4 (Phase 2 Zod validation)

### Commit: TBD — security: phase 2 zod input validation

#### Zod installed
**File:** `package.json` / `package-lock.json`
- `npm install zod`

#### validators/schemas.ts (new file)
- `signupSchema` — name (min 2), phone (10 digits), password (min 8), role enum
- `loginSchema` — phone (10 digits), password (min 1)
- `createPostSchema` — imageUrl (url), caption (max 500, optional), price (positive, optional), productId (uuid, optional)
- `updatePostSchema` — all of createPost fields but fully optional
- `createStoreSchema` — storeName (min 2), category, latitude/longitude (coerced numbers), address (min 5), phone (10 digits, optional)
- `createReviewSchema` — rating (int 1-5), comment (max 1000, optional), storeId/productId (uuid, optional)
- `sendMessageSchema` — receiverId (uuid), message (min 1, max 5000, optional), imageUrl (url, optional)
- `submitComplaintSchema` — issueType enum, description (min 10, max 2000)
- `submitReportSchema` — reason (min 5, max 500), reportedUserId/reportedStoreId (uuid, optional) ← schema only; POST /api/reports route not yet implemented
- `submitKycSchema` — documentUrl/selfieUrl (url), storeName (min 2), storePhoto (url, optional) — uses actual route field names (no kyc prefix) to avoid breaking existing API
- All schemas use `.passthrough()` so non-validated fields (storeId, ownerId, etc.) flow through to route handlers unchanged

#### validators/validate.ts (new file)
- `validate(schema)` middleware: runs `schema.safeParse(req.body)`; on failure returns `400 { error: 'Validation failed', issues: [...] }`; on success replaces `req.body` with parsed data and calls `next()`
- **Note:** Created at root `/validators/` (not `src/validators/`) since `src/` is the React frontend, not server code

#### server.ts — validate() applied to routes
- `POST /api/users` — added `validate(signupSchema)`; removed `if (!phone)` check
- `POST /api/login` — added `validate(loginSchema)`; removed `if (!phone || !password)` check
- `POST /api/posts` — added `validate(createPostSchema)`
- `PUT /api/posts/:id` — added `validate(updatePostSchema)`
- `POST /api/stores` — added `validate(createStoreSchema)`
- `POST /api/reviews` — added `validate(createReviewSchema)`; removed manual `Math.max(1, Math.min(5, ...))` clamp (Zod enforces 1-5); kept storeId/productId mutual-exclusion business logic checks
- `POST /api/messages` — added `validate(sendMessageSchema)`; removed `if (!receiverId || (!message && !imageUrl))` check
- `POST /api/complaints` — added `validate(submitComplaintSchema)`; removed `if (!issueType || !description)` check
- `POST /api/kyc/submit` — added `validate(submitKycSchema)`; removed `if (!documentUrl || !selfieUrl)` check

#### APP_DOCUMENTATION.md
- Added `Validation | zod` row to Backend tech stack table

---

## 2026-04-22 — Session 3 (Phase 1 security cleanup)

### Commit: TBD — security: phase 1 hardening

#### JWT_SECRET hardening
**File:** `server.ts`
- Removed fallback string `"your-super-secret-jwt-key-change-this"`
- If `JWT_SECRET` is missing from env or shorter than 32 characters, server now logs a fatal error and calls `process.exit(1)` immediately
- **Reason:** A hardcoded fallback secret means all deployments that forget to set the env var silently use the same predictable key, making JWTs forgeable

#### Admin credentials moved to environment variables
**File:** `server.ts` (`ensureAdminAccount()`)
- Removed hardcoded `ADMIN_PHONE = '8595572765'` and `ADMIN_PASSWORD = '12345678'`
- Now reads `process.env.ADMIN_PHONE` and `process.env.ADMIN_PASSWORD`
- If either is missing, logs a warning and skips seeding (no crash)
- Fallback phone string in catch block also updated to use the env var
- **Reason:** Hardcoded credentials in source code are visible to anyone with repo access

**File:** `.env.example`
- Added `ADMIN_PHONE=""` and `ADMIN_PASSWORD=""` entries with explanatory comments

#### Helmet security headers added
**File:** `server.ts`
- Installed `helmet` package
- Added `app.use(helmet({ contentSecurityPolicy: false }))` before `compression()` middleware
- `contentSecurityPolicy` disabled because CSP is already handled by Nginx in production
- **Reason:** Helmet sets ~14 HTTP security headers (X-Frame-Options, HSTS, X-Content-Type-Options, etc.) with one line

#### console.log gated behind NODE_ENV
**File:** `server.ts`
- Wrapped Redis adapter connection log in `if (process.env.NODE_ENV !== 'production')`
- Startup log (`Server running on...`) and all `console.error` calls left unchanged
- **Reason:** Verbose connection logs add noise in production log aggregators

#### seed.ts production warning
**File:** `seed.ts`
- Added comment at top: `// WARNING: Test data only. Do NOT run this script in production — it deletes all data.`
- **Reason:** Script starts by deleting all users, posts, stores — running it in production would be catastrophic

#### APP_DOCUMENTATION.md updated
**File:** `APP_DOCUMENTATION.md`
- Removed "Admin Credentials" section entirely (no credentials in docs)
- Added `ADMIN_PHONE` and `ADMIN_PASSWORD` to the Environment Variables section
- Added `helmet` row to the Backend tech stack table

#### Pre-existing TypeScript errors fixed
**File:** `server.ts`
- Added `as string` cast to two `JSON.parse(cached)` calls (Redis `get()` returns `string | Buffer` in types; we already check `if (cached)` so cast is safe)
- `npx tsc --noEmit` now passes cleanly

---

## 2026-04-21 — Session 2 (Google removal + documentation)

### Commit: a1dcb23 — chore: remove Google sign-up/login temporarily

**Files changed:**
- `src/pages/Login.tsx` — removed `useGoogleLogin` import, `handleGoogleLogin` function, Google button, "Or log in with phone" divider
- `src/pages/Signup.tsx` — removed `useGoogleLogin` import, `handleGoogleSignup` function, Google button, "Or continue with phone signup" divider
- `src/main.tsx` — removed `GoogleOAuthProvider` wrapper and `@react-oauth/google` import
- `server.ts` — commented out `/api/google-login` route

**Reason:** Google OAuth not needed for initial launch. Will be re-enabled in future if required. Users sign up/log in with phone + password only.

**To re-enable:** Restore the 4 files above, set `VITE_GOOGLE_CLIENT_ID` env var, and uncomment the `/api/google-login` route in `server.ts`.

---

## 2026-04-21 — Session 1 (Major feature + production readiness)

### Commit: 653547c — feat: major update — store members admin, KYC flow, post editing, bug fixes

#### KYC Flow Fix
**File:** `src/pages/Profile.tsx`
- Added `kycStatus`, `kycNotes`, `kycStoreName` state variables
- `fetchStoreData()` now fetches `/api/kyc/status` first, before fetching store data
- On app refresh, user now sees the correct screen:
  - `none` → show KYC form
  - `pending` → "Waiting for review" screen
  - `approved` → "Set up your store" prompt
  - `rejected` → rejection reason + re-submit option
- **Bug that was fixed:** After refresh, non-customer users with pending/approved KYC were seeing the blank "no store" state instead of the correct KYC status screen

#### Admin Store Members Page (new)
**File:** `admin-panel/src/pages/StoreMembers.tsx` (new file)
- Left panel: searchable list of all stores with owner name, role badge, member count (X/3)
- Right panel: selected store's admin card (amber, Crown icon) + team members list with delete button
- Delete member opens confirmation modal (no browser prompts)
- **APIs used:** `GET /api/admin/store-members`, `GET /api/admin/store-members/:storeId`, `DELETE /api/admin/team/:memberId`

**File:** `admin-panel/src/components/Sidebar.tsx`
- Added `UserCheck` icon import
- Added Store Members nav link after Stores

**File:** `admin-panel/src/App.tsx`
- Added StoreMembers import and `/store-members` route

#### Post Editing
**File:** `src/pages/Profile.tsx`
- Added edit state: `editingPost`, `editCaption`, `editPrice`, `editImage`, `editUploading`, `editShowCropper`, `editRawImageUrl`
- Added `openEditModal`, `handleEditImageUpload`, `handleSaveEdit` functions
- `handleSaveEdit` calls `PUT /api/posts/:id` with caption, imageUrl, price
- Edit button in post detail header for all posts
- Edit Post modal with ImageCropper for replacing the photo
- Pin/Delete buttons hidden on `isOpeningPost` posts

#### Post Order Fix
**File:** `src/pages/Profile.tsx`
- Sort order: `isOpeningPost` first → `isPinned` → `createdAt` desc
- Filter: `isOpeningPost` posts are exempt from the 30-day expiry filter
- **Bug fixed:** Opening post was disappearing from profile after 30 days

#### Chat Button Removed from Own Profile
**File:** `src/pages/Profile.tsx`
- Removed `MessageCircle` chat button from own post detail action row
- You can't chat with yourself

#### Chat Page Blank Fix
**File:** `src/pages/Chat.tsx`
- **Bug:** API response shape changed to `{ messages, hasMore, nextCursor }` but Chat.tsx was treating it as an array → blank render
- **Fix:** `Array.isArray(data) ? data : (data.messages ?? [])`
- Also replaced 3-second HTTP polling (`setInterval(fetchMessages, 3000)`) with Socket.IO real-time events
- Listens for `newMessage` event, filters by conversation participants
- Initial history loaded via HTTP fetch once on mount

#### Manage Posts Tab Fix
**File:** `src/pages/UserSettings.tsx`
- **Bug:** `/api/stores/:id/posts` returns `{ posts, total, page, totalPages }` not a plain array → blank tab
- **Fix:** `setManagePosts(Array.isArray(data) ? data : (data.posts ?? []))` with `?limit=100`
- Team members count: `Team Members ({teamMembers.length}/3)`
- Add Member button replaced with "Limit reached (3/3)" badge when at max

#### All Browser Prompts Removed
**Files:** `src/pages/Profile.tsx`, `src/pages/Support.tsx`, `src/pages/Home.tsx`, `src/pages/StoreProfile.tsx`, `src/components/KYCForm.tsx`, `admin-panel/src/pages/Posts.tsx`, `admin-panel/src/pages/Complaints.tsx`
- Removed all `alert()` and `confirm()` calls
- Replaced with `useToast` / `showToast` / `showConfirm` in-app modals

#### 3-Member Team Limit Enforcement
**File:** `server.ts`
- `POST /api/team`: checks `prisma.teamMember.count({ where: { storeId } })` before inserting
- Returns `400 "Maximum 3 team members allowed per store"` if limit reached

#### New Admin API Routes
**File:** `server.ts`
- `GET /api/admin/store-members` — all stores with owner + member count
- `GET /api/admin/store-members/:storeId` — store admin + members detail
- `DELETE /api/admin/team/:memberId` — remove a team member

#### New Post Edit API
**File:** `server.ts`
- `PUT /api/posts/:id` — edit post caption, imageUrl, price (owner auth required)

---

### Commit: 4a876b6 — perf: production-ready fixes for 100k users

#### PM2 Cluster Mode
**File:** `ecosystem.config.js` (new file)
- `instances: 'max'` — one worker per CPU core
- `exec_mode: 'cluster'` — all workers share port 3000
- `max_memory_restart: '1G'` — auto-restart if a worker leaks memory
- Socket.IO uses Redis adapter so cross-worker message delivery works correctly

#### Nginx Config
**File:** `nginx.conf` (new file)
- HTTP → HTTPS redirect (301)
- SSL with TLSv1.2/1.3, session cache
- `/uploads/` served directly by Nginx (30-day cache headers, no Node.js hit — ~10x faster)
- `/api/` proxied to Node.js with real IP forwarding
- `/socket.io/` WebSocket upgrade (`Upgrade: websocket`, 24hr read timeout)
- Admin subdomain (`admin.yourdomain.com`) serves `/admin-panel/dist`
- Gzip on for JSON, JS, CSS, SVG

#### Deploy Script
**File:** `deploy.sh` (new file)
- One-command setup on fresh Ubuntu 22.04
- Installs: Node.js 22, PostgreSQL 14, Redis, Nginx, Certbot, PM2
- Clones repo, runs `npm ci`, `prisma migrate deploy`, builds both frontends
- Configures Nginx, gets SSL certificate (Let's Encrypt), starts app with PM2

#### Redis Feed Cache
**File:** `server.ts`
- `GET /api/posts` discovery feed cached 30s: `feed:{role}:p{page}:l{limit}`
- Cache is invalidated when a new post is created

#### Redis Search Cache
**File:** `server.ts`
- `GET /api/search` cached 60s: `search:{role}:{query}`

#### Global Rate Limiter
**File:** `server.ts`
- `generalLimiter`: 300 req/min per IP applied to all `/api/*` routes
- Redis-backed — shared across all cluster workers and survives restarts

#### Console.log Cleanup
**File:** `server.ts`
- Removed per-connection/disconnect `console.log` from Socket.IO events (was logging thousands of lines/hour at scale)

---

### Commit: 8844238 — fix: auto-seed admin account on startup + fix admin panel login URL

#### Auto-seed Admin Account
**File:** `server.ts`
- Added `ensureAdminAccount()` function called in `startServer()`
- Upserts account with `id: PROTECTED_ADMIN_ID`, phone `8595572765`, password `12345678`, name `Mandeep`, role `admin`
- Uses bcrypt hash of password — even on a fresh database the admin account is always available
- **Problem solved:** On a fresh server after `prisma migrate deploy`, there was no admin account, making the admin panel unusable

#### Admin Panel Login URL Fix
**File:** `admin-panel/src/pages/Login.tsx`
- Changed hardcoded `http://localhost:3000/api/login` to `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/login`
- **Problem solved:** Admin panel couldn't log in on production because it was hitting localhost instead of the production API

---

## Template for future sessions

```
## YYYY-MM-DD — Session N (short description)

### Commit: abc1234 — type: short message

#### Feature/Fix Name
**File(s):** list of files changed
- What changed
- Why it was changed / what bug it fixed
```
## Migration to HttpOnly Cookies: Frontend refactoring complete
- Replaced localStorage manual token appending with `credentials: 'include'` across fetch calls.
- Updated AuthContext to verify sessions via `GET /api/me`.
- Removed all manual references to `localStorage.getItem('token')`.
- Updated Admin Panel Axios and fetch wrappers to use cookies.
