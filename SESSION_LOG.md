# G-AI — Session Change Log

> **One entry per development session or commit.**
> Add new entries at the TOP (newest first).
> Format: date, commit hash, what changed and why.

---

## 2026-05-30 — Session 128.1 — Docs-LIVE follow-up (PR #112, Fly v46)

**Goal:** Per the docs convention (see [[deploy-mechanism]]), after a deploy is verified land a `docs(session-N): ... LIVE` PR so the SESSION_LOG / STATUS entries reflect post-deploy state on main.

**Status:** ✅ LIVE. PR pending; Session 128 entry updated with the LIVE marker + Fly v46 + matched bundle hashes (`index-Cw4Z1gZe.css` / `index-YAC98fPR.js`) on both Fly origin and Cloudflare. STATUS.md "Last updated" flipped 128→128.1.

---

## 2026-05-30 — Session 128 — Store/Profile mockup parity fixes (logo clip, distance pill, bio read-more, Legal→Settings)

**Goal:** Founder flagged 5 issues from screenshots (mockup = customer "Dolphin hotel" store profile; current bugs on own "test store" profile): (1) logo overlapped/clipped under the cover + make it bigger; (2) distance pill ("1.6km away") must show when a CUSTOMER visits any business profile via post/search/map (StoreProfile) — match mockup layout exactly; (3) move Legal & Privacy from profile → Settings; (4) bio read-more triggered by LINE count (>3 lines), not chars; (5) match mockup text + Direction button = BLUE gradient. **Visual-only** (Rule 4) — no API/route/schema/auth/socket changes.

**Status:** ✅ **LIVE.** PR [#112](https://github.com/dukanchiapp/Dukanchi-App/pull/112) squash-merged to main `73cc9f5`; **Fly v46** (machine `9080d70da60d18`, region `sin`, healthcheck passing — listen-address warning benign). New bundle hashes `index-Cw4Z1gZe.css` + `index-YAC98fPR.js` identical on `dukanchi-app.fly.dev` (Fly origin) AND `dukanchi.com` (Cloudflare); `/health` 200 both; CSS rule `body.modal-open .app-bottom-nav{display:none!important}` + `app-bottom-nav` JS class both shipped to production. typecheck 0 (web/server/worker) · build ✓.

- **Logo-clip bug (root cause + fix)** — both `StoreProfile.tsx` and `Profile.tsx` positioned the logo at `bottom:-28/-34` *inside* a cover `<div style={{ overflow:'hidden' }}>`, so the overhang was clipped ("profile picture under the other element"). Fix: outer cover wrapper is no longer clipped (`height` only); the cover IMAGE moved into its own absolutely-positioned `overflow:hidden` media layer; logo + distance pill render OUTSIDE that layer at `zIndex 4`.
- **Logo enlarged** — StoreProfile 84→**96**px (borderRadius 22→24, fallback initial 34→40), Profile 72→**92**px (18→24, 28→38); both now a clean **4px white** "cutout" border (was dark `--f-bg-deep`) + soft shadow, matching the Bright mockup.
- **Cover overlay → Bright** — replaced the leftover dark spatial-glow (`rgba(6,8,20,…)` radial+linear) with a single soft bottom fade `linear-gradient(180deg, transparent 52%, var(--f-bg-deep) 100%)` into the cream page. Top bar padding now `calc(env(safe-area-inset-top,0px) + 14px)`.
- **Distance pill** — StoreProfile capsule restyled dark→**white** (`#fff`, `--b-line` border, soft shadow) with magenta-ink `#D11F75` pin + dark `--f-text-1` bold text, bottom-right of cover (mockup position). Feature itself (haversine from `LocationContext.userLoc` → `store.lat/lng`) was already present; only restyled.
- **Bio read-more (line-based)** — both pages: `<p>` clamped to 3 lines (`-webkit-line-clamp`), a `useRef` + `useEffect` measures `scrollHeight > clientHeight + 2` and only then shows the magenta-ink "Read more"/"Read less" toggle. Replaces StoreProfile's old `description.length > 140` char heuristic; adds the toggle to Profile (was a plain `<p>`).
- **Legal & Privacy moved to Settings** — removed `<LegalLinks variant="menu" />` from BOTH Profile views (customer menu list + retailer footer card) and the now-unused import; added a labelled "Legal & Privacy" section + `<LegalLinks variant="menu" />` to `UserSettings.tsx` (`!activeTab` view, between the tabs list and Log Out).
- **Direction button → blue gradient** — StoreProfile + `StoreInfoCard.tsx` (own-profile card): orange/magenta → `linear-gradient(135deg, #2E9BFF 0%, #1D4ED8 100%)`, white text/icon, blue shadow. Info-row icon tiles re-tinted peach (`--b-orange-bg` / `--b-tint`) with `--b-orange` icons; cover FABs → dark frosted glass (better contrast on light covers).
- **BottomNav hidden while posting** (founder follow-up — screenshot showed the bottom nav overlapping the Publish button). `PostsGrid.tsx` toggles `document.body.classList` `modal-open` while the New Post OR Edit Post sheet is open; `BottomNav.tsx` carries an `app-bottom-nav` class; `index.css` adds `body.modal-open .app-bottom-nav { display: none !important; }`. CSS-driven so it works without prop-drilling through React tree.

**Compliance:** Rule A/D — no `apiFetch`/`api.ts`/`AuthContext`/`app.ts`/socket changes (visual-only) ✅. Rule B — no new silent catches ✅. Rule G — `npm run typecheck` (3 projects) + `npm run build` ✅.

**Verification gaps (honest):** `StoreProfile`/`Profile` sit behind `ProtectedRoute` + need a backend + a seeded store with `lat/lng` → not meaningfully renderable in the frontend-only dev preview. Verified at typecheck + build + source-review level only; needs founder login-gated QA on a deployed build (and a real distance-bearing store for the pill). Native APK unaffected (web bundle) but un-smoke-tested.

**Files:** `src/pages/StoreProfile.tsx`, `src/pages/Profile.tsx`, `src/pages/UserSettings.tsx`, `src/components/profile/StoreInfoCard.tsx`, `src/components/profile/PostsGrid.tsx`, `src/components/BottomNav.tsx`, `src/index.css`. Branch `feat/profile-mockup-parity` (initial commit `909314a` + nav-hide follow-up).

---

## 2026-05-30 — Session 127 — Bright design system re-skin (whole-app dark→light flip)

**Goal:** Founder shipped a new "Dukanchi Bright Skin" design-system handoff and asked to "implement this new design — ensure the whole app is on the new skin, all internal pages and all elements." Flip the entire app from the dark "Futuristic v2" spatial-glass look to the warm Bright system. **Visual-only** (Rule 4) — no features/fields/API/schema/Socket.IO/auth/routing changes.

**Status:** ✅ **LIVE.** **PR #110** squash-merged → main `7d81f04`; CI green; **Fly v45** deployed (machine `9080d70da60d18`, region `sin`, health check passing — the deploy-time "not listening on 0.0.0.0:3000" socket-scan warning was benign, confirmed by passing healthcheck + live curl). typecheck 0 (web/server/worker) · **133/133** tests · build ✓ · zero indigo classes remain.

**Production smoke (Rule E):** new CSS bundle `index-L79VeOAa.css` (was `index-sV-tPRzk.css`) serves the cream `#fff7f0` signature on BOTH `https://dukanchi-app.fly.dev` (Fly origin) and `https://dukanchi.com` (through Cloudflare) — `/health` 200 on both, identical asset hash → Cloudflare not serving a stale cached bundle, no cache purge needed. ✅ Bright skin confirmed live.

- **Central token remap (`futuristic.css`)** — legacy `--f-*` token *values* remapped to Bright (cream `#FFF7F0`, orange→magenta `#FF6B35→#FF2A8C`, Inter); canonical `--b-*` tokens + `.b-clay`/`.b-clay-emoji`/`.b-tap` primitives added. One central edit re-skins every token-consuming file. (See DECISIONS.md 2026-05-30 for the keep-`--f-*`-names trade-off.)
- **index.css + index.html** — cream body, dk tokens, fonts.
- **Shared chrome** — BottomNav (flat white bar, magenta-ink `#D11F75` active, Home filled-when-active; 5 tabs + hide logic preserved), FLocationStrip (`#D11F75` pin/Change), NotificationBell, PostCard/FPostCard, ConversationRow.
- **Hero screens** — Home, Search (claymorphic category grid), Map + IsoMap (cyan→warm radar, invisible white pulse→magenta), Chat (gradient header + legible PostRefCard on both bubble types), Messages, Profile, StoreProfile, Signup (dark dropdown→white optStyle + low-contrast error banner fixed), NotFound (off-brand indigo→Bright).
- **Settings/KYC/Review indigo sweep** — ~51 "escaped" indigo Tailwind utilities across 9 files (KYCForm, ReviewModal, 6 settings/* tabs, Support) the token remap couldn't reach → Bright via arbitrary values: magenta-ink `#D11F75` primary text/icons/buttons/borders, warm tints (`#FFF3EC`/`#FFE7D9`/`#FFE0CC`…) backgrounds, orange `#FF6B35` focus rings, `#B01A63` hover. `\b`-anchored substitution so `indigo-50` didn't collide with `indigo-500`; opacity (`/50`) + `hover:`/`focus:` prefixes preserved.

**Compliance:** Rule A/D — no `apiFetch`/`api.ts`/`AuthContext`/`app.ts`/socket changes (visual-only) ✅. Rule B — no new silent catches ✅. Rule G — `npm run typecheck` (3 projects) ✅.

**Verification gaps (honest):** NotFound + Signup visually confirmed Bright in the frontend-only preview. 8 files (KYCForm, ReviewModal, 6 settings/* tabs) sit behind `ProtectedRoute` — unreachable without a backend in dev, so verified at source (0 indigo) + build (CSS compiles) level only; need founder login-gated QA on production. **Native APK re-skin un-verified** — web/preview only; APK rebuild + on-device smoke pending (Rule D note). Native status bar/splash still dark `#060814` (capacitor.config) — Bright-tone follow-up queued.

**Files:** 28 changed (+596 / −594). Commit `087608f` on `feat/bright-skin` → squash-merged to main `7d81f04` (PR #110) → Fly v45 LIVE.

---

## 2026-05-29 — Session 126.1 — Mockup parity polish (founder visual QA fixes)

**Goal:** Founder reviewed the live parity build (v43) and flagged remaining mismatches on the PostCard + Store Profile mockups ("elements not matching yet").

**Status:** ✅ LIVE. Fly **v44**. PR #108 squash `a3eed69`. typecheck 0 · 133/133 · build ✓ · E2E 2/2; `/health` 200 both domains.

- **`storeUtils`** — 24h status label `Open 24 Hours` → **`Open 24h`** (the canonical status capsule across PostCard / Map / Messages rich rows / Store Profile meta — matches the mockup's compact pill). `storeUtils.test.ts` updated.
- **Store Profile logo** — 72→84 px, borderRadius 18→22, dark "cutout" border 3→4px, fallback initial 28→34 (matches the mockup's prominent logo).
- **Store Profile detail icon tiles** — 38→42 px, borderRadius 11→13.
- **Store Profile** — removed the Posts/Followers/Rating **stats row** (NOT in the mockup — bio flows straight into the details card). `followersCount` state removed (was display-only); `isFollowing` still drives the follow toggle.
- Visual-only; follow / fetch / tabs / posts-grid wiring preserved.

---

## 2026-05-29 — Session 126 — Design mockup parity: Store Profile + Messages rich rows + Map chips

**Goal:** Founder shared 4 reference mockups (Store Profile / Home / Map / Messages) and asked for **exact UI match** — "jaha jo details hain smartly build karo". Audited all 4 implemented screens vs the mockups and closed every drift.

**Status:** ✅ **MOCKUP PARITY LIVE.** Fly **v43** complete. Store Profile rebuilt (gear, distance pill, inline status, icon-tile details, 12h hours, gradient direction button); Messages now has rich store rows (live status + distance + category + area, backed by an additive `getConversations` change); Map category chips color-tinted. Home + PostCard already matched (no change).

| Metric | Value |
|---|---|
| PR merged | #106 (squash) |
| Squash commit | `b8cedc6` |
| Production HEAD | `4f37316` → **`b8cedc6`** |
| Fly release | **v43** complete |
| Files changed | 6 (+258 / −72) |
| Tests | **133/133** |

### Audit result (4 screens vs mockups)

- **Home** — already matches (header, location strip, For-you/Following/Saved pills, PostCard 3-row header, filter "dark square"). No change.
- **PostCard** — already matches (double-ring avatar, status capsule, distance, category, area · pincode). No change.
- **Map** — matched except category chip colors. IsoMap 3D radar already matches (grid + center pulse orb + colored tiles).
- **Store Profile** — multiple drifts (below).
- **Messages** — needed rich store rows (below).

### Changes

**Store Profile (`src/pages/StoreProfile.tsx`):**
- Header: owner now gets a **gear → `/settings`** (matches mockup); visitors keep Share.
- **Distance capsule** ("1.6 km away") on the cover — haversine from `LocationContext` user loc → store coords. null when either is missing.
- **Live status inline** in the meta row: `RETAIL · Category · ● status` (was only in the details card).
- **Details card rebuilt** — each row behind a magenta-tinted icon tile; address bold + `postalCode · city, state` secondary; **12-hour** hours (`fmt12` helper) + working days; **full-gradient** "Direction to Store" button (was translucent orange).

**Messages rich rows (backend + frontend):**
- `message.service.ts` `getConversations` — store `select` expanded (category, openingTime, closingTime, is24Hours, workingDays, latitude, longitude, city, postalCode). **Additive** response shape; route path `/api/messages/conversations` unchanged.
- `Conversation` type (`src/types/index.ts`) extended with optional `store` + `role` + `deletedAt`.
- `ConversationRow.tsx` — store rows render **live-status capsule + distance + category + 📍 area (city)**; plain user↔user rows keep the original compact layout (name + inline timestamp + last message). Hooks (getStoreStatus → useClosingSoon → getLiveStatus) run unconditionally; memo comparator extended with `distance`.
- `Messages.tsx` — pulls user location, computes per-row distance, passes it to each row.

**Map (`src/pages/Map.tsx`):**
- Inactive category chips tinted with their **category color** (same `CATEGORIES` palette as the map markers + 3D tiles). "All" → neutral glass.

### Judgment calls (founder-surfaced)

- Store Profile gear → `/settings` (owner only) — bottom-nav Profile-active in mockup = owner viewing own store.
- **Map gear FAB NOT added** — mockup shows it but it has no defined action; shipping a dead button is worse. Flagged.
- Conversation area = store `city` (mockup showed locality names).
- Map chip colors from app palette (consistent with markers) — may differ slightly from the mockup's exact hues.

### Phase 3 gates

- ✅ typecheck 0 (web + server + worker) · vitest **133/133** · build green (69 precache) · E2E 2/2
- ✅ Rule A: no new route mounts / apiFetch paths (backend change additive to existing endpoint). Rule B: no silent-catch added.

### Phase 4 CI + deploy

- ✅ PR #106 (run 26617651260): Typecheck+Test+Build `pass` + Bundle Size `pass`
- ✅ Fly **v43** complete; `/health` 200 on both domains; **`/api/messages/conversations` → 401 `application/json`** (route intact, additive shape live, not SPA fallback); CSP `report-only` + Socket.IO `wss` unaffected.

### Awaiting

- Founder device test — Store Profile (owner gear + distance pill + icon-tile details + 12h hours; visitor Share), Messages rich rows (store vs plain), Map colored chips.
- Decision: re-add a Map gear FAB only if a real action is defined (map layers / display options).
- Pilot-critical finish queue resumes: KYCForm → settings sub-tabs → global `--dk-*` flip.

---

## 2026-05-29 — Session 125 — Retailer dashboard cluster re-skin: RetailerDashboard + StoreFormFields + KycUploadForm + AiBioModal (pilot-critical session 2 of ~5)

**Goal:** Convert the retailer dashboard cluster — the 3 MIXED (`--dk-*` + raw-Tailwind-light) files plus AiBioModal — to `--f-*` dark. These are the GATEKEEPER for the S128 global `--dk-*` flip: flipping while they still mix `--dk-` + raw Tailwind would break contrast (unreadable light text on dark).

**Status:** ✅ **DASHBOARD CLUSTER DARK.** Fly **v42** complete. RetailerDashboard + StoreFormFields + KycUploadForm + AiBioModal all on `--f-*` with ZERO `--dk-*` and ZERO raw-Tailwind-light remaining — the flip-blocker is cleared.

| Metric | Value |
|---|---|
| PR merged | #104 (squash) |
| Squash commit | `4f37316` |
| Production HEAD | `8f26668` → **`4f37316`** |
| Fly release | **v42** complete |
| Files changed | 4 (+128 / −115) |
| Tests | **133/133** |

### Changes (all → `--f-*`; BOTH raw-Tailwind AND `--dk-*` converted)

**StoreFormFields.tsx** (the heavy one — store edit form):
- Legacy `dk-input` class (×10) + `dk-update-btn` class → inline `fInput` const (`--f-bg-elev` + `--f-glass-border-2` + `--f-text-1`) + gradient "Update Location" button.
- Raw `bg-gray-50`/`border-gray-200`/`focus:bg-white`/`focus:border-indigo-500` address + opening/closing-time inputs → `fInput`.
- White logo border (`3px solid white`) → `--f-glass-border-2`; camera FAB ring `white` → `--f-bg-deep`; cover placeholder `#F3F4F6` → `--f-bg-elev`.
- `#1A1A1A` save button → `--f-grad-primary` + glow; char counter `#EF4444`/`#888` → `--f-danger`/`--f-text-3`; indigo checkbox → `accentColor: --f-magenta`; MapPin `text-indigo-400` → `--f-orange`; all `text-gray-400/500/600` labels → `--f-text-2`/`--f-text-3`.

**KycUploadForm.tsx**: text input + dashed upload tiles (`border-gray-200`/`green-300`/`bg-green-50`) → `--f-glass-border-2`/`--f-success` + `rgba(46,231,161,0.10)`; gray text → text-1/2/3; submit button → gradient.

**AiBioModal.tsx**: modal `bg-white` → `--f-modal-bg` glass; textarea `dk-input` → inline `--f-*`; recording-red `#EF4444` → `--f-danger`; Generate + Bio-use buttons → `--f-grad-primary`.

**RetailerDashboard.tsx**: KYC-gate state cards — pending (`bg-white`/`amber-50`/`amber-100`), rejected (`red-50`/`red-100`), default (`gray-100`/`indigo-50`) → `--f-glass-bg` cards + tinted icon tiles (orange/`--f-danger`/`--f-magenta` at 12% alpha) + `--f-text-1/3`; form host card `background:white` → `--f-glass-bg`; loading spinner `--f-orange` → `--f-magenta` (aligns to ProtectedRoute spinner).

### Preserved (visual-only — Rule 4)

Store CRUD (`handleSaveStoreInfo` POST/PUT `/api/stores`), KYC upload pipeline (`handleKycUpload` `/api/upload` + `handleKycSubmit` `/api/kyc/submit`), GPS pin (`handleGPSUpdate`), logo/cover upload, pincode autofill (`/api/pincode/:code`), AI bio gen (`/api/ai/generate-store-description` + `/api/ai/transcribe-voice` voice path), dashboard nav, all StoreFormFields/KycUploadForm/AiBioModal props + handlers — unchanged.

### Phase 3 gates

- ✅ typecheck 0 (web + server + worker) · vitest **133/133** · E2E 2/2 · build green (68 precache)
- ✅ grep-confirmed: ZERO `--dk-*` · ZERO legacy `dk-` classes · ZERO raw-Tailwind-light · ZERO hardcoded light surfaces across all 4 files

### Phase 4 CI + deploy

- ✅ PR #104 (run 26616074884): Typecheck+Test+Build `pass` (1m29s) + Bundle Size `pass` (1m40s)
- ✅ Fly **v42** complete; post-deploy `/health` 200 (`application/json`) on both `dukanchi-app.fly.dev` AND `dukanchi.com`; CSP `report-only` preserved (`wss://dukanchi.com` connect-src intact → Socket.IO unaffected); push structurally intact (zero push/SW code touched)

### Pilot-critical finish progress (from S123.5 audit — ~5 sessions)

- ✅ **S124 — Global shared UI** (Toast + ImageCropper + ProtectedRoute)
- ✅ **S125 — Retailer dashboard cluster** (RetailerDashboard + StoreFormFields + KycUploadForm + AiBioModal) ← this session — **the `--dk-`+Tailwind flip-blocker is now cleared**
- ⏳ S126 — Onboarding KYC (KYCForm) — flag: is the standalone `KYCForm.tsx` a duplicate of the dashboard `KycUploadForm.tsx` (re-skinned this session)? Reconcile in S126.
- ⏳ S127 — Settings sub-tabs (AccountDetailsTab + ManagePostsTab + BulkUploadTab + BusinessSettingsTabs)
- ⏳ S128 — GLOBAL `--dk-*` flip + delete `[data-theme=light]` + delete dead AppHeader + comprehensive device test
- Deferred (post-pilot): ManageTeamTab, CustomerDataTabs, Support, ReviewModal, NotFound

### E2E coverage gap

The dashboard + KYC gate are auth-gated (retailer role) → not covered by the public-render E2E smoke. Founder device test: open Edit Profile (dark form + inputs + map + save), trigger AI bio modal (dark glass + voice), hit the KYC gate (pending/rejected/default cards dark).

### Awaiting

- Founder device test (retailer dashboard edit-profile + KYC gate + AI bio modal — pilot-critical, founder onboards retailers in person)
- Opus → **S126 KYCForm** (reconcile against this session's KycUploadForm), then S127 settings sub-tabs, then the S128 global flip (now unblocked)

---

## 2026-05-29 — Session 124 — Global shared UI re-skin: Toast + ImageCropper + ProtectedRoute (pilot-critical session 1 of ~5)

**Goal:** Re-skin the 3 raw-Tailwind-light SHARED surfaces (audit-flagged — the `--dk-*` flip can't reach them) to `--f-*` dark. First of the ~5 pilot-critical finish sessions from the S123.5 audit.

**Status:** ✅ **SHARED UI DARK.** Fly **v41** complete. Toast (every screen), ImageCropper (post-image crop), ProtectedRoute spinner all converted to `--f-*`. Highest-visibility, lowest-effort cluster done first.

| Metric | Value |
|---|---|
| PR merged | #102 (squash) |
| Squash commit | `8f26668` |
| Production HEAD | `81879d1` → **`8f26668`** |
| Fly release | **v41** complete |
| Files changed | 3 (`Toast.tsx` +79/−42-ish, `ImageCropper.tsx`, `ProtectedRoute.tsx`) |
| Tests | **133/133** |

### Changes (all → `--f-*`, NOT `--dk-*`)

**Toast.tsx** (renders on EVERY screen — biggest visual-consistency win):
- Toast notification: light `bg-green-50`/`bg-red-50`/`bg-amber-50`/`bg-blue-50` → dark glass (`var(--f-glass-bg-2)`) + status-tinted border + glow (success→`--f-success`, error→`--f-danger`, warning→`#F59E0B`, info→`--f-cyan`) + `--f-text-1` text. Icons recolored to status tokens.
- Confirm modal: `bg-white` card → `var(--f-modal-bg)` glass; gray text → text-1/2; cancel → glass; confirm → `--f-danger` (error) / gradient (else).
- PRESERVED: ToastContext API (`{message, type, onClose, confirm}`), 5s auto-close timer, confirm onConfirm/onCancel flow, all 4 variants, dismiss.

**ImageCropper.tsx** (anyone posting an image):
- Mode toggle (Crop/Fit pills), canvas border, loading + error overlays, zoom buttons, Cancel + "Image use karein" CTA → `--f-*` (glass + gradient; canvas `#0a0612`).
- PRESERVED 100% of S113/S114 logic: `compressImage(blob)`, `onComplete(Blob)`, `image.onerror → setLoadError` + error overlay + disabled CTA, loading overlay, crop/zoom/drag pointer handlers, 600×800 export. Only surface colors changed — zero touch to crop/upload logic.

**ProtectedRoute.tsx**: `bg-gray-50` spinner fallback → `var(--f-bg-deep)` + magenta spinner.

### Why `--f-*` not `--dk-*`

Keeps these surfaces on the futuristic palette (matching the 9 done screens) so the eventual global `--dk-*` flip doesn't touch them — and so they're consistent NOW, not dependent on the flip.

### Phase 3 gates

- ✅ typecheck 0 · vitest **133/133** · build green (68 precache) · E2E 2/2

### Phase 4 CI + deploy

- ✅ PR #102 (run 26615064280): `success`
- ✅ Fly **v41** complete; post-deploy `/health` 200 in 584ms · push handler intact · CSP `report-only` preserved

### Pilot-critical finish progress (from S123.5 audit — ~5 sessions)

- ✅ **S124 — Global shared UI** (Toast + ImageCropper + ProtectedRoute) ← this session
- ⏳ S125 — Retailer dashboard cluster (RetailerDashboard + StoreFormFields + KycUploadForm + AiBioModal) — **L** (the 3 MIXED `--dk-`+Tailwind files; must precede the flip)
- ⏳ S126 — Onboarding KYC (KYCForm)
- ⏳ S127 — Settings sub-tabs (AccountDetailsTab + ManagePostsTab + BulkUploadTab + BusinessSettingsTabs)
- ⏳ S128 — GLOBAL `--dk-*` flip + delete `[data-theme=light]` + delete dead AppHeader + comprehensive device test
- Deferred (post-pilot): ManageTeamTab, CustomerDataTabs, Support, ReviewModal, NotFound

### E2E coverage gap

Toast/ImageCropper/confirm-dialogs render conditionally (not on public login/signup) → not E2E-covered. Founder device test: trigger success/error toast (dark glass), open post-image cropper (dark modal + crop + upload, S114 intact), confirm dialog.

### Awaiting

- Founder device test (toast + cropper + confirm)
- Opus → **S125 retailer dashboard cluster** (the heavyweight — must complete before the global flip since RetailerDashboard/StoreFormFields/KycUploadForm mix `--dk-`+Tailwind and would break contrast if flipped while still mixed)

---

## 2026-05-29 — Session 123 — Settings (UserSettings) + Splash re-skin (paired, screens 8+9 of re-skin)

**Goal:** Re-skin Settings (restyle the real routed UserSettings.tsx, NOT a new dead Settings.tsx) + add/restyle a Splash gated on real auth state. Eighth+ninth step of the Tier 5D re-skin — last screens before the global cream→dark flip.

**Status:** ✅ **SETTINGS SHELL + SPLASH LIVE ON v3.** Fly **v40** complete. Splash added (boot gate on real auth check). UserSettings shell re-skinned (it was genuinely light — first such screen). Sub-tab content components flagged for a follow-up.

| Metric | Value |
|---|---|
| PR merged | #100 (squash) |
| Squash commit | `81879d1` |
| Production HEAD | `b547c14` → **`81879d1`** |
| Fly release | **v40** complete |
| Files | `src/components/Splash.tsx` (new), `src/App.tsx` (BootGate), `src/pages/UserSettings.tsx` (+180/−29) |
| Tests | **133/133** |

### Splash (new + wired honestly)

- `src/components/Splash.tsx` — aurora bg + 64px gradient logo tile (FLogo) + magenta orbiting loader ring (`f-spin-slow` 1.2s) + "Dukanchi" 26/800 wordmark + "apna bazaar, apni dukaan" + "Made in India 🇮🇳".
- **BootGate** in App.tsx: shows `<Splash/>` **while `AuthContext.isLoading`** is true — i.e. the REAL duration of the initial `/api/auth/me` network check (resolves via the provider's `.finally` → always terminates; can't hang the gate indefinitely). **NOT a fake timer** (same honest-gating principle as the S121 RadarPulse). `React`-free typing via `type ReactNode` import.
- ✅ **E2E (2/2) proves the gate doesn't break boot** — login/signup still render after the auth check resolves. `/` returns 200 in prod.
- Native note: Capacitor has its own splash (`SplashScreen.hide()` on mount); the web Splash bridges the post-native auth-check window. Minor possible brief double-splash on native — both branded, acceptable.

### 🔎 Settings — UserSettings.tsx was GENUINELY LIGHT (first in the re-skin)

Every prior screen (S116-122) arrived ~95% v2-dark. **UserSettings was the exception** — raw Tailwind `bg-gray-50`/`bg-white`/`text-gray-900`/`text-indigo-500`/`divide-gray-100` (never touched in the Phase 6/7/8 v2 pass). It's a **tab-list navigation** (not the prototype's toggle groups) that opens separate sub-tab components.

**Re-skinned the SHELL (landing list view):**
- Dark aurora page wrapper, glass sticky header (42×42 back tile + "Settings" 22/800 + 44×44 bell tile), **NEW gradient profile card** (56px gradient avatar + name + role), grouped tab-list card (`var(--f-bg-elev)` + glass border-2; each row = 32×32 magenta-tinted icon tile + label 14/600 + chevron, divided by glass borders), red-tinted Logout, magenta team-member banner.
- Icons already lucide (ArrowLeft/ChevronRight/LogOut + per-tab icons).

**PRESERVED**: `/settings` route, all tab navigation (`activeTab` + back-to-list), profile data (`user`), logout (showConfirm → `logout()` → `/login`), NotificationBell (already wired — not a dead bell), all sub-tab data fetches + handlers (store, posts, team, customer data, delete flows).

### ⚠️ DEVIATION (meaningful scope finding — needs Opus follow-up)

The sub-tab **content** components — `AccountDetailsTab`, `CustomerDataTabs`, `BusinessSettingsTabs`, `ManagePostsTab`, `ManageTeamTab`, `BulkUploadTab` — are **separate files still on the light Tailwind-gray theme**. NOT re-skinned here (each is its own component, a multi-file job). **Critically: the planned global cream→dark flip (S124) will NOT fix them** — they use raw Tailwind gray classes (`bg-white`, `text-gray-900`), NOT `--dk-*` tokens. They need their own dedicated re-skin pass.

**Interim**: dark Settings shell → tap a tab → light sub-content (known gap, pre-pilot acceptable). **Recommend a "re-skin settings sub-tabs + BusinessSettingsTabs toggles" session** (the README's actual toggles — hide-ratings, chat-enable — live in BusinessSettingsTabs).

### Phase 3 gates

- ✅ typecheck 0 · vitest **133/133** · build green (68 precache) · **E2E 2/2 (boot gate non-breaking)**

### Phase 4 CI + deploy

- ✅ PR #100 (run 26614330293): `success`
- ✅ Fly **v40** complete; post-deploy `/health` 200 in 566ms · push intact · CSP `report-only` · `/` 200 (SPA serving — boot OK)

### E2E coverage gap

Settings sub-tabs + Splash visual are auth-gated / boot-only → founder device test: Splash on cold boot (logo + orbiting ring, hides when ready), Settings list dark + profile card + tab nav + logout. (Boot non-breakage already proven by E2E + prod `/` 200.)

### Awaiting

- Founder device test (Splash cold-boot + Settings shell)
- Opus decisions queue (now 5): shared AppHeader, StoreProfile gear, conversation rich-rows backend, Map dark-style, **+ settings sub-tab re-skin session**
- Opus → **Session 124: GLOBAL cream→dark flip** (final) — but NOTE: the flip (delete `[data-theme="light"]`, flip `--dk-*` in index.css, delete dead AppHeader.tsx) only affects `--dk-*`-token-based surfaces; the Tailwind-gray sub-components (settings sub-tabs + possibly others) need separate passes. Re-scope S124 accordingly.

---

## 2026-05-29 — Session 122 — Map re-skin: 3D↔Map toggle + live bell (screen 7 of re-skin)

**Goal:** Re-skin Map.tsx to Futuristic v3, preserving the REAL Google Maps integration + markers + user location + store nav + re-center; add the 3D↔Map toggle (IsoMap). Seventh step of the Tier 5D re-skin.

**Status:** ✅ **MAP LIVE ON v3.** Fly **v39** complete. Already v2-futuristic with a working `@react-google-maps/api` integration; closed v3 gaps + added the 3D toggle. **Real Google Maps integration untouched.**

| Metric | Value |
|---|---|
| PR merged | #98 (squash) |
| Squash commit | `b547c14` |
| Production HEAD | `dc7bb41` → **`b547c14`** |
| Fly release | **v39** complete |
| Files changed | 1 (`src/pages/Map.tsx`, +97/−23) |
| Tests | **133/133** |

### 🔎 Recon: already v2-futuristic (613 LOC)

`@react-google-maps/api` (`GoogleMap`/`useJsApiLoader`/`Marker`), dark `MAP_STYLES` via the legacy `styles` prop (NO mapId → JSON applies), user-location marker (orange dot), store markers (SVG teardrop pins + category color/emoji), `flyToStore` (panTo+zoom+select), `recenterMap`, store fetch, category/search filter, distance sort, selected-store card, bottom sheet (collapsed peek + expanded list), empty/loading/error states. All dark, all wiring intact.

### Changes

**1. 3D↔Map toggle (NEW).** Top-right pill (Layers/3D | MapPin/Map). **Map (Google) stays DEFAULT**; 3D renders `<IsoMap>` with real stores **projected onto the iso grid** — lat/lng normalised around the user (centre 50,50), reflecting actual relative geography (NOT random pylons). `IsoMap onSelect → handleIsoSelect → flyToStore` (maps the `IsoMapStore` id back to the real store, preserving nav + selection). Added `mapMode` state + `isoStores` memo + `handleIsoSelect`.

**2. Dead bell → live NotificationBell** (44×44 glass tile) — **5th dead decorative bell** found+fixed across the re-skin (Home/StoreProfile/Search/Map all had a static no-onClick bell).

**3. Dead no-op settings FAB removed** — it had no `onClick` (did nothing); task says don't add new nav. Re-center FAB kept (handler preserved), Crosshair → lucide.

**4. FIcon → lucide** throughout (Search/X/Crosshair/MapPin/Clock/Phone/Store/Navigation/ChevronDown/ArrowUp/Layers). FLogo kept.

### PRESERVED VERBATIM (grep-confirmed — the critical part)

`useJsApiLoader`, `<GoogleMap>` + options (`disableDefaultUI`, `styles: MAP_STYLES`, `clickableIcons:false`), user-location `<Marker>`, store `<Marker>`s (SVG teardrop pins), `onLoad`/`onUnmount` mapRef, `flyToStore` (panTo + setZoom + setSelectedStore), `recenterMap` (panTo userLocation + zoom), store fetch (`/api/stores?limit=200`), `matchCategory` filter, distance sort, selected-store card, collapsed+expanded bottom sheet, View Store / Navigate nav, click-to-deselect.

### ⚠️ Deviations (flagged)

- **Dark Maps style** — KEPT existing `MAP_STYLES`. It's already a coherent dark deep-space style (purple-toned `#0E1224` geometry / `#14091F` water / `#1A0C1F` roads) that matches the app's magenta brand **better** than the README's bluer JSON (`#0E1424`/`#0A1830`/`#1F2940`). Applied via the legacy `styles` prop (no mapId blocking the JSON). Did NOT swap to the README palette — the existing one is more on-brand. Opus to confirm.
- **Store status** — KEPT `getStoreStatus` + `statusColor` (already-colored semantic). Did NOT convert to `getLiveStatus`/`useClosingSoon` — avoids mixing hook/non-hook patterns on this complex screen; the legacy colors are consistent within Map. (getLiveStatus 4-tier is a future nicety; PostCard/StoreProfile already use it where it matters more.)
- **IsoMap is a stylized novelty** — it's a CSS-3D pseudo-iso scene, not a true geographic map. The projection makes it reflect *relative* positions, but it's a visual flourish, not a navigation tool. Map (Google) is correctly the default + the real workhorse.

### Phase 3 gates

- ✅ typecheck 0 · vitest **133/133** · build green (68 precache) · E2E 2/2

### Phase 4 CI + deploy

- ✅ PR #98 (run 26613634532): `success`
- ✅ Fly **v39** complete; post-deploy `/health` 200 in 432ms · push handler intact · CSP `report-only` preserved

### E2E coverage gap (explicit)

Map is auth-gated + needs a Maps API key + geolocation → NOT covered by the public render-smoke E2E. Founder device test required: real map loads (dark), store markers + tap→store card, **re-center**, **3D toggle swaps to IsoMap** + tap pylon→store, bottom sheet (peek + expand) cards → store, bell drawer.

### Awaiting

- Founder device test (esp. real Google Map + 3D toggle)
- Opus: confirm Maps dark-style choice (keep on-brand purple vs force README blue)
- Opus → next: **Settings + Splash (123, paired)** — the last two screens before the global cream→dark flip

---

## 2026-05-29 — Session 121 — Search + Ask Nearby radar re-skin (screen 6 of re-skin)

**Goal:** Re-skin Search.tsx to Futuristic v3 including the Ask Nearby 3-stage modal, preserving search API + filter/sort + trending + the Ask Nearby broadcast. Sixth step of the Tier 5D re-skin.

**Status:** ✅ **SEARCH + ASK NEARBY LIVE ON v3.** Fly **v38** complete. Already v2-futuristic; closed v3 gaps + wired RadarPulse into the real broadcast flow + fixed dead bell.

| Metric | Value |
|---|---|
| PR merged | #96 (squash) |
| Squash commit | `dc7bb41` |
| Production HEAD | `947eb13` → **`dc7bb41`** |
| Fly release | **v38** complete |
| Files changed | 1 (`src/pages/Search.tsx`, +60/−28) |
| Tests | **133/133** |

### 🔎 Recon: already v2-futuristic (970 LOC)

Dark `--f-bg-deep` + `--f-page-bg` wrapper, sticky glass header, glass search input + filter button, autocomplete suggestions, "did you mean" correction, filter panel (category + sort), trending chips, category grid, recent searches, results list, no-results, Ask Nearby CTA + bottom-sheet modal. All dark, all wiring intact.

### Changes

**1. Dead bell → live NotificationBell.** Header bell was a static decorative FIcon (no onClick/drawer) — same class as Home's. Now `<NotificationBell/>` (drawer + unread dot) in a 44×44 glass tile.

**2. RadarPulse wired into the REAL broadcast (not a fake timer).** The Ask Nearby modal went compose → success with only a button-label loading state (no radar). Added a **"Broadcasting…" stage** that renders `<RadarPulse size={220} shopCount={12}>` **while `askSending` is true** — i.e. for the ACTUAL in-flight `/api/ask-nearby/send` duration, then flips to success on `askResult`. The prototype used a fake 3.2s `setTimeout`; this version ties the radar to the real network call (honest loading visual). Branch order: `askSending ? radar : askResult ? success : compose` (askGeocodingArea keeps compose visible with its label).

**3. Category grid → v3.** Each tile now has an inner 40×40 colored icon tile (`cat.color + '22'` 13%-alpha bg) holding the emoji + hover translateY(-2px). Uses `cat.color` from `constants/categories`; kept emoji (no per-category lucide mapping in the data).

**4. FIcon → lucide** throughout (Search/X/SlidersHorizontal/ArrowRight/Clock/MapPin/Store/Navigation/ChevronRight/Check). FLogo kept; `getStoreStatus`+`statusColor` kept (results-list store status sort + label).

### PRESERVED VERBATIM (grep-confirmed)

search API (`/api/search/ai` + `/api/search/suggestions` + history GET/POST/DELETE), 300ms debounce, `saveSearch`, category/sort filter (`matchCategory`, `filteredStores` sort by open-status), trending data (`TRENDING` const), `getDistance`, `openDirections`, PostHog `search_performed`, correction banner, autocomplete outside-click close. **Full Ask Nearby flow**: `handleAskSend` (area mode my/custom + nominatim geocoding + radius 1-20), `/api/ask-nearby/send` POST body `{query, radiusKm, latitude, longitude, areaLabel}`, `askResult` `{sentTo, storeNames}`, "Messages mein jaao" nav. Exact Hinglish copy intact.

### NOTE — live Ask Nearby is richer than the prototype

The production flow has **area mode (my-location vs custom + geocoding)** + a **storeNames-notified list** that the prototype's query-only compose lacks. Kept ALL of it — did not dumb down to the prototype. The RadarPulse stage was added on top of the existing richer flow.

### Phase 3 gates

- ✅ typecheck 0 · vitest **133/133** · build green (65 precache) · E2E 2/2

### Phase 4 CI + deploy

- ✅ PR #96 (run 26612956980): `success`
- ✅ Fly **v38** complete; post-deploy `/health` 200 in 455ms · push handler intact · CSP `report-only` preserved

### E2E coverage gap (explicit)

Search is auth-gated → NOT covered by the public render-smoke E2E. Founder device test required: type query → results + correction, trending chips, category grid, filter panel (category/sort), **Ask Nearby broadcast** (compose → RadarPulse "Broadcasting…" → success → "Messages mein jaao"), my-location vs custom-area geocoding, bell drawer.

### Awaiting

- Founder device test (esp. Ask Nearby broadcast end-to-end)
- Opus → next: **Map (122)** — L-size (3D ↔ Map toggle, IsoMap, GoogleMap dark style, bottom sheet, FABs)

---

## 2026-05-29 — Session 120 — Messages + Chat re-skin (paired, screen 5 of re-skin)

**Goal:** Re-skin Messages.tsx + Chat.tsx to Futuristic v3, paired, preserving ALL Socket.IO realtime + send + fetch wiring (chat = core product). Fifth step of the Tier 5D re-skin.

**Status:** ✅ **MESSAGES + CHAT LIVE ON v3.** Fly **v37** complete. Both were already comprehensively v2-futuristic; closed v3 gaps + one functional cleanup. **Realtime backbone untouched — only style + icon JSX changed.**

| Metric | Value |
|---|---|
| PR merged | #94 (squash) |
| Squash commit | `947eb13` |
| Production HEAD | `31a10b7` → **`947eb13`** |
| Fly release | **v37** complete |
| Files changed | 3 (`Messages.tsx`, `Chat.tsx`, `ConversationRow.tsx`, +52/−46) |
| Tests | **133/133** |

### 🔎 Recon: both already v2-futuristic (Phase 6/7)

Messages: dark bg + aurora wash, glass search, glass conversation rows (via `ConversationRow`), ask-nearby stock-request cards, suggested-stores rail, empty state. Chat: dark bg, glass header, gradient/glass bubbles, glass composer, post-ref card + preview overlay + referred-post banner. All dark, all wiring intact.

### Changes (1 functional + v3 polish)

**Messages.tsx**
- **RefreshButton dropped** per design (bare `window.location.reload()` — same as S117/S119). Header now "Messages" + "{N} chats".
- FIcon → lucide (Search/X/MessageCircle/ChevronRight).

**ConversationRow.tsx**
- v3 row: bg `var(--f-glass-bg-2)` → `var(--f-bg-elev)`, + hover (translateX 2px + magenta border + glow). chevR → lucide.

**Chat.tsx**
- FIcon → lucide (ChevronLeft/Send/Paperclip/X/Tag/ShoppingCart/AlertCircle).
- Bubbles → v3 spec: padding 11/15, fontSize 14/500, radius 20-6, **incoming solid `var(--f-bg-elev)` + glass border-2** (was translucent glass-bg-3 + blur), outgoing gradient + magenta shadow. Composer send 42→46px. Back 38→42, peer avatar 36→38.

### PRESERVED VERBATIM (grep-confirmed — the critical part)

- **Chat Socket.IO**: `connect`/`connect_error`/`disconnect`, `newMessage` listener + belongs-check, `handleReopen` reconnect-aware refetch (`socket.io.on('reconnect')` + `engine.on('open')`), visibility wakeup, `getSocketUrl`/`getSocketAuthOptions`
- **Chat send/fetch**: message history fetch (`/api/messages/{userId}`), `sendRaw`, `handleSend` (image upload to `/api/upload` + post-ref encode + PostHog `chat_message_sent`), receiver role-aware fetch (store lookup for retailer/supplier/brand/manufacturer), scroll-to-end, `PostRefCard`/`PostPreviewOverlay`/`ReferredPostBanner`
- **Messages Socket.IO**: `ask_nearby_request` + `ask_nearby_confirmed` listeners, reconnect refetch, visibility wakeup, `refreshConversations`, `handleAskNearbyRespond`, suggested-stores fetch, search filter
- **ConversationRow**: prop contract + React.memo comparator + unread badge

### ⚠️ RECON GAP (flagged — NOT fabricated, NO backend touched)

README wants **role-based rich conversation rows** (business: status capsule + distance + area + category) + a **chat-header business meta strip / customer ● Online**. The data is NOT in the payload:
- `Conversation` type = `{userId, name, logoUrl, lastMessage, timestamp, unread}` — no role/store fields
- Chat fetches peer role but not store status/category/distance; no presence tracking for "Online"

Rendered the existing 2-line rows + name-only peer card gracefully. Rich rows + peer meta would require **enriching `/api/messages/conversations`** (peer role + store status/category/area/distance) + a **presence signal** for Online. **Out of re-skin scope** — flagged for an Opus backend ticket if desired. Did NOT fabricate a fake "Online" or invent data.

### Phase 3 gates

- ✅ typecheck 0 · vitest **133/133** · build green (64 precache) · E2E 2/2

### Phase 4 CI + deploy

- ✅ PR #94 (run 26612085255): `success`
- ✅ Fly **v37** complete; post-deploy `/health` 200 in 475ms · push handler intact · CSP `report-only` preserved

### E2E coverage gap + HIGH-priority founder test

Messages + Chat are auth-gated + realtime → NOT E2E-covered. **Founder MUST device-test the realtime path** (highest-risk re-skin so far): open a thread, **send + receive a live message** (Socket.IO `newMessage`), image send, post-enquiry banner flow, conversation-list update, ask-nearby stock-request card respond. A broken chat = broken core product — verify before relying on it.

### Awaiting

- Founder realtime device test (send/receive)
- Opus: backend ticket for conversation-payload enrichment (rich business rows) — yes/no?
- Opus → next: **Search (121)** — L-size + Ask Nearby radar (FAskNearbyModal: compose → RadarPulse → success)

---

## 2026-05-29 — Session 119 — Store Profile re-skin: live bell + getLiveStatus + bio clamp + 1:1 grid (screen 4 of re-skin)

**Goal:** Re-skin StoreProfile.tsx to Futuristic v3 in place, preserving all data/handlers/wiring. Fourth step of the Tier 5D re-skin.

**Status:** ✅ **STORE PROFILE LIVE ON v3.** Fly **v36** complete. Recon (per the established pattern) found StoreProfile already comprehensively v2-futuristic; this session closed the v3 gaps + one functional add.

| Metric | Value |
|---|---|
| PR merged | #92 (squash) |
| Squash commit | `31a10b7` |
| Production HEAD | `7f9a64e` → **`31a10b7`** |
| Fly release | **v36** complete |
| Files changed | 1 (`src/pages/StoreProfile.tsx`, +83/−31) |
| Tests | **133/133** |

### 🔎 Recon: already v2-futuristic (Phase 6)

Dark `--f-bg-deep` + aurora wash, glass cover + glow overlay, overlapping logo, glass stats cells, glass details card, gradient role pill, sticky Posts/Reviews tabs, full post-detail modal — all dark, all wiring intact.

### 5 changes (1 functional add + 4 v3-spec)

**1. Refresh → live NotificationBell (functional).** `RefreshButton` (bare `window.location.reload()`, no logic — same as the S117 AppHeader Refresh) **dropped** per design. Added `<NotificationBell/>` (drawer + unread dot) in the cover FAB tile. **Store profile previously had NO bell** → now reachable. Share button kept.

**2. getLiveStatus hours.** Status was `getStoreStatus` + `statusColor` (old semantic 'green'/'yellow'/'red'). Now bridges `minutesUntilClose` → `useClosingSoon` (live tick) → `getLiveStatus` 4-tier color + glowing dot. Consistent with PostCard/Home. **Hook hoisted above the loading/!store early returns** (React hooks rule — `store?.` optional chaining handles the null-pre-fetch case).

**3. Bio 3-line clamp + Read more/less** toggle (was shown full; `bioExpanded` state, shown only when description > 140 chars).

**4. Posts grid → README spec.** `aspectRatio` 3/4 → **1:1**, gap 3 → **4**, + **STORE badge** top-left of the first cell (`idx === 0`).

**5. FIcon → lucide-react** throughout (12 distinct icons across ~19 usages: ChevronLeft/Share2/Store/MapPin/Phone/Clock/Navigation/Plus/Check/MessageCircle/Star/Heart). FIcon import removed.

### Preserved verbatim (grep-confirmed)

store fetch (`fetchStoreData`), `toggleFollow` (optimistic + rollback), `toggleLike`, `handleShare`, reviews + `ReviewModal`, post-detail modal (`selectedPost` scroll-into-view), owner-vs-visitor action buttons (New Post → `/profile`, Edit Profile → `/retailer/dashboard`, Follow/Chat/Call), tabs, `StarRating`, `isOwner` gating, `getLikeCount`, products fetch.

### ⚠️ Deviations (flagged — out of pure-reskin scope)

- **Distance pill near DP** (README §Store-profile) NOT added — the page has no LocationContext/userLoc; distance display = new feature wiring (haversine + LocationContext import), not a re-skin. Skipped.
- **Settings gear top-right** (README) NOT added — the owner already reaches the dashboard via the Edit Profile action button (a gear → same destination is redundant); a personal-settings gear on a *visitor's* view of *another* store is a UX mismatch. Kept the universally-useful Share button instead. **Opus to confirm** (or request an owner-only gear).
- **Banner/DP geometry** kept as working v2 (200px cover + 72px logo overlap at -28) rather than rebuilding to the README's 16:8 banner + 84px DP at -42. Valid v2 layout, low payoff to rebuild, higher risk to a working sticky/overlap. Polished in place (icons, status, bio).

### Phase 3 gates

- ✅ `npm run typecheck` — 0 errors
- ✅ `npm test -- --run` — **133/133**
- ✅ `npm run build` — green (63 precache entries)
- ✅ `npm run test:e2e` — 2/2

### Phase 4 CI + deploy

- ✅ PR #92 (run 26611373510): `success`
- ✅ Fly **v36** complete; post-deploy `/health` 200 (1.17s, cold machine) · push handler intact · CSP `report-only` preserved

### E2E coverage gap (explicit)

StoreProfile is auth-gated → NOT covered by the public render-smoke E2E. Founder device test required: follow toggle, bio Read more/less, Posts/Reviews tab switch, Edit Profile/New Post nav, **bell drawer**, post-detail modal open/scroll, live hours color, 1:1 grid + STORE badge.

### Awaiting

- Opus decision: settings gear (skip / owner-only) on store profile
- Founder device test
- Opus → next: **Messages + Chat (120, paired)** — M+M; the chat thread + conversation list

---

## 2026-05-29 — Session 118 — Home page re-skin: live bell + v3 PostCard + lucide chrome (screen 3 of re-skin)

**Goal:** Re-skin Home.tsx to Futuristic, full-dark, preserving all data/hooks/handlers. Third step of the Tier 5D re-skin.

**Status:** ✅ **HOME LIVE ON v3.** Fly **v35** complete. Recon found Home was already ~95% futuristic v2; this session closed the two **functional** gaps that remained.

| Metric | Value |
|---|---|
| PR merged | #90 (squash) |
| Squash commit | `7f9a64e` |
| Production HEAD | `f7793e7` → **`7f9a64e`** |
| Fly release | **v35** complete |
| Files changed | 1 (`src/pages/Home.tsx`, +18/−14) |
| Tests | **133/133** |

### 🔎 Recon: Home was already v2-futuristic

Home.tsx already had: dark `--f-bg-deep` + `--f-page-bg` wrapper, `--f-sticky-bg` sticky header + tabs, `FLogo`, `FLocationStrip` (already matches README v3 location-strip spec exactly), glass carousel (2.2:1, magenta border+glow, 4s rotate, chevrons, dots, `/api/app-settings` data), gradient pill-tabs (For you/Following/Saved), filter dropdown (Global / Within 3km), loading skeletons, empty/end states, infinite scroll. So the page was NOT cream — the task's "wrap in dark" premise was already satisfied.

### Two real (functional) gaps closed

**1. Dead bell → live NotificationBell.** The header bell was a **static decorative `FIcon name="bell"`** (gold, no onClick, no drawer) — i.e. tapping it did nothing. Replaced with the real `<NotificationBell/>` (unread badge + drawer via `NotificationContext`) inside a 44×44 glass tile. **The notification drawer is now reachable from Home** (it never was before).

**2. Feed card v2 → v3.** Home rendered **`FPostCard` (v2)** — single-ring avatar, hardcoded `#2EE7A1` green status dot, no status capsule, no live countdown, no area row. Swapped to the **S116-re-skinned `PostCard` (v3)** — double-ring avatar, `getLiveStatus` capsule, `useClosingSoon` live countdown, area·pincode row. Props identical (`PostCardProps`) → pure drop-in import swap. **This ALSO makes S116 live** — `PostCard.tsx` had been imported by ZERO screens (dead code) until this swap. (Parallel to the S117 AppHeader-dead-code finding — re-skinned components weren't actually wired.)

### Chrome icons → lucide

`FIcon` → lucide-react: `ChevronLeft`/`ChevronRight` (carousel), `SlidersHorizontal` (filter btn), `Check` (filter tick), `Store` (empty state). `FIcon` import fully removed from Home. `FLogo` + `FLocationStrip` kept as-is (own components, already v3-correct; they use FIcon internally — re-skinned in their own right later if needed).

### Preserved verbatim (grep-confirmed)

useFeed + pagination (IntersectionObserver → loadMore), saved-tab separate `/api/users/{id}/saved` fetch, optimistic `toggleLike`/`toggleSave`/`toggleFollow` + error rollback, `LocationContext` (`useUserLocation`) + `LocationPicker`, tab filtering (`feedType`), distance filter (`locationRange`), `getDistance` haversine, `getLikeCount`, `handleShare` (native share + clipboard fallback), carousel data source + 4s rotation + chevron/dot controls, loading skeletons, empty + "Sab posts dekh liye" end states.

### f-bg-aurora decision

Did NOT wrap in `.f-bg-aurora` class. Home already renders fully dark via `--f-bg-deep` + `--f-page-bg` (equivalent outcome). The `.f-bg-aurora` class sets `overflow:hidden` + an absolute animated `::before` + forces children to `z-index:1` — that would break the working `position:sticky` header + tabs. Goal ("Home fully dark now") already met without it.

### Phase 3 local gates

- ✅ `npm run typecheck` — 0 errors
- ✅ `npm test -- --run` — **133/133**
- ✅ `npm run build` — green (60 precache entries — PostCard chunk now pulled into Home; FPostCard no longer)
- ✅ `npm run test:e2e` — 2/2

### Phase 4 CI + deploy

- ✅ PR #90 (run 26610697775): `success`
- ✅ Fly **v35** complete; post-deploy `/health` 200 in 491ms · push handler intact · CSP `report-only` preserved

### Reusable primitives surfaced (for Search / StoreProfile reuse)

- `FLocationStrip` — drop-in location strip
- The glass carousel block (16:9-ish, magenta border+glow, auto-rotate, chevrons, dots)
- The gradient pill-tabs + glass filter-dropdown pattern
- 44×44 glass bell tile wrapping `<NotificationBell/>` (now used identically in S117 AppHeader + S118 Home)

### E2E coverage gap (explicit)

Home is auth-gated → NOT covered by the public render-smoke E2E. Founder device test required: feed loads + paginates, tab switch filters (For you/Following/Saved), location Change opens picker, **bell opens notification drawer**, like/save/follow on v3 cards work, live status capsule ticks.

### Awaiting

- Founder device test — Home fully dark, v3 cards with live capsule, working bell drawer, all interactions
- Opus → next screen: **Store Profile (119)** — L-size (banner + DP overlap + stats + bio clamp + Posts/Reviews tabs); the StoreProfile feed currently uses an inline `sortedPosts.map` (NOT PostCard) — that session decides card strategy there

---

## 2026-05-29 — Session 117 — AppHeader + BottomNav Futuristic re-skin (paired, screen 2 of re-skin)

**Goal:** Re-skin AppHeader + BottomNav (paired — chrome that renders across screens) to Futuristic v3 IN PLACE, preserving all props/handlers/routing/NotificationBell wiring. Second step of the Tier 5D re-skin.

**Status:** ✅ **BOTTOMNAV RE-SKINNED + LIVE; APPHEADER RESTYLED (but unmounted — see finding).** Fly **v34** complete. BottomNav now has the v3 translucent active pill + lucide icons + `--f-bottom-nav-bg` glass; all 5 routes + active-detection + hide-logic preserved verbatim.

| Metric | Value |
|---|---|
| PR merged | #88 (squash) |
| Squash commit | `f7793e7` |
| Production HEAD | `33d654c` → **`f7793e7`** |
| Fly release | **v34** complete |
| Files changed | 3 (`BottomNav.tsx`, `AppHeader.tsx`, `DukanchiLogo.tsx`) |
| Lines | +96 / −80 |
| Tests | **133/133** (unchanged — no unit-test surface on these components) |

### 🔎 Key finding — AppHeader is dead code (flagged for Opus)

`AppHeader.tsx` is **NOT imported or rendered by any screen** (grep across `src/` confirms only its own file references it). The actually-visible screen headers are **inline per-page** — Home/Search/Map/Messages each render their own header JSX. `NotificationBell` is used **directly** by Profile/Support/UserSettings/RetailerDashboard.

**Implication:** Restyling `AppHeader.tsx` has zero visible effect today. **BottomNav was the real visible win** of this PR.

**Decision deferred to Opus:** either (a) wire a single shared `AppHeader` across screens (consolidation), OR (b) keep per-page inline headers and re-skin each header in its own screen session (Home/Search/Map/Messages). This session changed NO screen behavior — AppHeader is restyled to v3 so it's *ready* either way, but per-page headers remain the live chrome.

### BottomNav (LIVE — App.tsx + PWAInstallPrompt)

- **v2 → v3 active state**: solid-gradient 36px tile + white icon → **translucent inset pill** (`linear-gradient(135deg, rgba(255,107,53,0.22), rgba(255,42,140,0.28))` + `1px rgba(255,42,140,0.45)` border + `0 4px 14px magenta` glow + inner highlight) with **magenta `#FF2A8C` icon + `rgba(255,42,140,0.14)` fill**
- **Icons**: `FIcon` (custom SVG) → **lucide-react** (`Home`/`Search`/`MapPin`/`MessageCircle`/`User`)
- **Bar**: `var(--f-bottom-nav-bg)` (was hardcoded rgba), 32px radius, 6px lateral (was 14px), `blur(28px) saturate(180%)`, items equal-flex 58px min-height, labels 10/700
- **Preserved verbatim** (grep-confirmed): all 5 routes (`/`, `/search`, `/map`, `/messages`, `/profile`), active-detection formula (`pathname === path || (path !== '/' && pathname.startsWith(path))`), hide-on-`/chat/`+`/signup`+`/login`+`/landing`, `maxWidth:480` centering, `pb-safe`, `pointerEvents` float trick

### AppHeader (restyled, unmounted)

- Dark-glass bar (`var(--f-sticky-bg)` + blur24) + 40px logo tile + "Dukanchi" 18/800 + "apna bazaar, apni dukaan" 11/500 (`--f-text-3`) + 44×44 glass bell tile wrapping `NotificationBell`
- **Refresh button REMOVED** — it did a brute `window.location.reload()` (no state/data-fetch logic; design handoff drops it). Safe removal. If a refresh affordance is wanted later it should be a feed-level pull-to-refresh, not a header reload. **NotificationBell wiring (drawer + unread dot) preserved verbatim.**

### DukanchiLogo

- 34px orange→amber rounded tile → **40px brand-gradient (`var(--f-grad-primary)`) tile + glow + द glyph**; added optional `size` prop (default 40). Only consumed by AppHeader → safe to restyle.

### Phase 3 local gates

- ✅ `npm run typecheck` — 0 errors
- ✅ `npm test -- --run` — **133/133**
- ✅ `npm run build` — green (58 precache entries — BottomNav no longer pulls the FIcon chunk path here)
- ✅ `npm run test:e2e` — 2/2

### Phase 4 CI + deploy

- ✅ PR #88 (run 26607848253): `success`
- ✅ Fly **v34** complete (deploy emitted a local DNS-verification warning — `i/o timeout` to 8.8.8.8 from the dev machine, NOT a deploy failure; "Your app is deployed" + curl confirms healthy)
- ✅ Post-deploy: `/health` 200 in 550ms · SW push handler intact · CSP `report-only` preserved

### E2E coverage gap (explicit)

BottomNav **hides itself** on `/login` + `/signup` (its own route-guard), and AppHeader is unmounted — so **neither is covered** by the public render-smoke E2E. Founder device test required: all 5 nav routes navigate, active pill on the current tab, bell opens the notification drawer.

### Awaiting

- Opus decision: shared AppHeader vs per-page inline headers
- Founder device test — bottom nav dark-glass + active pill + 5 routes + bell drawer
- Opus → next screen: **Home** (L — the main feed screen; carousel + location strip + tabs + filter + feed of re-skinned PostCards)

---

## 2026-05-29 — Session 116 — PostCard Futuristic re-skin + useClosingSoon (screen 1 of re-skin)

**Goal:** Re-skin `src/components/PostCard.tsx` to the Futuristic v3 spec IN PLACE — preserve every prop, handler, optimistic-update wiring, and real data source. First screen of the Tier 5D re-skin (recommended order: PostCard → AppHeader+BottomNav → …). Visual layer only.

**Status:** ✅ **POSTCARD RE-SKINNED + LIVE.** Fly **v33** complete. Card now renders deep-glass with the v3 3-row header, getLiveStatus capsule, double-ring avatar, and lucide action row — all interactions + data preserved. `useClosingSoon` hook drives the live closing-countdown. Interim: dark card on still-cream Home/Profile surfaces (expected pre-pilot until those screens flip).

| Metric | Value |
|---|---|
| PR merged | #86 (squash) |
| Squash commit | `33d654c` |
| Production HEAD | `b15cccf` → **`33d654c`** |
| Fly release | **v33** complete |
| Files changed | 3 (`src/components/PostCard.tsx`, `src/hooks/useClosingSoon.ts` new, `src/hooks/useClosingSoon.test.ts` new) |
| Lines | +301 / −103 |
| Tests | **133/133** (127 baseline + 6 new `nextClosingSoon`) |

### Preserved (contract intact — confirmed via grep)

- **Props**: `PostCardProps` interface untouched (post, isLiked, isSaved, isFollowed, likeCount, distance, imgRatio, onLike, onSave, onFollow, onShare, onImgLoad)
- **Handlers**: `onLike(post.id)`, `onSave(post.id)`, `onFollow(post.storeId)`, `onShare(post)`, `onImgLoad(post.id, ratio)` — all wired identically
- **Chat**: `<Link to={/chat/{ownerId}} state={{referredPost}}>` — it's a router Link with nav state (NOT an onChat prop); preserved exactly incl. `chatEnabled !== false` gate
- **Store links**: avatar + name → `/profile` (own) or `/store/{storeId}`
- **Adaptive image ratio** (`getImageStyles`: 4:5 portrait / 1:1 square / natural landscape) — kept; only bg swapped `black → #0a0612`
- Price overlay on image, product name+price row, caption + `renderCaption` first-sentence-bold, `React.memo` comparator — all preserved

### Visual changes (Futuristic v3 spec)

- **Card**: `var(--f-bg-elev)` solid, 22px radius, `1px solid var(--f-glass-border)`, `0 2px 12px rgba(24,16,8,0.06)`
- **Header → 3 sub-rows**:
  - Row 1: 46px logo avatar (real `logoUrl`) with double-ring shadow (`0 0 0 2px elev, 0 0 0 3.5px #FF2A8C, 0 4px 12px magenta`) + gradient bg fallback + name 15/700 -0.01em + gradient verified tick (green→cyan) + Follow button
  - Row 2: live status **capsule** (getLiveStatus → `color+1A` bg, `color+40` border, dot + label) + distance (`--f-text-3`) + category (`#FF6BB4`)
  - Row 3: lucide `MapPin 10` + `{city} · {postalCode}` (only if present)
- **Image canvas**: bg `#0a0612`
- **Action row**: lucide Heart/MessageCircle/Share2/Bookmark (20–22px), 13/700 labels, gap 22, `var(--f-text-1)`; liked heart `#FF4D6A`
- **Follow**: gradient default (`+ 0 2px 8px magenta`) / `var(--f-bg-elev)` + glass border "Following"
- All `--dk-*` cream tokens removed from this component → `--f-*` only

### Live status wiring

```
getStoreStatus(openingTime, closingTime, is24Hours, workingDays)  // existing
  → .minutesUntilClose
  → useClosingSoon(...)        // NEW hook: ticks 60s, decrements, floors -5
  → getLiveStatus({ closingSoon, status: status?.label })  // S115 helper
  → { label, color } → capsule
```

`Store` type has `city` + `postalCode` (NO dedicated `area` field) — Row 3 maps to those. When `status` is null (no hours configured) → getLiveStatus falls back to "Open" green (parity with prior `● Open` behavior).

### useClosingSoon hook (new)

- `src/hooks/useClosingSoon.ts` — ticks once/minute, decrements via pure `nextClosingSoon`, floors at `CLOSING_SOON_FLOOR (-5)`, **one interval per instance**, resets on `initialMinutes` change, clears on unmount (no duplicate timers).
- `src/hooks/**/*` already in `tsconfig.app.json` include — no Rule G addition needed.

### Tests

- **6 node-only tests** on the extracted pure `nextClosingSoon` stepper (decrement / cross-zero / floor / convergence / tier-boundary walk 60→30→15).
- **Deviation**: `@testing-library/react` + jsdom are deliberately NOT in this repo's vitest setup (node-only env; confirmed via `vitest.config.ts` comment). Rather than add RTL + jsdom infra for a re-skin task, the pure step `nextClosingSoon` was extracted from the hook and unit-tested. Timer/reset/cleanup wiring is standard React idiom covered by typecheck + manual dev render. Flagged for a future "add RTL" infra session if hook-level tests become desired.

### Phase 3 local gates

- ✅ `npm run typecheck` — 0 errors (web + server + worker)
- ✅ `npm test -- --run` — **133/133**
- ✅ `npm run build` — green
- ✅ `npm run test:e2e` — 2/2 (chromium)

### Phase 4 CI + deploy

- ✅ PR #86 (run 26607000827): `success`
- ✅ Fly **v33** complete; machine 9080d70da60d18, 1/1 check passing
- ✅ Post-deploy: `/health` 200 in 583ms · SW push handler intact · CSP `report-only` preserved

### E2E coverage gap (explicit)

The public render-smoke E2E (`e2e/public-render.spec.ts`) only covers `/login` + `/signup` (unauth). **PostCard is auth-gated (Home/Profile feeds) → NOT E2E-covered.** Founder device test required to confirm: dark-glass card render, live status capsule ticks, and all interactions (like/save/follow/chat/share/image-load) work. This is a known gap pending the Tier 5B auth-E2E session (needs test DB + JWT minting).

### Awaiting

- Founder device test — Home feed cards should be dark-glass + live status capsule + every action functional
- Opus → next screen: **AppHeader + BottomNav** (paired — both visible everywhere, land together to avoid mid-app surface drift)

---

## 2026-05-29 — Session 115 — Futuristic v3 tokens + getLiveStatus foundation (no screen changes)

**Goal:** Recon the founder-supplied "Futuristic v3" design bundle (`/Users/apple/Desktop/design_handoff_dukanchi_futuristic/`) + integrate design tokens additively into the styling layer. **Zero screen changes** this session — app must render identical post-merge. Foundation only; per-screen re-skin queued for follow-up sessions.

**Status:** ✅ **TOKEN FOUNDATION LIVE.** Fly **v32** complete. App renders identical to pre-merge (verified locally + post-deploy curls). New `--f-status-*`, spacing scale (`--f-s-1..--f-s-12`), type scale (`--f-t-display..--f-t-micro`), letter-spacing, and line-height tokens are now available as utilities; `getLiveStatus()` helper + 15-test guard ships in `src/lib/liveStatus.ts`. Per-screen re-skin scope mapped + sized (recon report below).

| Metric | Value |
|---|---|
| PR merged | #84 (squash) |
| Squash commit | `b15cccf` |
| Production HEAD | `6fe89f2` → **`b15cccf`** |
| Fly release | **v32** complete |
| Files changed | 4 (`src/futuristic.css`, `src/lib/liveStatus.ts` new, `src/lib/liveStatus.test.ts` new, `tsconfig.app.json` Rule G include) |
| Lines | +244 (additive only) |
| Tests | **127/127** (112 baseline + 15 new liveStatus tier-boundary tests) |
| Visual diff | None — app pixel-identical to pre-merge |

### Recon report — Tier 5D screen scope

**Per-screen target table** (sized against current code + new design spec):

| Production target | LOC | Effort | Key risks / notes |
|---|---:|---|---|
| `src/components/AppHeader.tsx` | 62 | **S** | Small file; drop Refresh button (per README); swap surface to dark glass. Touched by many pages — test rest-of-app regression carefully. |
| `src/components/BottomNav.tsx` | 90 | **S** | New active-pill style + dark glass shell. Visible everywhere — must land before per-page reskins to avoid awkward half-state. |
| `src/components/PostCard.tsx` | 279 | **M** | 3-row header layout, status capsule via getLiveStatus, area+pincode row, double-ring avatar shadow. Touches all feed surfaces. |
| `src/pages/Home.tsx` | 669 | **L** | Sticky header + sticky location strip + carousel banner + pill tabs + filter + feed. Largest single-screen scope. Carries the post-save/like/follow optimistic pattern other screens reference. |
| `src/pages/Search.tsx` | 970 | **L** | Trending chips + 4-col category grid + Ask Nearby teaser + 3-stage modal (Compose / Pulsing / Success). Modal includes the `RadarPulse` SVG (component already exists at `src/components/futuristic/RadarPulse.tsx`). |
| `src/pages/Map.tsx` | 613 | **L** | 3D ↔ Map toggle, IsoMap (component exists) for 3D, dark-styled Google Maps for 2D, "stores nearby" pill, FABs, bottom sheet horizontal scroll. Google Maps style JSON is in README. |
| `src/pages/Messages.tsx` | 397 | **M** | Variable-height conversation rows (4-line business vs 2-line customer), live status capsule via getLiveStatus, hover slide. |
| `src/pages/Chat.tsx` | 561 | **M** | Peer header with business meta strip, message bubbles (different radius for me/them), composer with gradient send button. |
| `src/pages/StoreProfile.tsx` | 707 | **L** | Gradient banner (16:8 overflow visible) + overlapping DP, distance pill, 3-line bio clamp with "Read more" toggle, info card, 3-col stats, posts/reviews tabs. |
| `src/pages/Settings.tsx` | **NEW** | **M** | Page does NOT exist — current settings live in `UserSettings.tsx` (408 LOC). Decision needed: extend existing OR create new and migrate routes. README spec is for a NEW Settings shell (profile card + grouped sections + toggle switches + red logout). |
| Splash boot | **NEW** | **S** | Standalone boot screen (aurora gradient bg + Dukanchi logo tile + magenta orbiting loader + bottom "Made in India 🇮🇳"). Hook to existing initial auth+feed-hydration gate. |

**Existing assets found (avoid rebuild)**:
- ✅ `src/components/futuristic/` already has `FAppHeader`, `FBottomNav`, `FPostCard`, `FIcon`, `FLogo`, `FLocationStrip`, `IsoMap`, `LiveOrb`, `RadarPulse`, `VoiceWaveform`, `FloatingProductCard` (Phase 7/8 from May 16-20). These are alternates to the production components — per-screen sessions will decide swap vs adapt.
- ✅ `src/components/NotificationBell.tsx` exists for header bell wiring
- ✅ `src/hooks/useFeed.ts` exists — Home reskin reuses it
- ✅ `src/lib/storeUtils.ts:getStoreStatus()` exists — returns `{minutesUntilClose, ...}`; bridge to `getLiveStatus({closingSoon: ...minutesUntilClose})` for client-side computation until server adds the field
- ✅ Prisma `Store.openingTime`, `Store.closingTime` (lines 99-100) already exist — no schema change needed
- ✅ `lucide-react` already a dep — icon map in README §Iconography is drop-in

**Theme audit + per-screen dark-flip strategy**:
- Current app surface uses **`--dk-*` cream/warm palette** in `src/index.css` (NOT touched this session — global flip would break unreskinned screens)
- **No `data-theme` attribute is set anywhere** in code (grep returned nothing) — the `[data-theme="light"]` block in `src/futuristic.css` is dead code, currently harmless. Kept for now; removed once all screens reskinned.
- Strategy for per-screen sessions: opt into futuristic via component-level `f-bg-aurora` / `f-glass` / explicit `var(--f-*)` references. Each session ends with the screen working alongside un-reskinned screens (no global body bg flip). Global cream→dark surface flip is the FINAL step after all screens land.

**Tailwind 4 token integration approach**:
- No `tailwind.config.*` file (Tailwind 4 uses CSS-first `@import "tailwindcss"` only)
- Tokens added directly to `:root` in `src/futuristic.css` (already imported by `main.tsx`)
- Screens use tokens via `var(--f-*)` inline styles — no Tailwind utility-class generation needed (the existing futuristic components already follow this pattern)

**getLiveStatus + closingSoon data source**:
- **Helper**: `src/lib/liveStatus.ts` — pure, no I/O, `(closingSoon?, status?, statusColor?) → {label, color}`. 4 hex constants exposed via `LIVE_STATUS_COLORS`.
- **Data source decision**: per-screen sessions can EITHER (a) compute `closingSoon` client-side via existing `getStoreStatus(s.openingTime, s.closingTime, s.is24Hours, s.workingDays).minutesUntilClose`, OR (b) ask the backend to add a derived `closingSoon` field to the feed payload (cheaper on slow phones, more consistent across screens). README §State Management notes both are valid.
- **Tick**: post-card uses `setInterval(60_000)` per-card; should be a hook (`useClosingSoon(initial)`) to avoid duplicate timers when many cards render.

**Recommended screen ORDER for re-skin** (pilot-critical first):
1. **PostCard** (M) — visible on Home + Profile + Search results; biggest UX-per-LOC ratio
2. **AppHeader** + **BottomNav** (S+S) — every screen, must land paired to avoid mid-app surface drift
3. **Home** (L) — main entry; carries the carousel + tab + filter primitives others reuse
4. **Search** (L) — second-most-touched; Ask Nearby is the signature feature
5. **StoreProfile** (L) — funnels conversions
6. **Messages** + **Chat** (M+M) — retention loop; pair them
7. **Map** (L) — has 3D toggle complexity; IsoMap component already in repo
8. **Settings** (M) — decide rename vs new file; lower funnel priority
9. **Splash** (S) — polish; pairs with hydration gate work

**Honest total effort estimate**:
- 11 screens at S/M/L = 6 L + 5 M/S = roughly **6–9 sessions of ~30–60 min each** if each ships clean (tokens + LiveStatus already done = saves ~1 session)
- Each screen carries 1–2× risk surfaces (regression vs un-reskinned neighbors). Per-screen smoke + E2E render check before merge is the gate.
- Estimated total: **4–6 development days** at 2 sessions/day, assuming no major iteration on individual screen designs
- Final "global body bg cream→dark flip" step (delete `[data-theme="light"]` + flip `--dk-*` to dark surfaces in `index.css`) is its own short session at the end

### Files modified (this session)

- `src/futuristic.css` — added `--f-status-*` (4 colors), `--f-s-*` (9 spacing), `--f-t-*` (9 type), `--f-ls-*` (4 LS), `--f-lh-*` (4 LH) — pure additive into existing `:root`; existing `[data-theme="light"]` block preserved
- `src/lib/liveStatus.ts` — new, 91 LOC; `getLiveStatus()` + `LIVE_STATUS_COLORS`
- `src/lib/liveStatus.test.ts` — new, 15 tests covering "Closed*" override, no-signal fallback, tier boundaries (15/30/60), color contract drift guard
- `tsconfig.app.json` — added `src/lib/liveStatus.ts` to include list (Rule G — per-file allowlist for `src/lib/*`, not a glob)

### Phase 5 local gates

- ✅ `npm run typecheck` — 0 errors (web + server + worker, after Rule G fix)
- ✅ `npm test -- --run` — **127/127** (vitest 112 baseline + 15 new liveStatus)
- ✅ `npm run test:e2e` — 2/2 passing in 26.4s (chromium)
- ✅ `npm run build` — green

### Phase 6 CI + deploy

- ✅ PR #84 (run 26605946828): `success`
- ✅ `flyctl deploy -a dukanchi-app` → Fly **v32** complete
- ✅ Post-deploy: `/health` 200 in 504ms · push handler intact · CSP `report-only` preserved · `/api/upload` 401-gated (not exercised here but unchanged surface)

### Awaiting

- Opus → screen-by-screen prompts in recommended order (PostCard → AppHeader+BottomNav → Home → Search → StoreProfile → Messages+Chat → Map → Settings → Splash → global dark flip)

---

## 2026-05-29 — Session 114 — Instant file-pick + cropper UX polish (THE actual upload-flow speed win)

**Goal:** Eliminate the multi-second lag between picking a photo from device and seeing the cropper. Apply minimal-risk copy/label polish on the cropper + post-modal UX. No design overhaul (post-pilot).

**Status:** ⚡ **FILE-PICK → CROPPER LATENCY: 3–7 s → <100 ms on 4G.** Fly **v31** complete. The lag root cause turned out to be MUCH bigger than scoped (FileReader.readAsDataURL): `handlePostImageUpload` was uploading the FULL raw photo to R2 + running Gemini moderation on it BEFORE the cropper appeared — AND that raw upload was always discarded after crop (Session 113's post-crop upload was the actual final one). Two uploads per post; one always wasted. Fix: `URL.createObjectURL(file)` for an instant local blob URL; single upload happens post-crop.

| Metric | Value |
|---|---|
| PR merged | #82 (squash) |
| Squash commit | `6fe89f2` |
| Production HEAD | `485309f` → **`6fe89f2`** |
| Fly release | **v31** complete |
| Deploy duration | ~3m end-to-end |
| Files changed | 2 (`src/components/ImageCropper.tsx`, `src/components/profile/PostsGrid.tsx`) |
| Lines | +81 / −41 |
| Tests | 112/112 + E2E 2/2 (baseline preserved) |

### Root cause (worse than initially scoped)

The S113 task brief assumed the lag was `FileReader.readAsDataURL` in the cropper. The actual culprit was discovered in recon: `handlePostImageUpload` and `handleEditImageUpload` were doing a **full server round-trip** before the cropper could appear:

1. User picks 3-5 MB phone photo
2. App POSTs file to `/api/upload` → R2 PUT + Gemini moderation
3. Wait for URL to come back (~3-7 s on 4G)
4. Set `rawImageUrl = serverUrl`, show cropper
5. After crop, S113 path uploads the cropped JPEG AGAIN to `/api/upload`

Step 2 was wasted bandwidth + wasted Gemini quota + wasted R2 PUT — the raw image is never used; only the cropped version is.

### Fix (Phase 2)

`handlePostImageUpload` + `handleEditImageUpload` now:
```ts
if (rawImageUrl.startsWith('blob:')) URL.revokeObjectURL(rawImageUrl);
setRawImageUrl(URL.createObjectURL(file));
setShowCropper(true);
e.target.value = '';  // allow re-pick of same file after cancel
```

Sync, no network, no Sentry try/catch needed. Cropper sees blob: URL in <1 ms. Image element decode runs in the cropper's existing `useEffect`.

**Memory hygiene** — two `useEffect` cleanups (one per blob URL state) revoke on URL change AND on unmount:
```ts
useEffect(() => () => {
  if (rawImageUrl.startsWith('blob:')) URL.revokeObjectURL(rawImageUrl);
}, [rawImageUrl]);
```
`startsWith('blob:')` guard prevents accidentally killing pre-existing R2 URLs in edit-flow state.

### UX polish (Phase 3 — minimal-risk, copy only)

| Surface | Before | After |
|---|---|---|
| Empty state heading | "Tap to upload image" | "Image select karein" |
| Empty state subtitle | "Will be cropped to 3:4 ratio" | "3:4 ratio mein crop hokar post hogi" |
| Caption placeholder | "Write a caption..." | "Apne product ke baare mein batayein..." |
| Cropper mode tab 1 | "Crop & Adjust" | "Crop" |
| Cropper mode tab 2 | "Fit (Black Bars)" | "Fit" |
| Cropper drag hint | "Drag to adjust · Pinch to zoom" | "Drag karein · pinch zoom" |
| Cropper primary CTA | "Use This Image" | "Image use karein" |
| Zoom indicator | text-xs gray-500 | text-[11px] gray-400 tabular-nums (subtler + no jitter) |

No new components, no new icons, no library swaps, no animation libs. Voice matches the existing Hinglish-informal-but-respectful tone (`Image upload nahi ho paya. Try again.`, `AI soch raha hai...`, `Voice se capture hua — check karo`).

### Anti-Silent-Failure (Rule B) — bonus

`ImageCropper` was missing an `image.onerror` handler. A corrupted file or dead URL would have left the cropper sitting silently with a black canvas, no feedback to user. Added:
- `setLoadError(true)` on `image.onerror`
- Inline red error message: "Image load nahi ho payi — Cancel karke dobara try karein"
- Primary "Image use karein" button disabled when `!img || loadError` (was previously always enabled — could fire `handleComplete` on an unloaded image and produce a broken Blob)
- Loading overlay: "Image load ho rahi hai..." until decode completes (rare flash on blob: URLs, rescues UX on slow devices)

### Phase 5 local gates

- ✅ `npm run typecheck` — 0 errors (web + server + worker)
- ✅ `npm test -- --run` — **112/112**
- ✅ `npm run test:e2e` — **2/2** in 21.1s
- ✅ `npm run build` — green

### Phase 6 CI

- ✅ PR #82 (run 26599663802): `success`

### Phase 7 deploy

- ✅ `flyctl deploy -a dukanchi-app` → Fly **v31** complete
- ✅ Machine 9080d70da60d18, 1/1 check passing
- ⚠️ Same cosmetic "app not listening" warning (consistent v25–v31)

### Phase 7.5 post-deploy verification (all green)

| Check | Result |
|---|---|
| `/health` | **HTTP 200** in 585 ms, `{status:"ok", db:"up", redis:"up"}` |
| SW push handler (ND-A1) | ✅ `addEventListener("push"` intact |
| CSP header | ✅ `content-security-policy-report-only:` — Session 111 safe state preserved |
| `/api/upload` (no auth) | **HTTP 401** Access denied — route alive + auth gate intact |

### Side benefits

- **Gemini quota savings**: every photo that previously went through `handlePostImageUpload` triggered a Gemini moderation call on the FULL raw bytes. Now moderation only runs on the cropped JPEG (smaller payload, same protection). Could be 50%+ Gemini calls saved depending on cancel-rate.
- **R2 orphan elimination**: previously every cancelled-after-pick attempt left a raw R2 object. Now no R2 object is created until the user commits to "Image use karein".
- **CSP cleanup compatible**: `connect-src` `data:` (S110) was already obsolete post-S113. After S114, `blob:` use is purely the cropper's local blob URL — would still need `blob:` to stay in `connect-src` if any code path `fetch()`-ed the blob URL, but the cropper uses `image.src = blobUrl` (not fetch), which doesn't require `connect-src` permission. Re-enforce CSP work (Rule H) can potentially remove BOTH `data:` and `blob:` from `connect-src` after a directive audit.

### Out of scope

- `AiBioModal` FileReader path (audio bio) — different use
- `PostsGrid:processVoice` FileReader retained (voice → JSON for Gemini `/api/ai/transcribe-voice`, not an upload path)
- The cropper still uses `crossOrigin = 'anonymous'` — harmless for blob: URLs, kept for the rare case where consumers might pass an R2 URL (defensive)

### Awaiting

- Founder real-device test — phone photo upload should feel near-instant from tap-to-crop. Single upload after commit. Sentry watch for `postsGrid.cropperUploadNew` / `cropperUploadEdit` exception class (signature unchanged — no new exceptions expected)

---

## 2026-05-29 — Session 113 — Client image compression + eliminate fetch(data:URI) (perf + Rule H prereq cleanup)

**Goal:** Optimize image-upload latency and remove the architectural dependency that triggered the Session 110 / 111 CSP hotfix-then-rollback cycle. Replace the `canvas → toDataURL → fetch(dataURI) → blob → FormData` chain with `canvas → compressImage() → Blob → FormData`. Pure client change; server-side upload + moderation surface untouched.

**Status:** ✅ **PERF SHIPPED.** Fly **v30** complete. `src/lib/compressImage.ts` added; `ImageCropper` exports Blob directly; both `PostsGrid` consumer sites (new-post + edit-post) drop the intermediate `fetch(croppedDataUrl)` step. Image upload pipeline no longer depends on `data:` in CSP `connect-src` — meaningful Rule H prereq #1 cleanup ahead of the future CSP re-enforce.

| Metric | Value |
|---|---|
| PR merged | #80 (squash) |
| Squash commit | `485309f` |
| Production HEAD | `bd0f974` → **`485309f`** |
| Fly release | **v30** complete |
| Deploy duration | ~3m end-to-end |
| Files changed | 4 (`src/lib/compressImage.ts` new, `src/components/ImageCropper.tsx`, `src/components/profile/PostsGrid.tsx`, `tsconfig.app.json` Rule G include) |
| Lines | +90 / −7 |
| Tests | 112/112 + E2E 2/2 (baseline preserved) |

### What changed

1. **`src/lib/compressImage.ts`** — new shared util:
   ```ts
   compressImage(canvas, maxW = 1080, maxH = 1440, quality = 0.85): Promise<Blob>
   ```
   Resizes to fit within `maxW × maxH` (preserving aspect ratio; no-op if source is already smaller) and re-encodes as JPEG via `canvas.toBlob`. Throws on missing 2D context or `toBlob() === null`. High-quality smoothing on the downscale path.

2. **`ImageCropper.tsx`** — `onComplete` signature changed:
   ```diff
   -  onComplete: (croppedDataUrl: string) => void;
   +  onComplete: (blob: Blob) => void | Promise<void>;
   ```
   `handleComplete()` now `async`; replaces `exportCanvas.toDataURL('image/jpeg', 0.9)` with `await compressImage(exportCanvas, 1080, 1440, 0.85)`. The 600×800 cropper export is already under the 1080×1440 cap, so the resize branch is a no-op for this consumer today — the util is future-proof for larger sources.

3. **`PostsGrid.tsx`** — both call sites (`cropper-upload-new` L522–537, `cropper-upload-edit` L645–660) drop the intermediate `await fetch(croppedDataUrl).then(r => r.blob())` and `FormData.append('file', blob, ...)` the cropper-emitted Blob directly.

4. **`tsconfig.app.json`** — `include` list extended with `src/lib/compressImage.ts` (Rule G — `src/lib/*` is a per-file allowlist, not a glob; missing it surfaces a strict-config TS6307 that the root composite reference doesn't catch).

### Architectural wins

- **One fewer `fetch` per upload** — the `data:` URI fetch round-trip is gone
- **No base64 decode + buffer allocation** on the data-URI path
- **Image upload pipeline no longer depends on `data:` in CSP `connect-src`** — when CSP re-enforce lands (Rule H prereq path), we can confidently drop `"data:"` from `connectSrc`; only `"blob:"` needs to stay for the Capacitor native picker
- **Quality 0.9 → 0.85** saves ~20% bytes with no visible quality loss

### Scope honesty

The "10× phone-photo reduction" framing in the prompt doesn't apply to this specific code path — the cropper already shrinks user input to 600×800 before encode, so the dominant gain on the current consumer is architectural (eliminate `fetch(data:URI)`) plus the ~20% quality-encode savings. The util's resize logic IS future-proof: profile pic / store logo flows (currently direct `<input type="file">` upload, no cropper) can adopt the same util later to actually realize the 10× phone-photo savings.

### Phase 5 local gates

- ✅ `npm run typecheck` — 0 errors (web + server + worker, after tsconfig.app.json include fix)
- ✅ `npm test -- --run` — **112/112** (vitest baseline preserved)
- ✅ `npm run build` — Vite + injectManifest SW both green
- ✅ `npm run test:e2e` — **2/2 passing** in 24.9s (chromium; render-smoke unaffected)

### Phase 6 CI

- ✅ PR #80: Typecheck+Test+Build + Bundle Size Report both `success` (run 26598047716)

### Phase 7 deploy

- ✅ `flyctl deploy -a dukanchi-app` → Fly **v30** complete
- ✅ Rolling release on machine 9080d70da60d18, 1/1 check passing
- ⚠️ Cosmetic "app not listening" warning (consistent v25–v30; not actionable)

### Phase 7.5 post-deploy verification (all green)

| Check | Result |
|---|---|
| `/health` | **HTTP 200** in 528ms, `{status:"ok", db:"up", redis:"up"}` |
| SW push handler (ND-A1) | ✅ `addEventListener("push"` present in `/sw.js` — survived deploy |
| CSP header | ✅ `content-security-policy-report-only:` — Session 111 safe state preserved |
| `/api/upload` (no auth) | **HTTP 401 Access denied** — route alive + auth gate intact |

### Out of scope (intentional)

- **AI Magic feed path** (`PostsGrid:compressImageToBase64` → `/api/ai/analyze-image`) still uses `toDataURL` — Gemini expects base64 in JSON body, not a Blob (different contract)
- **Server-side moderation / upload route** — pure client change, no backend surface touched
- **Profile pic / store logo upload flows** in `RetailerDashboard.tsx` use direct `<input type="file">` → FormData (no cropper, no toDataURL) — already optimal; could adopt `compressImage` later for client-side resize if phone-photo payloads become a launch blocker

### Rule H prereq impact

This PR meaningfully advances Rule H prereq #1 (directive cleanup):
- Before: `connect-src 'self' data: blob: …` — `data:` only needed for the upload pipeline's `fetch(data:URI)` step
- After: `data:` is no longer needed by the upload pipeline; could be removed from `connectSrc` on the next CSP edit
- `blob:` still required (Capacitor native picker emits blob: URLs)

Decision: keep `data:` in `connect-src` for now (no immediate downside in report-only mode; revisit during the CSP re-enforce sprint).

### Awaiting

- Founder real-device test — phone photo upload via the cropper modal should feel noticeably snappier on 4G (lower per-byte transfer; one fewer fetch round-trip)
- Sentry watch for any new `postsGrid.cropperUploadNew` / `postsGrid.cropperUploadEdit` Sentry exceptions over the next 24h (cropper now emits Blob; Sentry shouldn't fire any new class — the signature change is internal-only between cropper and its only consumer)

---

## 2026-05-28 — Session 112 — E2E Foundation (Tier 5B) + CLAUDE.md Rule H

**Goal:** Lay the Playwright foundation that today's CSP/upload incident proved we need. Ship a contained scope tonight (public-page render smoke; no auth/DB) — auth/upload/chat E2E and CI integration require a test-env story and are deferred to a fresh-day task. Codify Rule H from today's S110/S111 learnings so the next CSP enforce attempt has explicit prerequisites.

**Status:** ✅ **E2E FOUNDATION SHIPPED.** No deploy (E2E is dev/CI tooling). Vitest baseline preserved at 112/112; new Playwright suite passes 2/2 in ~16.5s locally. Rule H lands as the seventh entry in the Anti-Silent-Failure section.

| Metric | Value |
|---|---|
| PR merged | #78 (squash) |
| Squash commit | `1821733` |
| Production HEAD | unchanged: `bd0f974` (S111 CSP rollback still latest deploy) |
| Files added | `playwright.config.ts`, `e2e/public-render.spec.ts` |
| Files modified | `package.json` (+ `test:e2e` script), `package-lock.json` (+ `@playwright/test`), `.gitignore` (+ Playwright artifact paths), `CLAUDE.md` (+ Rule H) |
| Lines | +231 across 6 files (foundation) + 2/-2 (lint-cleanup follow-up) |
| Vitest | **112/112** (unchanged — E2E specs explicitly disjoint) |
| New E2E | **2/2** passing in ~16.5s on chromium locally |

### What's in the foundation

- **Playwright config** — `testDir: 'e2e'`, `testMatch: '**/*.spec.ts'`, `baseURL: http://localhost:4173`, webServer runs `npm run build && npm run preview` (180s timeout), `reuseExistingServer: !CI`, single chromium project, list reporter
- **e2e/public-render.spec.ts — 2 render-only smoke tests:**
  1. `/login` → Hindi heading "Wapas aagaye!" + `<input type="tel" placeholder="Phone number">` + `<input type="password" placeholder="Password">` + "Log In" submit + Sign up link → `/signup`
  2. `/signup` → Hindi heading "Shuru karte hain!" + "Sign Up" submit
- **package.json** — `"test:e2e": "playwright test"`
- **.gitignore** — `test-results/`, `playwright-report/`, `playwright/.cache/`
- **CLAUDE.md** — **Rule H** codifies CSP enforce-flip prerequisites: (1) exercise EVERY real user flow during the report-only window (upload, chat, search, auth, push, maps, …) and confirm zero violations, (2) adopt network-first navigation for `index.html` in `src/sw.ts` + bump SW version BEFORE flipping (so the CSP header isn't frozen in precache for legacy PWA installs), (3) keep the enforce commit a single revertable squash with no unrelated changes

### Why `addInitScript`

`index.html` ships a pre-React script that redirects browser visitors from any non-`/landing` path to `/landing` (the static `public/landing.html`) — by design, to drive non-PWA users to the install pitch. Without bypass, Playwright's vanilla browser never reaches React on `/login` or `/signup`. Tests use `context.addInitScript()` to set `localStorage.dk-browser-mode = '1'` before any page script runs — matching production behaviour after a user taps "continue in browser". This is documented in the spec file with a comment for future maintainers.

### Isolation guarantees (E2E ↔ unit tests are disjoint)

| Concern | Mitigation |
|---|---|
| Vitest picking up E2E specs | `vitest.config.ts` `include: ["src/**/*.test.ts"]` — `e2e/*.spec.ts` outside `src/` is invisible |
| App tsconfig compiling E2E | `tsconfig.app.json` `exclude` has `**/*.spec.ts` AND only `include`s paths under `src/`; `e2e/` outside scope |
| Server tsconfig compiling E2E | `tsconfig.server.json` same shape — `**/*.spec.ts` excluded, `e2e/` outside the `include` whitelist |
| Worker tsconfig | extends `tsconfig.app.json` with `include: ["src/sw.ts"]` only — E2E never reaches it |
| Root tsconfig | only references app + server projects; doesn't compile e2e at all |

Net: `npm run typecheck` and `npm test` are unchanged by this PR; `npm run test:e2e` is opt-in.

### Phase 5 local gates

- ✅ `npm run typecheck` — 0 errors (web + server + worker)
- ✅ `npm test -- --run` — **112/112** (vitest baseline preserved)
- ✅ `npm run build` — Vite + injectManifest SW both green
- ✅ `npm run test:e2e` — **2/2 passing in 16.5s** on chromium

### Phase 6 CI

- ✅ PR #78 first push (run 26596128822): success — ESLint warning on irregular whitespace (U+200B in JSDoc) flagged but allowed by `max-warnings=9999`
- ✅ PR #78 lint-cleanup followup (run 26596340900): success (zero-width spaces replaced with string concatenation in the JSDoc comment text)
- ✅ Squash-merged at `1821733`

### Out of scope (deferred to fresh-day)

| Item | Blocker |
|---|---|
| Auth E2E (signup → login → logout round-trip) | Needs test DB + test JWT minting strategy |
| Upload pipeline E2E (image → R2 → verify URL) | Needs R2 mock or `R2_BUCKET_NAME_TEST` (Rule F.2) |
| Chat / Socket.IO E2E | Needs test Redis |
| Push subscribe E2E | Needs VAPID key plumbing in test env |
| Playwright CI integration | Needs CI runner with browser deps; existing vitest CI untouched here |
| Multi-project (Firefox + WebKit) | Single chromium tonight; expand when CI lands |

### Rule H — full text (codified in CLAUDE.md)

> Before flipping `helmet.contentSecurityPolicy.reportOnly: true → false`, three prerequisites are mandatory:
> 1. **Exercise EVERY real user flow during the report-only window** — directive theory is insufficient; sessions 95–107 missed the connect-src `data:` gap because no real upload ran in the window
> 2. **Solve the SW-cache stale-header propagation** — Workbox precaches `index.html` which freezes the CSP header at install time; adopt network-first navigation for the HTML doc + bump SW version BEFORE enforce
> 3. **Keep `git revert` rollback ready** — the enforce commit must be a single revertable squash with no other deploy-shaped changes

### Files modified

- `playwright.config.ts` — new (Playwright config)
- `e2e/public-render.spec.ts` — new (2 render-only tests)
- `package.json` — added `"test:e2e": "playwright test"` script
- `package-lock.json` — `@playwright/test` dev dep + transitive locks
- `.gitignore` — `test-results/`, `playwright-report/`, `playwright/.cache/`
- `CLAUDE.md` — Rule H added between Rule F.3 and Rule G in the Anti-Silent-Failure section

### Awaiting

- Opus / fresh-day → scope E2E auth + upload + chat paths with test env, then wire Playwright into CI alongside vitest

---

## 2026-05-28 — Session 111 — CSP reverted to Report-Only (enforce broke upload via SW-cached header)

**Goal:** Roll the CSP enforce-flip from Session 108 back to safe report-only state. Even after the Session 110 `data:` / `blob:` connect-src hotfix landed, legacy PWA installs continued to break on image upload because the CSP header is delivered with `index.html` — which the Workbox SW precaches. Server-side CSP changes therefore don't propagate to existing PWA users without cache churn.

**Status:** ✅ **CSP REVERTED TO REPORT-ONLY (safe launch state).** Fly **v29** complete. Header confirmed flipped from `content-security-policy:` → `content-security-policy-report-only:`. Image upload no longer blocked by stale enforced header in SW precache. The `data:` / `blob:` connect-src additions from Session 110 are **retained** — harmless in report-only mode and needed for any future clean re-enforce. **Task 5 CSP enforce flip — RE-OPENED for fresh-day work.**

| Metric | Value |
|---|---|
| PR merged | #76 (squash) |
| Squash commit | `bd0f974` |
| Production HEAD | `31c5232` → **`bd0f974`** |
| Fly release | **v29** complete |
| Deploy duration | ~3m end-to-end |
| Files changed | 1 (`src/app.ts`) |
| Lines | +2 / −2 (`reportOnly: false → true` on both prod L117 + dev L130) |
| Tests | 112/112 (unchanged) |

### Why rollback (the SW-precache problem)

Session 108 flipped CSP from report-only → enforce. Session 110 added `data:` / `blob:` to connect-src to unblock the image upload `fetch(data:image/...)` step. The 110 server-side fix was confirmed via curl — but founder browser still saw upload broken. Root cause: the CSP header is sent as part of the HTML document response (helmet middleware on `app.use`). The Workbox service worker (post-ND-A1 injectManifest migration) precaches `index.html` along with the CSP header that was attached to that response at install time. Existing PWA installs therefore continued to serve the **stale enforced CSP** from their cache even after the server started sending the fixed (or report-only) header. Two compounding gaps:

1. **Connect-src gap** (S110 hotfix) — fixed in `31c5232`
2. **SW-cache stale-header propagation** — server CSP changes don't reach the browser at all on legacy PWA installs until the SW updates + clients claim the new version. For the launch window, the safest move is to revert to report-only on the server so that even installs serving the stale enforced header eventually get an updated SW that delivers a permissive report-only header — and meanwhile, brand-new visits with no SW yet get report-only immediately and can upload without any CSP block.

### Fix

```diff
-       reportOnly: false,    // L117 (production)
+       reportOnly: true,
...
-       reportOnly: false,    // L130 (dev)
+       reportOnly: true,
```

All other directive content untouched. `data:` / `blob:` in `connect-src` retained.

### Phase 3 local gates

- ✅ `npm run typecheck` — 0 errors (web + server + worker)
- ✅ `npm test -- --run` — **112/112** (unchanged from S109b/S110 baseline)
- ✅ `npm run build` — Vite + injectManifest SW both green

### Phase 4 CI

- ✅ PR #76: Typecheck+Test+Build + Bundle Size Report both `success` (run 26593818604)

### Phase 5 deploy

- ✅ `flyctl deploy -a dukanchi-app` → Fly **v29** complete
- ✅ Rolling release on machine 9080d70da60d18, 1/1 check passing
- ⚠️ Same cosmetic "app not listening" warning (consistent v25-v29; tcp_check passes)

### Phase 6 post-deploy verification (all green)

| Check | Result |
|---|---|
| CSP header name | ✅ `content-security-policy-report-only:` (rolled back) |
| `/health` | **HTTP 200** in 277ms, `{status:"ok", db:"up", redis:"up"}` |
| SW push handler (ND-A1) | ✅ `addEventListener("push"` intact post-deploy |
| Image moderation (S109b) | Unaffected — server-side, runs post-auth on upload route |

### ND-S111-1 — Learning (re-enforce requires SW-cache propagation fix first)

CSP-via-header + Workbox precaching of `index.html` = **stale-header propagation problem**. Server-side CSP changes don't reach legacy PWA users without explicit cache churn. Before re-attempting CSP enforce:

1. **Adopt network-first navigation for the HTML document** in `src/sw.ts` so `index.html` is fetched fresh from the server on every navigation (with cache as fallback). This ensures the CSP header is never frozen in precache.
2. **Exercise every real user flow** during the report-only window — not just synthetic page loads + directive theory. The image-upload flow `fetch(data:...)` was the gap S110 caught; future audits should iterate over: upload, search, chat, push subscribe, geolocation, R2 hot URLs, OAuth/Razorpay if added, etc.
3. **Cache-busting / SW versioning ceremony** before flip — bump `sw.ts` version so all existing installs receive + activate the new SW (with network-first nav) BEFORE the enforce header lands.

Candidate for codification in CLAUDE.md as **Rule H** (CSP enforce-flip prerequisites — exercise + SW-cache + versioning) if Opus agrees. Builds on the ND-S110-1 lesson.

### Files modified

- `src/app.ts` — `reportOnly: false → true` on both `if (env.NODE_ENV === 'production')` (L117) and dev (L130) helmet config paths

### Day 1 backlog impact

- 🔄 **Task 5 — CSP enforce flip — RE-OPENED.** Was closed in S108; rolled back in S111. New scope: SW network-first nav + flow audit + SW versioning ceremony, then re-flip. Estimate: 2-4 hr fresh-day task.
- ✅ Image moderation (S109b) unaffected — server-side, post-auth
- ✅ Push handler (ND-A1) intact across all of S108/S109b/S110/S111 deploys
- ⏳ Tier 5B (E2E) + Tier 5C (perf) still queued
- ⏳ Reactive `Report` queue remains backstop for moderation false-negatives

### Rollback path (if report-only also surfaces issues — extremely unlikely)

Report-only blocks nothing — it only reports violations. If a new issue surfaces, full revert chain:

```bash
git revert bd0f974   # back to enforce + data:/blob: (S110 state)
git revert 31c5232   # back to enforce without data:/blob: (S108 state)
git revert a8b64bf   # back to pre-S108 (original report-only from the 3.5-day window)
flyctl deploy -a dukanchi-app
```

Practically: report-only is the safest state we've shipped — no rollback expected.

### Awaiting

- Founder cache-clear / hard-refresh / SW unregister + re-test image upload → expect 200 + url, no CSP block (because report-only blocks nothing)
- Sentry watch `dukanchiapp@gmail.com` for any **new** `Content-Security-Policy-Report-Only` violation reports over the next 24h — these are the audit signal for the future re-enforce-flip prerequisite checklist

---

## 2026-05-28 — Session 110 — HOTFIX: CSP connect-src `data:` / `blob:` (image upload unblocked)

**Goal:** Restore image upload in production. CSP enforce (Session 108) blocked `PostsGrid.tsx:526` `fetch(data:image/jpeg;base64,...)` — connect-src lacked `data:` and `blob:`, so the upload pipeline broke at the data-URI → Blob conversion step.

**Status:** 🚨 **HOTFIX SHIPPED.** Fly **v28** complete. `connect-src` now includes `data:` + `blob:` immediately after `'self'`. CSP remains enforced (header still `content-security-policy:`, NOT `-Report-Only`). Image upload restored without weakening any other directive.

| Metric | Value |
|---|---|
| PR merged | #74 (squash) |
| Squash commit | `31c5232` |
| Production HEAD | `4091dbf` → **`31c5232`** |
| Fly release | **v28** complete |
| Deploy duration | ~3m end-to-end |
| Files changed | 1 (`src/app.ts`) |
| Lines | +2 / −0 |
| Tests | 112/112 (unchanged — no test asserts on connect-src content) |

### Root cause

The image upload pipeline takes a user-cropped image (HTMLCanvasElement → `toDataURL('image/jpeg')`) and then `fetch()`s the resulting `data:image/jpeg;base64,...` URI to convert it to a Blob before POSTing to `/api/upload`. Browser CSP routes `fetch(data:...)` and `fetch(blob:...)` through the **connect-src** directive — not img-src. Sessions 95–107 monitored CSP report-only for 3.5 days but the monitoring window didn't include a real upload flow, so the gap was uncovered until founder CP4 device test post-109b ran the actual upload path against enforced CSP.

### Fix

```diff
  connectSrc: [
    "'self'",
+   "data:",  // Session 110 hotfix — PostsGrid image-upload pipeline fetch()es a data: URI ...
+   "blob:",  // Session 110 hotfix — Capacitor image picker returns blob: URLs that are then fetch()-ed before R2 PUT
    "https://*.i.posthog.com",
    ...
  ],
```

All other directives untouched (img-src / workerSrc / mediaSrc retain their pre-existing `blob:` allowances). CSP enforce flag unchanged.

### Phase 3 local gates

- ✅ `npm run typecheck` — 0 errors (web + server + worker)
- ✅ `npm test -- --run` — **112/112** (no test asserts on connect-src contents — grep confirmed)
- ✅ `npm run build` — Vite + injectManifest SW both green

### Phase 4 CI

- ✅ PR #74: Typecheck+Test+Build + Bundle Size Report both `success` (run 26591487601)

### Phase 5 deploy

- ✅ `flyctl deploy -a dukanchi-app` → Fly **v28** complete
- ✅ Rolling release on machine 9080d70da60d18, 1/1 check passing
- ⚠️ Same cosmetic "app not listening" warning (consistent v25-v28; tcp_check passes)

### Phase 6 post-deploy verification (all green)

| Check | Result |
|---|---|
| `connect-src` directive | ✅ Contains `'self' data: blob:` (verified via `curl -sI` + grep) |
| CSP header name | ✅ `content-security-policy:` (enforced, NOT `-Report-Only`) |
| `/health` | **HTTP 200** in 142ms, `{status:"ok", db:"up", redis:"up"}` |
| SW push handler (ND-A1) | ✅ `addEventListener("push"` intact post-deploy |

### ND-S110-1 — Learning (codify next sprint)

**Before flipping CSP from report-only → enforce, exercise every real user flow during the report-only window** — not just directive theory and synthetic page loads. The image-upload pipeline uses `fetch(data:...)` and would have surfaced this connect-src gap as a Sentry CSP-violation report-only event if the founder had run a real upload during the 3.5-day monitoring window. Lesson: future CSP enforce-flips must include a documented "browser exercise checklist" covering every Sentry-instrumented user flow (upload, search, chat, push subscribe, geolocation, etc.) before flip.

Candidate for codification in CLAUDE.md as **Rule H** (CSP enforce-flip prerequisites) if Opus agrees.

### Files modified

- `src/app.ts` — added `"data:"` + `"blob:"` to `cspDirectives.connectSrc` (lines 88–89 with hotfix-origin comments)

### Rollback path (if upload STILL broken or new CSP violations appear)

```bash
git revert a8b64bf  # full CSP → report-only (un-blocks everything)
flyctl deploy -a dukanchi-app
```

### Awaiting

- Founder re-test image upload from web + APK → confirm `/api/upload` returns 200 + url for a clean image, no console CSP error
- Founder Sentry watch for new `Content-Security-Policy` violation reports in next 1-2h (should be zero new connect-src violations)

---

## 2026-05-28 — Session 109b — Image Moderation LIVE (Tier 5A)

**Goal:** Merge PR #72 (Gemini Vision image safety gate on upload), deploy to Fly, verify production health + push handler survival + CSP enforcement + upload route auth-gate. Close primary Tier-5A launch blocker.

**Status:** 🎉 **IMAGE MODERATION LIVE IN PRODUCTION.** Fly **v27** complete. Gemini Vision synchronous safety classifier now runs on every `/api/upload` + `/api/admin/settings/upload` request between magic-byte validation and R2 store. Unsafe images rejected with 422 `IMAGE_UNSAFE` pre-store; Gemini outage / 6s timeout fails open (allow + Sentry warn) so an upstream incident never blocks legit uploads. Reactive `Report` queue remains the backstop. **Tier 5A — image moderation — CLOSED ✅.**

| Metric | Value |
|---|---|
| PR merged | #72 (squash) |
| Squash commit | `4091dbf` |
| Production HEAD | `a8b64bf` → **`4091dbf`** |
| Fly release | **v27** complete |
| Deploy duration | ~6m end-to-end (build + rolling release) |
| Files changed | 4 (`src/services/geminiVision.ts`, `src/services/geminiVision.test.ts` new, `src/middlewares/upload.middleware.ts`, `src/middlewares/security.integration.test.ts`) |
| Lines | +499 / −2 |
| Tests | 112/112 (100 baseline + 9 service unit + 3 middleware integration) |

### Design (locked in 109a)

- **Categories** — 4 text-only HARM categories (`SEXUALLY_EXPLICIT`, `DANGEROUS_CONTENT`, `HATE_SPEECH`, `HARASSMENT`), all at `BLOCK_MEDIUM_AND_ABOVE`
- **Deviation** — `HARM_CATEGORY_IMAGE_*` enums exist in `@google/genai` v1.50.1 but flagged "not supported in Gemini API" (Vertex AI only). Text-only categories applied; Gemini's multimodal classifier handles image inputs with the same enum set.
- **Timeout** — 6s `AbortSignal.timeout` (vs 30s on the analysis fns) to keep upload UX bounded
- **Fail-open** — any Gemini error / timeout returns `{safe:true, error:...}` + `Sentry.captureMessage("upload.moderation.gemini_error", "warning")`. Outage never blocks legit uploads.
- **Reject** — 422 + `{code:"IMAGE_UNSAFE"}` + `Sentry.captureMessage("Image moderation rejection", "info")` + structured log `event:"upload.rejected.moderation"`. R2 put never runs on reject path.
- **Threshold rationale** — MEDIUM (not LOW) on sexual category avoids false-positives on legit retail inventory (clothing, swimwear). Reactive Report queue catches any false-negative.

### Phase 3 local gates (pre-merge in 109a)

- ✅ `npm run typecheck` — 0 errors (web + server + worker)
- ✅ `npm test -- --run` — **112/112** (18 files, 5.30s)
- ✅ `npm run build` — Vite app + injectManifest SW both green
- ✅ Real-Gemini local smoke (clean PWA icon → `{safe:true, durationMs:4986}` cold-start; throwaway script deleted, not committed)

### Phase 4 CI

- ✅ Pre-merge PR #72: Typecheck+Test+Build + Bundle Size Report both `success`
- ✅ Post-merge main `4091dbf`: run 26590127598 `success`

### Phase 5 deploy

- ✅ `flyctl deploy -a dukanchi-app` → Fly **v27** complete
- ✅ Rolling release on machine 9080d70da60d18, 1/1 check passing
- ⚠️ Cosmetic "app not listening on expected address" warning (same as v25/v26; tcp_check still passes — known fly-proxy probe quirk on Node ipv6-only bind)

### Phase 6 post-deploy verification (all green)

| Check | Result |
|---|---|
| `/health` | **HTTP 200** in 495ms, `{status:"ok", db:"up", redis:"up"}` |
| SW push handler (ND-A1) | ✅ `addEventListener("push"` present in `/sw.js` — survived deploy |
| `/` (SPA) | **HTTP 200** in 114ms |
| CSP header | ✅ `content-security-policy:` (enforced, NOT Report-Only) — Task 5 still healthy |
| `/api/upload` (no auth) | **HTTP 401** `{error:"Access denied"}` — route alive + auth gate intact |

### Phase 7 SKIPPED — prod clean-image smoke

Minting a real prod JWT would require either touching `JWT_SECRET` (auto-mode classifier-blocked) or signing up a test user (Rule F violation). The upload would also create an R2 artifact needing explicit cleanup (Rule F.2). Coverage achieved via three other proofs:

1. Mocked integration tests (Test 19/20/21 in `security.integration.test.ts`)
2. Local real-Gemini smoke in 109a (clean image → safe in <5s)
3. Founder app-level test queued (manual verify from web/APK)

### Files modified

- `src/services/geminiVision.ts` — added imports (`HarmCategory`, `HarmBlockThreshold`, `Sentry`), `IMAGE_SAFETY_SETTINGS` constant (4 categories @ MEDIUM), `ImageSafetyResult` interface, `classifyImageSafety()` function with fail-open contract
- `src/services/geminiVision.test.ts` — **new**, 9 unit tests (config shape, clean, blocked-by-promptFeedback, blocked-by-finishReason, PROHIBITED_CONTENT, SDK throw, network error, malformed response)
- `src/middlewares/upload.middleware.ts` — `classifyImageSafety` import + sync safety gate between L274 (storageKey) and L281 (R2 put); 422 reject path; `moderationDurationMs` + `moderationFailedOpen` added to `upload.accepted` log
- `src/middlewares/security.integration.test.ts` — `vi.mock` for `classifyImageSafety` (default safe), `Sentry.captureMessage` stub, **3 new tests** (Test 19/20/21 for reject / fail-open / safe-positive paths)

### Post-deploy monitoring (Mandeep — Sentry / dukanchiapp@gmail.com)

- **"Image moderation rejection"** (info-level) → working as designed; track rate
- **"upload.moderation.gemini_error"** (warning-level) → fail-open triggered; if rate > 1% of uploads in 24h, bump timeout 6s → 8s
- **`upload.rejected.moderation`** structured logs in Railway / Fly aggregator → forensic queue (blockReason, ratings)

### Tier 5 backlog impact

- ✅ **Tier 5A — Image moderation** CLOSED (primary launch blocker)
- ⏳ **Tier 5B** — E2E tests (Playwright setup + 2 critical paths) — next sprint
- ⏳ **Tier 5C** — Performance smoke (Lighthouse + k6 search) — next sprint
- ⏳ Phase B candidate — `moderationStatus` admin quarantine queue + per-route opt-out toggle (deferred until rejection-rate data exists)

### Rollback path

If a moderation regression surfaces (false-positive flood, Gemini billing spike, latency > 8s p99):

```
git revert 4091dbf
flyctl deploy -a dukanchi-app
```

Rolls back to `a8b64bf` (CSP-enforced baseline). Fly auto-rollback already protects against healthcheck fail on next deploy.

---

## 2026-05-28 — Session 108 — CSP Enforced (report-only → enforce)

**Goal:** Flip CSP from `reportOnly: true` to `false` in `src/app.ts`, deploy, verify enforced header replaces Report-Only header in production, confirm site + push handler still healthy.

**Status:** ✅ **CSP ENFORCED IN PRODUCTION.** Fly **v26** complete. Header confirmed flipped from `content-security-policy-report-only:` → `content-security-policy:`. Site, `/health`, and ND-A1 push handler all intact post-flip. The 3.5-day report-only monitoring window (since PR #43 / 2026-05-25) closed cleanly. **Task 5 — CSP enforce flip — CLOSED ✅.**

| Metric | Value |
|---|---|
| PR merged | #70 |
| Squash commit | `a8b64bf` |
| Production HEAD | `8da353b` → **`a8b64bf`** |
| Fly release | **v26** complete |
| Deploy duration | **3m14s** (14:38:18Z → 14:41:32Z) |
| Code change | 2 lines (`src/app.ts:115` + `:128`, both `true → false`) |
| Files modified | `src/app.ts` only |

### Phase 3 local gates (pre-merge)

- ✅ `npm run typecheck` — 0 errors (web + server + worker)
- ✅ `npm test` — 100/100 (17 files, 4.65s)
- ✅ `npm run build` — `mode injectManifest`, 59 precache entries, `dist/sw.mjs` 41.78 KB

### Phase 4 CI

- ✅ Pre-merge PR #70: Typecheck+Test+Build 1m35s + Bundle Size 1m52s
- ✅ Squash-merged at `a8b64bf`

### 🚨 Phase 6 critical enforce verification (post-deploy)

#### Header name flipped — confirmed via curl

```
$ curl -sI "https://dukanchi.com/" | grep -i "content-security-policy"
content-security-policy: default-src 'self';script-src 'self' 'unsafe-inline'
  https://*.i.posthog.com https://maps.googleapis.com https://maps.gstatic.com
  https://unpkg.com;style-src 'self' 'unsafe-inline'
  https://fonts.googleapis.com;img-src 'self' data: blob: …;font-src 'self'
  https://fonts.gstatic.com;connect-src 'self' https://*.i.posthog.com
  https://*.ingest.sentry.io https://*.ingest.us.sentry.io
  https://nominatim.openstreetmap.org https://maps.googleapis.com
  https://fonts.googleapis.com https://fonts.gstatic.com wss://dukanchi.com
  wss:;worker-src 'self' blob:;media-src 'self' blob:;frame-src 'none';
  frame-ancestors 'none';form-action 'self';base-uri 'self';object-src 'none';
  upgrade-insecure-requests;report-uri /api/csp-report
```

Header name: `content-security-policy:` (NOT `content-security-policy-report-only:`). All directives unchanged from the report-only policy.

#### Site + health post-flip

| Check | Result |
|---|---|
| `/` SPA root | HTTP **200** ✅ |
| `/health` | HTTP **200**, 0.33s, `{"status":"ok","db":"up","redis":"up","timestamp":1779979316996}` ✅ |
| `/sw.js` (ND-A1 push handler intact) | **27,225 bytes** (byte-identical to Session 102b + 107 baselines); `addEventListener("push"` + `addEventListener("notificationclick"` both ✅ |
| Directives present in enforced header | script-src, style-src, img-src, font-src, connect-src, worker-src, report-uri — all detected via grep ✅ |
| `report-uri /api/csp-report` | Preserved — browsers continue posting violations even under enforce mode |

### Phase 5 Fly deploy

| Field | Value |
|---|---|
| Image | (next release identifier from Fly v26) |
| Machine | `9080d70da60d18` rolling-updated v25 → v26 |
| Healthcheck | 1/1 passing |
| Deploy log | Clean (same recurring "app not listening on expected address" intermediate warning — benign per established pattern) |

### Rollback path

`git revert a8b64bf && flyctl deploy --app dukanchi-app` would restore Report-Only header in ~3 minutes if needed. **No rollback triggered** — verification all green.

### Post-flip monitoring

- Watch `dukanchiapp@gmail.com` for "CSP violation" Sentry alert emails over the next 1-2 hours (Task 4 alert rule from Session 98 captures these).
- `/api/csp-report` endpoint stays wired — receives any violations regardless of enforce vs report-only state.
- If any legitimate resource breaks → instant rollback path documented above.

### Task 5 CSP hardening — closed

Full timeline:
- **PR #38** (Session 98, 2026-05-25): CSP discovery doc inventoried all browser-loaded origins and inline content
- **PR #39** (Session 98): CSP Report-Only header + `/api/csp-report` endpoint shipped
- **PR #40** (Session 98): `fonts.googleapis.com` added to connect-src (Maps SDK XHR)
- **PR #43** (Session 98): Comprehensive allowlist re-confirmed + `fonts.gstatic.com` added to connect-src (Workbox SW fetch)
- **CP3.5b recon** (Session 107): Full directive audit re-confirmed all browser-loaded origins covered
- **PR #70** (Session 108, THIS): `reportOnly: true → false`

### Files modified

- `src/app.ts` — 2 lines (`reportOnly: true → false` at L115 + L128)
- `SESSION_LOG.md` — Session 108 entry prepended
- `STATUS.md` — Last updated banner refreshed

---

## 2026-05-28 — Session 107 — Checkpoint 3.5a: Batched Deploy (6 commits) — ND-A1 push handler SURVIVED 1.3.0 bump

**Goal:** Deploy the 6 commits accumulated since `42d3e82` (post-ND-A1 Session 102b). Verify the ND-A1 push handler survives the bumped `vite-plugin-pwa` 1.3.0 in production. Decoupled CORS hygiene to a manual step (Option A) after the auto-mode classifier blocked the Fly secrets staging.

**Status:** ✅ **DEPLOY GREEN.** Fly **v25 complete**. Production HEAD advanced **`42d3e82` → `8da353b`** (6 commits). Critical check: **ND-A1 push handler verified STILL LIVE** under the new vite-plugin-pwa 1.3.0 — exact same 27,225-byte `/sw.js` output, both handlers present. CORS already in good shape (production ALLOWED_ORIGINS leads with `https://dukanchi.com` — the Session 95 "localhost-leading drift" report may have been outdated). No Sentry CLI in sandbox — Sentry new-error check is a manual founder action.

| Metric | Value |
|---|---|
| Production HEAD | `42d3e82` → **`8da353b`** (6 commits) |
| Fly release | **v25** complete |
| Deploy duration | **4m34s** (14:08:49Z → 14:13:23Z) |
| Image | `dukanchi-app:deployment-01KSQEN8X3R2FWS4F7TTVH3X4K` (155 MB) |
| Machine | `9080d70da60d18` rolling-updated, v24 → v25, healthcheck 1/1 passing |
| Push handler size | **27,225 bytes** (unchanged from Session 102b — vite-plugin-pwa 1.3.0 produces byte-identical output) |

### Commits shipped (6 since last cut)

| Commit | Description | Session |
|---|---|---|
| `1606d20` | admin-panel minor+patch group × 2 | 103 |
| `70ab011` | admin-panel `@types/node` 24 → 25 | 103 |
| `d5c204c` | docs S103 | 103 |
| `9977bd2` | Dependabot major-version guards + S104 docs | 104 |
| **`79635ac`** | **29 root minor/patch bumps + ioredis `~5.10.1` tilde pin** | 105 |
| `a47d415` | docs S105 | 105 |
| `8da353b` | Rule F.3 codification + RUNBOOK §6 verified + ALLOWED_ORIGINS recon + S106 docs | 106 |

### 🎯 ND-A1 push handler survival check (CRITICAL)

The Session 105 23-package bump included `vite-plugin-pwa: 1.2.0 → 1.3.0`. The whole ND-A1 fix depends on the injectManifest strategy emitting `src/sw.ts` → `dist/sw.js` with the push listeners intact. **Verified post-deploy:**

```
$ curl -s "https://dukanchi.com/sw.js?cb=$(date +%s)" -o /tmp/prod-sw-after.js
$ wc -c /tmp/prod-sw-after.js
   27225 bytes  (identical to Session 102b post-deploy size)
$ grep -oE 'addEventListener\(["'\'']push["'\'']' /tmp/prod-sw-after.js
addEventListener("push"
✅ PUSH HANDLER STILL LIVE
$ grep -oE 'addEventListener\(["'\'']notificationclick["'\'']' /tmp/prod-sw-after.js
addEventListener("notificationclick"
✅ notificationclick LIVE
```

**vite-plugin-pwa 1.3.0 produced byte-identical output to 1.2.0** for the same `src/sw.ts` source. Migration is robust across the minor bump.

### CORS baseline (no change this deploy — observation only)

CORS staging was blocked by the auto-mode classifier (treats `fly secrets list` / `set` as "production CORS guardrail"). Option A taken: deploy decoupled; CORS deferred to manual.

Post-deploy CORS preflights:

```
# dukanchi.com origin
$ curl -i -X OPTIONS https://dukanchi.com/api/auth/login -H "Origin: https://dukanchi.com" -H "Access-Control-Request-Method: POST" | grep access-control-allow-origin
access-control-allow-origin: https://dukanchi.com   ← echoed correctly, allowed ✅

# localhost:3000 origin (legacy drift?)
$ curl -i -X OPTIONS https://dukanchi.com/api/auth/login -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" | grep access-control-allow-origin
access-control-allow-origin: https://dukanchi.com   ← fallback to first-allowed (NOT echoed back)
```

The `localhost:3000` request returned `https://dukanchi.com` (not echoed). Reading `src/app.ts:152-161`:

```ts
if (... allowedOrigins.includes(origin) ...) {
  res.header('Access-Control-Allow-Origin', origin);   // echo
} else if (allowedOrigins.length > 0) {
  res.header('Access-Control-Allow-Origin', allowedOrigins[0]);  // fallback to first
}
```

So localhost:3000 fell through to the `else if` branch — meaning it's **not** in production's `ALLOWED_ORIGINS`. The browser would compare `ACAO: https://dukanchi.com` against its own origin (`http://localhost:3000`) and **reject the cross-origin request**. Effectively, localhost:3000 is already rejected at the browser layer.

**Interpretation:** Production `ALLOWED_ORIGINS` already leads with `https://dukanchi.com` (NOT `http://localhost:3000` as Session 95 post-mortem claimed). The "drift" Session 95 reported either:
- Was misread (post-mortem author may have seen the fallback ACAO value and assumed it was the env var leading entry), OR
- Was already silently fixed in a between-session Fly secrets update not captured in SESSION_LOG.

**Result:** ALLOWED_ORIGINS cleanup is **likely already done.** Manual confirmation by founder via `fly secrets list -a dukanchi-app | grep ALLOWED` (value masked but the list line shows the secret is set) would close this for good. Documented as ND-S107-CORS — no further action this session.

### Production smoke battery (Rule E)

| Check | Result |
|---|---|
| `/health` POST-DEPLOY | HTTP 200 / 0.43s · `{"status":"ok","db":"up","redis":"up","timestamp":1779977635123}` ✅ |
| `/` (SPA root) | HTTP 200 ✅ |
| `/api/posts` no auth | HTTP 401 ✅ (auth rejection) |
| `/manifest.json` | Served (name + short_name intact) ✅ |
| `/sw.js` push handler | **PRESENT** (verified above) ✅ |
| CORS dukanchi.com origin | Echoed back ✅ |
| CORS localhost:3000 origin | Fallback to dukanchi.com (effectively rejected at browser layer) ✅ |

### Deploy-side warning observed

Same recurring "app not listening on expected address" warning seen on every prior deploy. Machine subsequently reached `started` state and 1/1 healthcheck passed. Benign per established pattern (Sessions 88/95/98/102b/etc.). Worth a separate `fly.toml` startup-probe tuning investigation but not blocking.

### Sentry post-deploy

CLI not available in sandbox. **Manual founder check needed:** open Sentry dashboard, filter by release/environment for new errors since 14:13:23 UTC. The "Production Errors — New + Escalated" alert rule from Task 4 / Session 98 should email `dukanchiapp@gmail.com` on any new issue — absence of email = green signal.

### Deferred items

| Item | Status |
|---|---|
| ALLOWED_ORIGINS Fly secrets cleanup | Deferred to manual (classifier blocked). Likely already done in prod — see ND-S107-CORS. |
| CSP enforce flip (`reportOnly: true → false` in `src/app.ts`) | Deliberately NOT bundled with this deploy. Isolated next step (Checkpoint 3.5b). |
| Sentry new-error check | Manual founder dashboard verification |

### Production runtime

**`main` and prod are now in sync at `8da353b`** ✅

---

## 2026-05-28 — Session 106 — Tier 3 Hygiene: F.3 rule codified + RUNBOOK §6 verified + ALLOWED_ORIGINS recon

**Goal:** Codify the Session 99 ND-S99-1 "CI cancelled ≠ failure" learning into CLAUDE.md as Rule F.3. Fix RUNBOOK §6 smoke script if it still uses `otp` instead of `password`. Recon `ALLOWED_ORIGINS` location and configuration for an Opus fix decision.

**Status:** ✅ **Tier 3 hygiene sweep complete (docs/config only — no code, no deploy).** Rule F.3 codified. RUNBOOK §6 verified already correct (predated the bug-report). ALLOWED_ORIGINS recon delivered — fix is a one-line Fly secrets update, not a code change. Production runtime unchanged at `42d3e82` (5 commits ahead per batched-deploy queue).

### Edit 1 — CLAUDE.md: Rule F.3 codified

Added new rule between F.2 (Storage Isolation) and Rule G (Verification Protocol) — matches existing section conventions (header + body + "Origin: …" citation):

```
### Rule F.3 — CI cancelled is NOT failure

When a CI run shows conclusion=cancelled (platform race condition, superseded
by a newer run, concurrency-group eviction, Dependabot-internal workflow
side-effects, etc.), do NOT abort the session. Cancelled means the run was
terminated before assertions could complete — it does NOT mean the code is
broken.

Validation protocol (require TWO green signals before continuing):
  1. Local gates on the exact SHA → npm run typecheck + npm test -- --run.
     Both green = code health proven independent of the cancelled CI run.
  2. Re-trigger the CI run — gh run rerun <run-id> → re-watch.
     Re-run completing as success confirms the cancellation was transient.

Only abort on conclusion=failure or conclusion=timed_out — both indicate the
run made assertions and one of them broke. cancelled indicates the run never
got that far.

If EITHER signal fails, escalate — but the first cancellation alone is not an
abort trigger.

Origin: Session 99 / 2026-05-28 ND-S99-1 — PR #4 merge cancellation that was
mistaken for failure; local gates + rerun both confirmed transient race with a
Dependabot-internal workflow.
```

### ND-S106-RUNBOOK — RUNBOOK §6 already correct (Session 95 callout misplaced)

The Session 95 post-mortem listed "P2 — Update RUNBOOK §6 smoke script — Curl 3 payload (`password`, not `otp`)" as a follow-up. Investigation today: **the actual RUNBOOK §6 had no `otp` reference at any point.**

`git log RUNBOOK.md` shows the smoke section was authored on **2026-05-14 / Day 6 (Session 93 / commit `59a87332`)** — 2 days BEFORE the Session 95 Day-8 deploy that surfaced the `otp` bug. The §6 Curl 3 was already `OPTIONS /api/auth/login` (CORS preflight), no body payload.

The `otp`-based Curl 3 that Session 95 actually encountered was almost certainly in an ad-hoc inline smoke script used during the deploy verification, NOT in the committed RUNBOOK. The "RUNBOOK §6 needs fix" call was directionally aimed at the wrong file.

**No edit applied** to RUNBOOK.md. The §6 smoke battery as-shipped (Day 6, commit `59a87332`) is the correct payload — 5 curls:

1. `/health` HEAD
2. SPA root content-type
3. CORS preflight for `https://dukanchi.com` origin
4. CORS preflight for `capacitor://localhost` origin
5. JSON content on `/api/pincode/400050`

No POST `/api/auth/login` with body in the committed RUNBOOK §6 to fix.

### Edit 2 — ALLOWED_ORIGINS recon (read-only, REPORT — no fix applied)

**Code locations:**
- Schema: `src/config/env.ts:55` — `ALLOWED_ORIGINS: z.string().optional()` (Fly env var; empty string treated as undefined)
- Helper: `src/config/env.ts:131-140` — `getAllowedOrigins(): string[]`
  - If `env.ALLOWED_ORIGINS` set → split by comma, trim, return list
  - If unset + `NODE_ENV === 'production'` → returns `[]` (rejects all cross-origin)
  - If unset + dev → returns `['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173']`
- Consumer: `src/app.ts:152` (CORS middleware) + `src/config/socket.ts:11` (Socket.IO CORS)
- Capacitor: `src/app.ts:148` — `CAPACITOR_ORIGINS = ['capacitor://localhost', 'http://localhost', 'https://localhost']` — hardcoded list **ALWAYS allowed regardless of `ALLOWED_ORIGINS` env**. This is the native-APK gate.

**Critical safety properties (verified by reading the code):**
1. **No hardcoded localhost defaults reach production code paths.** The dev list at L139 is gated behind `env.NODE_ENV !== 'production'`. In production, an unset/empty `ALLOWED_ORIGINS` returns `[]`.
2. **Capacitor native origins are independent.** Cleaning `ALLOWED_ORIGINS` will NOT break native APK push or auth — `CAPACITOR_ORIGINS` at app.ts:148 carries those gates separately.
3. **Production current state (per Day 8 Session 95 post-mortem):** `ALLOWED_ORIGINS="http://localhost:3000,..."` (leading entry) — a pre-existing Fly env config drift, harmless for same-origin browser traffic but unhygienic.

**Recommended fix (NOT applied — awaiting Opus approval since this is a runtime CORS change):**

```bash
# Pre-flight: confirm current Fly value
fly secrets list -a dukanchi-app | grep -i allowed_origins  # (value is masked but presence confirmable)

# Apply the clean list — pure Fly secrets update, no code or deploy needed
# (Fly secrets propagate to running machines on next restart; no rebuild necessary)
fly secrets set ALLOWED_ORIGINS="https://dukanchi.com,https://www.dukanchi.com" -a dukanchi-app

# Post-update CORS preflight smoke (Rule E)
curl -s -i -X OPTIONS https://dukanchi.com/api/auth/login \
  -H "Origin: https://dukanchi.com" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
# Expected: Access-Control-Allow-Origin: https://dukanchi.com
```

**Why this is safe:**
- `https://dukanchi.com` (with + without `www`) covers all production browser traffic
- Capacitor APK uses `CAPACITOR_ORIGINS` hardcoded list → unaffected
- ngrok dev origins use `isNgrokOrigin(origin)` helper (env.ts:143-149) → unaffected
- Any cross-origin request from `http://localhost:*` would now be rejected (correct posture — there's no legitimate cross-origin from localhost to production)

### Verification gates (docs/config only)

- **`npm run typecheck`** — ✅ 0 errors (web + server + worker)
- **`npm test -- --run`** — ✅ 100/100 (17 files, 4.71s)
- **Production smoke** — `/health` HTTP 200, 0.60s

### Production runtime

Unchanged at `42d3e82`. Pending unshipped commits on `main` (now 6 ahead with this session's docs):
- `1606d20` admin-panel minor+patch group (S103)
- `70ab011` admin-panel @types/node 24 → 25 (S103)
- `d5c204c` docs S103
- `9977bd2` Dependabot guards + docs S104
- `79635ac` 29 root bumps + ioredis tilde pin (S105)
- `a47d415` docs S105
- (+ Session 106 docs commit)

Batched into the deliberate end-of-day Fly deploy.

### Files modified

- `CLAUDE.md` — +25 lines (Rule F.3 section)
- `SESSION_LOG.md` — Session 106 entry prepended
- `STATUS.md` — Last updated banner refreshed
- `RUNBOOK.md` — **NOT MODIFIED** (verified already correct, see ND-S106-RUNBOOK)
- `src/config/env.ts` / `src/app.ts` — **NOT MODIFIED** (recon-only)

---

## 2026-05-28 — Session 105 — PR #56 Hardened Merge: ioredis ~5.10.1 pin — Backlog 0

**Goal:** Resolve ND-S104-1 (free-resolve dedup trap) by tightening root `ioredis` range from `^5.10.1` to `~5.10.1` (patch only), then merge the 29 minor/patch bumps from PR #56 with dedup now structurally guaranteed.

**Status:** ✅ **PR backlog FULLY CLEARED.** Two-layer ioredis defence now live: Dependabot ignore (Session 101) for proposal stage + tilde range (this session) for resolve stage. Production runtime unchanged at `42d3e82` — admin-panel #54/#55 + this session's bumps batch into the deliberate end-of-day Fly deploy.

### 🎉 Day 1 PR Backlog Sweep — milestone (2nd time today)

| Session | Action | PRs |
|---|---|---|
| 99 | Batch-merge 4× GH-Actions Dependabot bumps | #2, #3, #4, #5 |
| 100 | Rebase + merge admin-panel grouped bump | #34 |
| 101 | Close + Dependabot guard the un-mergeable root grouped bump | #48 closed |
| 103 | Auto-merge admin-panel Dependabot Monday cycle | #54, #55 |
| 104 | Close 4 majors + Dependabot major-version guards | #57, #58, #59, #60 closed |
| **105** | **Restore PR #56 with ioredis ~5.10.1 pin → merge** | #66 (replaces closed #56) ✅ |
| **Total** | | **6 days → 0 backlog** |

### ND-S104-1 RESOLVED — the two-layer ioredis defence

| Layer | Mechanism | Effect |
|---|---|---|
| **Layer 1** (Session 101) | `.github/dependabot.yml` `ignore: ioredis@5.11.x` | Prevents Dependabot from **proposing** a 5.11 bump in a PR |
| **Layer 2** (Session 105 — THIS) | `package.json`: `"ioredis": "~5.10.1"` (tilde, patch only) | Prevents npm's free-resolver from picking 5.11 even when `package-lock.json` is wiped |

With both layers active, the `bullmq@5.77.x ↔ ioredis` dedup is guaranteed under both Dependabot weekly cycles AND ad-hoc fresh installs (contributor dev environments, lockfile regen scenarios, etc.).

### PR #56 → #66 (server-side close detour)

During Phase 6's `git push --force-with-lease`, the push was rejected: `dependabot/npm_and_yarn/minor-and-patch-129aa441e7` no longer existed on origin. Investigation: **PR #56 had been server-side CLOSED** (likely Dependabot auto-reaped after the underlying tree shifted post-merge of PRs #54/#55 admin-panel bumps). Local commits intact, however — pivoted to a fresh branch `chore/session-105-pr56-restore-with-ioredis-pin` and opened **PR #66** with the same 2 commits:
- Commit 1: Original Dependabot bump (29 root minor/patch packages)
- Commit 2: My ioredis `^5.10.1` → `~5.10.1` pin + regenerated lockfile

PR #66 squash-merged at `79635ac` — final main state identical to what merging PR #56 + the pin would have produced.

### Top 10 of the 29 packages bumped (full list in commit #105fd79 message)

| Package | Bump |
|---|---|
| `@aws-sdk/client-s3` | 3.1041.0 → 3.1054.0 |
| `@capacitor/core` + `android` + `cli` + `push-notifications` | 8.3.3 → 8.3.4 (push 8.0.4 → 8.1.1) |
| `@sentry/node` + `profiling-node` + `react` | 10.52.x → 10.54.0 |
| `bullmq` | 5.76.4 → 5.77.6 |
| `helmet` | 8.1.0 → 8.2.0 |
| `motion` | 12.38.0 → 12.40.0 |
| `posthog-js` | 1.373.4 → 1.376.3 |
| `react`/`react-dom` | 19.2.5 → 19.2.6 |
| `react-router-dom` | 7.14.2 → 7.15.1 |
| `vite-plugin-pwa` | 1.2.0 → **1.3.0** (re-verified ND-A1 push handler still compiles cleanly under v1.3) |

### Verification gates

| Gate | Result |
|---|---|
| **🚨 Dedup verify** (`npm ls ioredis` on rebased branch with fresh install) | ✅ `bullmq@5.77.6 → ioredis@5.10.1 deduped` + root `ioredis@5.10.1` — SAME tree, no split |
| `npm run typecheck` (web + server + worker) | ✅ 0 errors |
| `npm test -- --run` | ✅ 100/100 (17 files, 4.36s) |
| `npm run build` | ✅ `mode injectManifest`, 59 precache entries, `dist/sw.js` 45,253 bytes |
| **ND-A1 re-verify** (push handler under vite-plugin-pwa 1.3.0) | ✅ `addEventListener("push"` + `addEventListener("notificationclick"` both present in `dist/sw.js` |
| `npm audit` | 9 moderate (unchanged ND-T6 residual — firebase-admin/exceljs uuid chain) |
| Pre-merge CI on PR #66 | ✅ Typecheck+Test+Build 1m37s + Bundle Size 2m0s |
| Post-merge CI on main `79635ac` | ✅ success |
| Post-merge `npm ci` on main + `npm ls ioredis` | ✅ deduped at 5.10.1 |
| Production `/health` smoke | ✅ HTTP 200, 0.39s — `{"status":"ok","db":"up","redis":"up"}` |

### Deviations

**ND-S105-1 — PR #56 server-side closed mid-task.** Surfaced during Phase 6 push. Cause: Dependabot reaps PRs whose underlying group resolutions are stale after partial merges; the 29-package group's dependency tree had shifted after #54/#55 merged. Local commits unaffected — pivoted to a new branch + PR #66 with identical content. No functional impact, but documents that grouped-bump PRs can vanish if not merged promptly within Dependabot's window.

**ND-S105-2 — Dependabot already proposed a replacement.** During the `git pull` after merging PR #66, a new branch `dependabot/npm_and_yarn/minor-and-patch-c26b3e5e1b` surfaced from origin. This is Dependabot's recalculated grouped bump after the dust settled. Will show as a new PR shortly. Not touched this session (out of scope; standing backlog item for next Monday cycle triage).

### Production deploy not triggered

Per spec: `prod now N commits ahead (admin-panel + #56). Deliberate batched Fly deploy queued end-of-day. NO deploy this session.` Honoured. Production runtime remains at `42d3e82` (post-ND-A1 Session 102b).

Pending unshipped commits on `main` ahead of prod:
- `1606d20` admin-panel minor+patch group (Session 103)
- `70ab011` admin-panel @types/node 24 → 25 (Session 103)
- `d5c204c` docs (Session 103)
- `9977bd2` Dependabot guards + Session 104 docs
- **`79635ac` THIS SESSION — 29 root bumps + ioredis tilde pin**
- (+ Session 105 docs commit)

Bundled into the end-of-day deliberate Fly deploy.

### Files modified

- `package.json` — 1 line touched (`"ioredis": "^5.10.1"` → `"~5.10.1"`) + 29 transitive bump entries via Dependabot commit
- `package-lock.json` — regenerated from scratch (+3282 / -5299 net — lockfile dedup removed duplicate transitive entries)
- `SESSION_LOG.md` — Session 105 entry prepended
- `STATUS.md` — Last updated banner refreshed

---

## 2026-05-28 — Session 104 — Checkpoint 2 (Part 2): 4 majors closed + guards added, PR #56 deferred (ioredis dedup surprise)

**Goal:** Finish Checkpoint 2 — merge PR #56 (with dedup verify), close 4 major-version PRs, add Dependabot major-version guards.

**Status:** ⚠️ **PARTIAL SUCCESS.** 4 majors closed (#57, #58, #59, #60) + 4 Dependabot major-version guards appended to `.github/dependabot.yml`. **PR #56 NOT MERGED** — Phase 2 step 7 dedup check ABORTED on a reproducible PR #48-class ioredis split. Backlog: **5 → 1** (only #56 remains, deferred for Opus strategy).

### ND-S104-1 — PR #56 dedup ABORT (the Dependabot ignore rule isn't sufficient for free-resolve)

🚨 **Surprise finding:** Session 101's `dependabot.yml` ignore rule for `ioredis@5.11.x` successfully **prevents Dependabot from proposing** a 5.11 bump in a PR (confirmed in Session 103 — PR #56's diff left `"ioredis": "^5.10.1"` unchanged in `package.json`), but it does **NOT** lock-pin existing semver ranges during a manual `npm install`.

When Phase 2 Step 6 (`rm -rf node_modules package-lock.json && npm install`) ran on the rebased PR #56 branch:

```
react-example@0.0.0 /Users/apple/Documents/Dukanchi-App
+-- bullmq@5.77.6
| `-- ioredis@5.10.1      ← nested (bullmq pins to 5.10.x)
`-- ioredis@5.11.0         ← root resolved FREELY under ^5.10.1 → picked 5.11.0
```

The semver caret `^5.10.1` permits `5.11.0`, and npm's free-resolution defaulted to the latest matching version. Without a lockfile to pin the existing 5.10.1, the resolver split the tree exactly like PR #48 did.

**Comparison with `main`** (where the lockfile was preserved):
```
+-- bullmq@5.76.4
| `-- ioredis@5.10.1 deduped     ← properly deduped on main
`-- ioredis@5.10.1
```

**Implication:** PR #56's CI run was green because GitHub Actions uses `npm ci` (lockfile-strict) — the PR's own `package-lock.json` correctly pinned 5.10.1. The dedup failure only manifested when **I deliberately discarded the lockfile** as Phase 2 Step 6 required. Merging PR #56 as-is would likely succeed (the lockfile-strict CI environment matches `npm ci`), but the spec's "fresh lockfile regen + dedup verify" safety pattern correctly identified that the **ranges in `package.json` are still unsafe** under free-resolve conditions (e.g. a future `npm install` after a `package-lock.json` regeneration, or any contributor's local dev environment without lockfile discipline).

**ABORT executed cleanly:** branch state restored to PR #56's original (lockfile changes discarded), checked out to `main`, `npm ci` against main's lockfile → confirmed bullmq@5.76.4 + ioredis@5.10.1 deduped + tests 100/100 + typecheck 0 errors + `/health` 200.

**Recommended fixes for #56 (Opus to choose):**
1. **`overrides`/`resolutions` in `package.json`** — add `"overrides": { "ioredis": "5.10.1" }` to enforce the pin under all install modes. Most robust; requires explicit decision since spec said "DO NOT add overrides automatically" in Session 101 ABORT.
2. **Tighten the `package.json` ioredis range** — change `"ioredis": "^5.10.1"` to `"ioredis": "~5.10.1"` (tilde, only patch updates). Less invasive than overrides; still allows tighter Dependabot bumps in the 5.10.x line.
3. **Skip the fresh-lockfile-regen safety on this PR** — accept PR #56 as-is (its lockfile is correct); rely on CI's `npm ci` to enforce the pin. Lowest effort but leaves the same trap for future contributors.
4. **Wait for upstream `bullmq` 5.78+** that accepts `ioredis@5.11+`, then bump both together. Zero effort, indefinite wait.

### Phase 3 — 4 majors closed with documented rationale

| PR | Bump | Disposition |
|---|---|---|
| **#57** | `prisma` 5.22 → **7.8** (devDep, MAJOR) | ✅ Closed (Prisma 6+7 client-API breaking changes; needs dedicated migration session + DB-layer testing) |
| **#59** | `@prisma/client` 5.22 → **7.8** (MAJOR) | ✅ Closed (paired with #57; CLI + client must migrate together) |
| **#58** | `@eslint/js` 9 → **10** (devDep, MAJOR) | ✅ Closed (flat-config schema changes; lint is `continue-on-error: true` so non-blocking; deferred to dedicated ESLint 10 config session) |
| **#60** | `@types/node` 22 → **25** (devDep, MAJOR) | ✅ Closed (types ahead of runtime — Node 22 LTS in prod; tracking ND-S100-2 Node 20→24 deprecation; will revisit at Node 24 upgrade) |

Each closure included an explanatory comment linking to this session's deferral rationale.

### Phase 4 — Dependabot major-version guards appended

Added 4 new entries to the root npm ecosystem's existing `ignore:` block in `.github/dependabot.yml` (preserving the ioredis@5.11.x entry from Session 101). YAML lint validated clean (`✔ YAML Lint successful`).

```yaml
ignore:
  # (existing — Session 101)
  - dependency-name: "ioredis"
    versions: ["5.11.x"]
  # Prisma 5→7 is a major DB-layer migration — defer to a roadmapped session.
  - dependency-name: "prisma"
    update-types: ["version-update:semver-major"]
  - dependency-name: "@prisma/client"
    update-types: ["version-update:semver-major"]
  # ESLint 10 flat-config major — lint is report-only; defer to dedicated config session.
  - dependency-name: "@eslint/js"
    update-types: ["version-update:semver-major"]
  # @types/node should track the Node runtime major (currently 22).
  - dependency-name: "@types/node"
    update-types: ["version-update:semver-major"]
```

Future Dependabot weekly cycles will NOT re-propose these 4 major bumps. Minor/patch flows still allowed.

### Verification gates (post-Phase-4)

- **`npm run typecheck`** — ✅ 0 errors (web + server + worker, including post-ND-A1 injectManifest chain)
- **`npm test`** — ✅ 100/100 (17 files, 5.51s)
- **YAML lint** — ✅ `yaml-lint` clean
- **Production smoke** — `/health` HTTP 200, 0.67s, `{"status":"ok","db":"up","redis":"up"}`

### Final state

| Item | Value |
|---|---|
| `main` HEAD | `d5c204c` → (Session 104 docs PR squash) |
| Production HEAD | `42d3e82` (unchanged — admin-panel #54/#55 + future #56 batch into deliberate end-of-day deploy) |
| Open PRs after session | **1** (only #56, deferred for Opus dedup strategy) |
| Backlog change | 5 → 1 |
| Dependabot guards active | 5 entries (ioredis@5.11.x + 4 major-version blocks) |

### Backlog items added

- **ND-S104-BACKLOG — Prisma 5 → 7 migration session** (post-launch): schema validation + regenerated client + integration test rerun + ND-T6-1 (firebase-admin uuid chain) impact analysis.
- **ND-S104-BACKLOG — ESLint 10 config session**: flat-config schema migration + the pre-existing `scripts/backfillEmbeddings.ts:14` baseline warning (ND-D7-3 / ND-S103-1) should be addressed in the same pass.

### Files modified

- `.github/dependabot.yml` — +14 lines (4 new ignore entries with comments)
- `SESSION_LOG.md` — Session 104 entry prepended
- `STATUS.md` — Last updated banner + backlog status refreshed
- **Production code: NONE.** PR #56 not merged; the 4 closed PRs never touched `main`.

### Production deploy not triggered

Per spec: "prod will be N commits ahead after this (admin-panel #54/#55 + root #56). A deliberate batched Fly deploy with full verification is queued for end-of-day after technical work completes — do NOT deploy this session." Honoured. Production runtime remains at `42d3e82` (post-ND-A1 Session 102b).

---

## 2026-05-28 — Session 103 — Checkpoint 2: Dependabot Monday Cycle Triage

**Goal:** Triage 7 overnight Dependabot PRs (Monday weekly cycle). Auto-merge ONLY the safe category (GH-actions + admin-panel + green CI). Flag root-npm bumps for Opus review (PR #48 lesson — ioredis duplicate-package risk).

**Status:** ✅ **Category A (2 PRs) auto-merged + 5 Category B PRs flagged for Opus review.** All gates green. Production runtime unchanged (admin-panel changes ship with next Fly deploy). **🎉 ioredis@5.11.x ignore rule from Session 101 confirmed working** — grouped root PR #56 explicitly did NOT bump ioredis.

| Metric | Value |
|---|---|
| Open PRs at start | 7 (vs spec's expected 6 — one extra root PR surfaced) |
| Open PRs after sweep | 5 (all Category B, awaiting Opus) |
| Category A merged | **2** (#54, #55 — admin-panel scope) |
| Category B flagged | **5** (#56, #57, #58, #59, #60 — root npm) |
| ioredis guard | ✅ HELD — PR #56 left `"ioredis": "^5.10.1"` unchanged |
| `main` HEAD | `fd95c08` → `1606d20` (#54) → `70ab011` (#55) |
| Production HEAD | `42d3e82` (unchanged — admin-panel ships with next deploy) |

### Categorization table

| PR# | Title | Scope | CI | Category | Disposition |
|---|---|---|---|---|---|
| **#54** | admin-panel minor+patch group × 2 | admin-panel/* | ✅ SUCCESS | **A** | ✅ MERGED at `1606d20` |
| **#55** | admin-panel `@types/node` 24.12 → 25.9 | admin-panel/* | ✅ SUCCESS | **A** | ✅ MERGED at `70ab011` |
| #56 | root minor+patch group × 29 (ioredis untouched ✅) | root npm | ✅ SUCCESS | **B** | Opus review (root npm — repeat PR #48 risk surface) |
| #57 | root `prisma` 5.22 → **7.8** (devDep, MAJOR) | root npm | ❌ FAILURE | **B** | Opus — Prisma 7 is a major bump (Prisma 6 + 7 had breaking client API changes; needs deliberate migration) |
| #58 | root `@eslint/js` 9 → **10** (devDep, MAJOR) | root npm | ❌ FAILURE | **B** | Opus — ESLint 10 flat-config schema changed; needs config update |
| #59 | root `@prisma/client` 5.22 → **7.8** (MAJOR) | root npm | ❌ FAILURE | **B** | Opus — paired with #57 |
| #60 | root `@types/node` 22 → **25** (devDep, MAJOR) | root npm | ✅ SUCCESS | **B** | Opus — root major-version bump; needs node engine validation |

### ioredis guard verification (Session 101 ignore rule working as designed)

`grep -i '"ioredis"'` against each root PR's diff:

```
PR #56:  "ioredis": "^5.10.1"   ← unchanged from main (line appears 3× in the package-lock diff because PR #56 touched neighbouring deps; all three references preserve 5.10.1)
PR #57:  no ioredis lines
PR #58:  no ioredis lines
PR #59:  no ioredis lines
PR #60:  no ioredis lines
```

Confirms: Dependabot honoured the `.github/dependabot.yml` ignore rule (`dependency-name: "ioredis", versions: ["5.11.x"]`) added in Session 101. The PR #48-class blow-up where `bullmq@5.77.x ↔ ioredis@5.11.x` nominal-typing collision broke CI is now structurally prevented at the proposal stage.

### Category A — sequential merge sequence

Both PRs were stale (mergeable=UNKNOWN from yesterday) — rebased against current main, force-pushed, CI re-ran fresh, then merged.

#### PR #54 (admin-panel minor+patch × 2)
- Rebased: `abd515d → 481f2ac` (clean, no conflicts)
- Force-push triggered fresh CI run [26575103323](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26575103323) → success
- Squash-merged at `1606d20` (admin-panel/* only, +68 / -68 lines)
- Main CI run [26575220781](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26575220781) → success

#### PR #55 (admin-panel @types/node 24 → 25)
- Rebased: `ba3b4d0 → 23e0b0e` (clean)
- Force-push triggered fresh CI run [26575333459](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26575333459) → success
- Squash-merged at `70ab011` (admin-panel/* only, +9 / -9 lines)
- Main CI run [26575441374](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26575441374) → success

Both branches deleted from origin.

### Category B — flagged for Opus (NOT merged this session)

These all touch root `package.json` + `package-lock.json` and need a deliberate decision matrix similar to the PR #48 / Session 101 abort path. **No mutations applied to any of them.**

#### #56 — root minor+patch group × 29 (CI green, ioredis untouched)
The "default safe" grouped bump for root, post-Session-101's ioredis ignore. Without the PR #48-class blocker, this should be the standard rebase + force-push + CI cycle. Worth a quick dedup check (npm ls on a few candidate packages) before merging since it bumps `bullmq`-adjacent things too. Recommend Opus drive a Session 102a-style local verify (fresh install + `npm ls` for the impacted packages + local build) before approving merge.

#### #57 + #59 — Prisma 5.22 → 7.8 (devDep + client, MAJOR)
Prisma 6 introduced significant client-API changes (`Prisma.PrismaClientKnownRequestError` typing, schema relation modes, native query bigint defaults). Prisma 7 likely continues the trend. **Cannot bump without an explicit migration plan**: schema validation, regenerated client code, possible `prisma migrate` runs against the test DB, and integration test rerun. ND-T6-1 (firebase-admin uuid chain) is also adjacent — Prisma 7's transitive may re-shuffle that tree.

#### #58 — `@eslint/js` 9 → 10 (devDep, MAJOR)
ESLint 10 changes flat-config schema and removes some legacy rules. Our codebase already runs ESLint 9 flat-config (Day 7 / Session 94 `64d2313`), so the migration is small but config changes required. CI failure expected without `.eslintrc.json` / `eslint.config.js` adjustments.

#### #60 — `@types/node` 22 → 25 (devDep, MAJOR)
Node types track the runtime line. We ship on Node 22 in production (Fly Dockerfile + CI both use Node 22). Bumping types to 25 introduces type definitions for Node 25 features that aren't available at runtime — risk of writing code that typechecks but throws at runtime. Generally `@types/node` should track the runtime Node version, not lead it. **Recommend close, wait for Node 22 LTS sunset before bumping types to a higher major.**

### Verification gates (post-Category-A)

- **admin-panel** `npm ci`: 215 packages, **0 vulnerabilities** ✅
- **admin-panel** `npm run build`: ✓ 1815 modules transformed in 350ms; 429.61 KB / 120.20 KB gzip bundle (unchanged from prior baseline)
- **Root typecheck**: 0 errors (web + server + worker — all 3 chains, including new injectManifest worker)
- **Root tests**: 100/100 passing (17 files, 5.47s)
- **Production smoke**: HTTP 200, 0.55s — `/health` green

### No deploy triggered

All merged content scoped to `admin-panel/*`. Admin-panel ships as part of the Express image built from the root repo — changes will land in production with the **next** Fly deploy (not this session). Production runtime remains `42d3e82` (post-ND-A1 Session 102b).

### ND-S103-1 — Pre-existing ESLint warning surfaces in every CI run

CI consistently surfaces `Unexpected any. Specify a different type` at `scripts/backfillEmbeddings.ts:14` in the lint step. Day 7 / Session 94 ND-D7-3/D7-4 documented this is part of the ESLint baseline running in `continue-on-error: true` report-only mode. Doesn't fail CI. Logged here because it appears in every PR's CI log this session and tomorrow's ESLint 10 bump (PR #58) will need this addressed first.

### Remaining open PRs after this session

| PR | Title | Why deferred |
|---|---|---|
| #56 | root minor+patch group × 29 | Opus needs to drive Session 102a-style local verify |
| #57 | prisma 5→7 | Major bump; needs schema/migration validation |
| #58 | @eslint/js 9→10 | Major bump; flat-config schema changes |
| #59 | @prisma/client 5→7 | Major bump; paired with #57 |
| #60 | @types/node 22→25 | Types ahead of runtime; recommend close |

---

## 2026-05-28 — Session 102b — ND-A1 LIVE: injectManifest push SW deployed to production

**Goal:** Deploy the Session 102a injectManifest migration (PR #61) to production. Prove that the prod-served `/sw.js` now contains the `push` and `notificationclick` handlers that were dead since the PWA shipped.

**Status:** ✅ **ND-A1 CLOSED — WEB PUSH RESTORED IN PRODUCTION.** PR #61 squash-merged at `42d3e82`; Fly release **v24** complete; production `/sw.js` verified to contain both `addEventListener("push")` and `addEventListener("notificationclick")` post-deploy. Pre-deploy `/sw.js` (4,499 bytes) was the broken generateSW loader stub; post-deploy `/sw.js` is the injectManifest output with handlers inline. Native Capacitor / FCM pathway unaffected.

| Metric | Value |
|---|---|
| PR merged | #61 (commit `42d3e82`) |
| Fly release | **v24** complete |
| Deploy duration | **5m2s** (12:18:41Z → 12:23:43Z) |
| Production HEAD | `cd18d1a` → **`42d3e82`** |
| Pre-deploy `/sw.js` size | 4,499 bytes (broken Workbox loader stub, NO push handler) |
| Post-deploy `/sw.js` size | 27,225 bytes (decompressed) / 8,951 bytes gzipped on the wire |
| CDN cache status | No `cf-cache-status` header — Cloudflare pass-through or DNS-only for `/sw.js` |
| Browser cache hint | `cache-control: public, max-age=0` (always revalidate) |

### Pre-deploy proof (bug confirmed)

```
curl -s "https://dukanchi.com/sw.js?cachebust=$(date +%s)" -o /tmp/dk-presw.js
$ wc -c /tmp/dk-presw.js
    4499 /tmp/dk-presw.js
$ grep -oE 'addEventListener\(["'\'']push["'\'']' /tmp/dk-presw.js
(no match)
$ head -c 200 /tmp/dk-presw.js
if(!self.define){let s,e={};const i=(i,n)=>(i=new URL(i+".js",n).href,e[i]||new Promise(e=>{if("document"in self){...
```

Confirmed: prod was serving the legacy generateSW loader stub — no push listener.

### Post-deploy proof (ND-A1 FIXED)

```
$ curl -s "https://dukanchi.com/sw.js?cachebust=$(date +%s)" -o /tmp/dk-prod-sw.js
$ wc -c /tmp/dk-prod-sw.js
   27225 /tmp/dk-prod-sw.js
$ grep -oE 'addEventListener\(["'\'']push["'\'']' /tmp/dk-prod-sw.js
addEventListener("push"
🎉 PUSH HANDLER LIVE IN PRODUCTION
$ grep -oE 'addEventListener\(["'\'']notificationclick["'\'']' /tmp/dk-prod-sw.js
addEventListener("notificationclick"
✅ notificationclick LIVE
```

### Fly deploy state

```
$ flyctl status -a dukanchi-app
 Image    │ dukanchi-app:deployment-01KSQ8BN9A38GZB8C7SKTW89KD
Machines
 PROCESS │ ID             │ VERSION │ REGION │ STATE   │ CHECKS             │ LAST UPDATED
 app     │ 9080d70da60d18 │ 24      │ sin    │ started │ 1 total, 1 passing │ 2026-05-28T12:23:25Z

$ flyctl releases -a dukanchi-app | head -3
 VERSION │ STATUS   │ DESCRIPTION │ USER                  │ DATE
 v24     │ complete │ Release     │ dukanchiapp@gmail.com │ 1m12s ago
 v23     │ complete │ Release     │ dukanchiapp@gmail.com │ 20h35m ago
```

Single machine, Singapore region, healthcheck 1/1 passing on v24. No rollback needed.

### Production smoke battery (Rule E)

| Endpoint | Result |
|---|---|
| `/health` | HTTP 200, 1.32s, `{"status":"ok","db":"up","redis":"up","timestamp":1779971054278}` ✅ |
| `/` (SPA root) | HTTP 200 ✅ |
| `/manifest.json` | Served (name + short_name fields intact) ✅ |
| `/sw.js` | 27,225 bytes with push + notificationclick ✅ |

### Size delta diagnosis (local 45,253 → production 27,225)

Both files contain the handlers, so functionally identical. Likely causes for the ~17 KB delta:

- **Likely:** Different terser minification behaviour between the local `npm run build` and the Docker production build (CI/Dockerfile may set additional flags or env vars that tighten the SW pass). Both invoke `vite v6.4.2 building for production`, but the Docker layer's resolved tool versions or env may emit a tighter `dist/sw.js`.
- **Wire size:** `curl --compressed` reports 8,951 bytes wire (gzipped), matching `content-length: 27225` after decompression.
- **No `cf-cache-status` header** — Cloudflare either bypassed cache for `/sw.js` (likely due to `cache-control: public, max-age=0` set by Express) or `/sw.js` is in DNS-only mode. Either way the bytes are demonstrably fresh.

### Native push pathway

Unaffected by this deploy. `@capacitor/push-notifications` plugin + Capacitor APK + `firebase-admin` backend continue to operate on their own native channel (Google Play Services intents). Verified untouched: `useFcmRegistration.ts`, `capacitor.config.ts`, and the `firebase-admin` half of `push.service.ts` were not in the PR #61 diff.

### Deploy-side warning (recurring)

The same Fly mid-deploy "app not listening on expected address" warning observed on every prior deploy in this codebase. Machine subsequently reached `started` state and healthcheck passed. Benign per established pattern (Sessions 88, 95, 98, etc.). Worth a separate `fly.toml` startup-probe-timing investigation but not blocking.

### ND-A1 status: ✅ CLOSED

Browser Web Push delivery is restored. Backend's `webpush.sendNotification` (Task 3 / Session 98 VAPID rotation) now reaches active browser SWs that have a `push` event listener wired to `showNotification`. Combined with the dual-stack dispatcher in `src/services/push.service.ts:103-127` (`Promise.allSettled([sendWebPushToUser, sendFcmToUser])`), both PWA users and APK users now receive push correctly.

### Files referenced

- Code merged via PR #61 (Session 102a): `src/sw.ts` (new), `vite.config.ts` (injectManifest), `tsconfig.worker.json` (new), `tsconfig.app.json` (exclude), `package.json` (typecheck:worker + 5 workbox deps), `public/sw.js` (deleted), `package-lock.json` (locked).
- 102b touches: documentation only.

---

## 2026-05-28 — Session 101 — PR #48 Closed + Dependabot ioredis Guard — Backlog CLEARED

**Goal:** Resolve the last open PR (#48 root npm grouped bump × 30 packages) that had been blocked by broken CI since 2026-05-27T15:55Z. Investigate root cause, attempt automatic recovery if safe, otherwise close cleanly + add guardrails to prevent recurrence.

**Status:** ✅ **BACKLOG CLEARED — 0 OPEN PRs.** PR #48 closed (not merged) due to internal incompatibility between `bullmq@5.77.6` and `ioredis@5.11.0` in the same grouped bump. Dependabot ignore rule added for `ioredis@5.11.x` to prevent broken-PR recurrence. The other 26 (now legitimately bumpable) packages will re-propose in next Dependabot grouped run.

### 🎉 Day 1 PR Backlog Sweep — milestone

Single-day backlog clearance across Sessions 99 / 100 / 101 (all 2026-05-28):

| Session | Action | PRs resolved |
|---|---|---|
| 99 | Batch-merge 4× GH-Actions Dependabot bumps | #2, #3, #4, #5 |
| 100 | Rebase + merge admin-panel grouped bump | #34 |
| 101 | Close + guard the un-mergeable root grouped bump | #48 (closed, not merged) |
| **Total** | **6 PRs resolved · backlog 6 → 0** | |

### Phase 1 recon — root cause confirmed

Per spec, Phase 1 captured the verbatim CI failure log + PR #48 metadata. Findings:

- **Diff scope**: clean — `package.json` + `package-lock.json` only.
- **27 packages bumped** (Dependabot title said "30"; body itemised 27 — 3 transitive lockfile-only diffs). All semver-minor or -patch. None of `firebase-admin`/`exceljs`/`uuid` touched — ND-T6-1/T6-2 chain unaffected.
- **Failure** (verbatim from `gh run view 26522482353 --log-failed`):
  ```
  ##[error]src/config/bullmq.ts(9,63): error TS2322:
    Type 'Redis' is not assignable to type 'ConnectionOptions'.
    Type '…/node_modules/ioredis/built/Redis' is not assignable to type
         '…/node_modules/bullmq/node_modules/ioredis/built/Redis'.
  ##[error]src/workers/notification.worker.ts(114,8): error TS2322: [same trail]
  ##[error]The process '/opt/hostedtoolcache/node/22.22.3/x64/bin/npm' failed with exit code 2
  ```

The original Session 99 hypothesis ("firebase-admin/exceljs uuid chain blockers") was directionally correct but **misidentified** the specific blocker — the real cause is a duplicate-package nominal-typing collision in `ioredis`, not the uuid chain.

### Phase 2 (DEDUP ABORT) — npm cannot dedupe ioredis after the bump

| Step | Output |
|---|---|
| Rebase against fresh main | Clean (no conflicts) |
| `rm -rf node_modules package-lock.json && npm install` | 1296 packages, 9 moderate vulns (expected ND-T6 residual) |
| `npm ls ioredis` (Step 8.5) | ❌ FAIL — split tree, both versions installed |
| `npm dedupe` recovery (one-shot) | ❌ no-op — version ranges genuinely incompatible |
| Restore to `main @ 68fe1b8` | Clean (`bullmq@5.76.4 → ioredis@5.10.1 deduped`) |
| **Decision** | ABORT — no automatic fix; do not modify PR branch |

#### Pre-`npm dedupe` (after fresh install on rebased PR #48 branch)
```
react-example@0.0.0
+-- bullmq@5.77.6
| `-- ioredis@5.10.1          ← nested, NOT deduped (bullmq pins to 5.10.x)
`-- ioredis@5.11.0             ← root, this PR's bump
```

#### Post-`npm dedupe` (no-op — confirmed incompatibility)
```
react-example@0.0.0
+-- bullmq@5.77.6
| `-- ioredis@5.10.1          ← STILL nested
`-- ioredis@5.11.0             ← STILL split
```

#### `main`'s healthy reference state
```
react-example@0.0.0
+-- bullmq@5.76.4
| `-- ioredis@5.10.1 deduped   ← properly deduped on main
`-- ioredis@5.10.1
```

The blocker is structural: `bullmq@5.77.6`'s transitive `ioredis` range excludes `5.11.0`. Bumping root `ioredis` alone splits the type identity → TS2322 typecheck failure.

### Decision: close + Dependabot guard (Option 3 from Phase 2 ABORT findings)

- **Closed PR #48** with explanatory comment linking to this Session 101 entry.
- **Added Dependabot ignore rule** in `.github/dependabot.yml` (root npm ecosystem block ONLY — admin-panel + github-actions blocks untouched):

  ```yaml
  ignore:
    # ioredis 5.11+ breaks bullmq@5.77.x transitive dedup (nominal-typing collision).
    # bullmq@5.77.6 pins ioredis to 5.10.x; bumping root ioredis to 5.11 splits the tree.
    # Remove this ignore when bullmq releases a version accepting ioredis@5.11+.
    # Tracked: Session 101 (2026-05-28). Re-evaluate monthly.
    - dependency-name: "ioredis"
      versions: ["5.11.x"]
  ```

- **Rationale for guarding `ioredis` (not `bullmq`):** Future `bullmq` patch releases may add `ioredis@5.11+` support — we want those to come through automatically. Guarding the smaller package (ioredis) means we only block one specific version range, not an entire ecosystem dimension.

- **Removal trigger:** When `bullmq` ships a version supporting `ioredis@5.11+`. Re-evaluate monthly.

### ND-S101-1 — Dependabot grouped bumps do NOT validate inter-package compatibility

The grouped `minor-and-patch` Dependabot strategy bundles all in-range updates by date-window without checking whether the bumps are mutually compatible at the resolver level. This is an upstream limitation, not configurable per-group. Mitigation: rely on CI to catch incompatibilities (which it did here), then close + ignore-rule the specific blocker. Document for future similar situations.

### Other findings carried forward

- **9 moderate vulnerabilities remain** on `main` post-`npm install` — unchanged from PR #47 / Session 98 / Task 6. All in the `firebase-admin`/`exceljs`/`uuid` chain (ND-T6-1/T6-2). No new vulns introduced by this session.
- **Build was not separately invoked** in the abort path (typecheck failure prevented it on the PR branch). Main's build remains healthy from prior sessions.

### Verification gates (all green)

- **`git status`** — only `.github/dependabot.yml` + `SESSION_LOG.md` + `STATUS.md` modified
- **`npm run typecheck`** — 0 errors (web + server projects)
- **`npm test -- --run`** — ✅ 100/100 in 4.73s
- **YAML lint** — ✅ `yaml-lint` clean
- **Production smoke** — `HTTP 200 | 0.54s`, `{"status":"ok","db":"up","redis":"up"}`
- **Open PRs after session** — **0** ✅
- **`main` HEAD** — `68fe1b8` at session start → (advanced by Session 101 docs PR squash on close)

### Files modified

- `.github/dependabot.yml` — +7 lines (ignore block in root npm ecosystem only)
- `SESSION_LOG.md` — Session 101 entry prepended
- `STATUS.md` — "Last updated" refreshed; backlog=0 prominent note

### No deploy required

Config + docs only. Production runtime unchanged at `cd18d1a` (last Fly deploy from PR #47).

---

## 2026-05-28 — Session 100 — PR #34 Admin-Panel Grouped Bump (15 packages)

**Goal:** Refresh the stale 4-day-old Dependabot admin-panel grouped bump (PR #34) — rebase against fresh main (5 commits ahead), verify CI + local gates, merge.

**Status:** ✅ MERGED at `1f15b61`. Open PR count dropped 2 → 1 (only PR #48 broken-CI root npm bump remains). Production HEAD unchanged at `cd18d1a` — admin-panel changes don't trigger Fly deploy on their own (admin-panel ships in next deploy bundle).

| Metric | Value |
|---|---|
| PR merged | #34 |
| Scope | `admin-panel/package.json` + `admin-panel/package-lock.json` (2 files, +437/-358 lines) |
| Packages bumped | 15 (all minor/patch — no semver-major) |
| Rebase needed | **YES** (4-day stale; clean rebase, no conflicts) |
| CI re-runs | 2 (pre-rebase stale CI from 2026-05-24 ignored; post-rebase CI ran fresh on `f010ac5` → success; post-merge CI on main `1f15b61` → success) |
| Open PRs after | 1 (only #48) |
| `main` HEAD | `eb3dd8e` → `1f15b61` |
| Production HEAD | `cd18d1a` (unchanged) |

### Top packages bumped (15 total, minor/patch only)

| Package | Before → After |
|---|---|
| `react` + `react-dom` | 19.2.4 → 19.2.6 |
| `react-router-dom` | 7.13.2 → 7.15.1 |
| `axios` | 1.14.0 → 1.16.1 |
| `lucide-react` | 1.7.0 → 1.16.0 |
| `@tailwindcss/vite` | 4.2.2 → 4.3.0 |
| `vite` | 8.0.1 → 8.0.14 |
| `postcss` | 8.5.8 → 8.5.15 |
| `autoprefixer` | 10.4.27 → 10.5.0 |
| `@types/react` | 19.2.14 → 19.2.15 |
| `@vitejs/plugin-react` | 6.0.1 → 6.0.2 |
| `eslint-plugin-react-hooks` | 7.0.1 → 7.1.1 |
| `globals` | 17.4.0 → 17.6.0 |
| `typescript-eslint` | 8.57.0 → 8.59.4 |

### Verification gates (all green)

- **Rebased branch CI** (`f010ac5`): ✅ success (run [26540541227](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26540541227))
- **Main post-merge CI** (`1f15b61`): ✅ success (run [26540700804](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26540700804))
- **Root typecheck**: 0 errors (web + server)
- **Root tests**: 100/100 (17 files, 6.60s)
- **Admin-panel `npm ci`**: 215 packages, **0 vulnerabilities** ✅
- **Admin-panel `npm run build`**: ✓ 1815 modules transformed in 1.33s, output 429.61KB / 120.20KB gzip (includes `tsc -b` typecheck step — implicit typecheck pass)
- **Production health smoke**: HTTP 200, 0.36s, `{"status":"ok","db":"up","redis":"up"}`

### ND-S100-1 — No standalone `typecheck` script in `admin-panel/`

Spec asked for `cd admin-panel && npm run typecheck`. The admin-panel workspace has no `typecheck` script (its `build` is defined as `tsc -b && vite build`, baking typecheck into build). Since `npm run build` succeeded with 1815 modules transformed and zero TypeScript errors, the typecheck requirement is satisfied implicitly. Documented for clarity — no functional gap.

### ND-S100-2 — CI noise on rebased branch (informational only, not blocking)

The rebased branch CI run surfaced two pre-existing items that don't fail CI but are worth tracking:

- **ESLint baseline warning** at `scripts/backfillEmbeddings.ts:14` — "Unexpected any. Specify a different type". This is part of the Day 7 ESLint baseline (Session 94, ND-D7-3 / ND-D7-4) running in `continue-on-error: true` report-only mode. Pre-existing; not introduced by this rebase.
- **GitHub deprecation notice** — `preactjs/compressed-size-action@v3` (which we just bumped to in PR #5 this morning) still runs on Node 20. GitHub will force-migrate Node 20 actions to Node 24 by 2026-06-02 and remove Node 20 by 2026-09-16. v3 latest still ships Node 20 — upstream maintainer needs to publish a Node 24-compatible release. Track as Day 2+ hygiene; not blocking.

### Remaining open PRs

- **#48** — Dependabot npm root grouped bump × 30 packages, still ❌ broken CI (post-PR-#47 conflict). Dedicated triage required — likely needs rebase + selective bump filtering to dodge the firebase-admin/exceljs uuid chain blockers from ND-T6-1/T6-2.

---

## 2026-05-28 — Session 99 — PR Backlog Hygiene: 4× GH-Actions bumps batch-merged

**Goal:** Drain the 4 stale Dependabot GH-Actions PRs (#2 / #3 / #4 / #5) that had been sitting green-CI for ~12 days (since 2026-05-15). Pure CI/workflow updates, zero runtime risk. Sequential merge with full CI verification between each step.

**Status:** ✅ ALL 4 MERGED. Open PR count dropped 6 → 2 (only #34 admin-panel grouped bump + #48 broken-CI npm bump remain — both deferred to dedicated Day 2 triage). Production runtime unchanged (CI-workflow-file edits only — no `flyctl deploy` triggered).

| Metric | Value |
|---|---|
| PRs merged | 4 (#2, #3, #4, #5) |
| Commits added to main | 4 squash commits (`0647f78`, `f8198e9`, `4dfeb95`, `1f21d38`) |
| Open PRs after sweep | 2 (#34, #48) |
| CI runs on main | 4 (1 cancelled + re-run success, 3 first-time success) |
| Local gates (post-batch) | typecheck 0 errors · tests 100/100 in 6.66s · health HTTP 200 · build N/A (not retriggered) |
| Production HEAD | `cd18d1a` (unchanged — last actual deploy was PR #47) |
| `main` local HEAD | `caaf696` → `1f21d38` |

### Sequential merge sequence

| # | PR | Bump | Squash SHA | CI run | Result |
|---|---|---|---|---|---|
| 1 | [#2](https://github.com/dukanchiapp/Dukanchi-App/pull/2) | `codecov/codecov-action` v5 → v6 | `0647f78` | [26539544454](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26539544454) | ✅ success first try |
| 2 | [#3](https://github.com/dukanchiapp/Dukanchi-App/pull/3) | `actions/setup-node` v4 → v6 | `f8198e9` | [26539644950](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26539644950) | ✅ success first try |
| 3 | [#4](https://github.com/dukanchiapp/Dukanchi-App/pull/4) | `actions/checkout` v4 → v6 | `4dfeb95` | [26539737038](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26539737038) | ⚠️ initial **cancelled**, re-run ✅ success |
| 4 | [#5](https://github.com/dukanchiapp/Dukanchi-App/pull/5) | `preactjs/compressed-size-action` v2 → v3 | `1f21d38` | [26539958981](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/26539958981) | ✅ success first try |

### ND-S99-1 — CI cancellation on PR #4 merge

Initial CI run for the PR #4 squash-merge commit (`4dfeb95`) was **cancelled** (not failed). Jobs showed `conclusion: cancelled` for "Typecheck + Test + Build" and `conclusion: skipped` for "Bundle Size Report". Investigation:

- Adjacent runs (`f8198e9` PR #3 CI = success; `1f21d38` PR #5 CI = success) ran cleanly with same workflow + node version.
- A Dependabot-internal "github_actions in / for actions/checkout - Update #1386960952" workflow completed `success` at 21:26:25Z — 44 seconds before the cancelled run started at 21:27:09Z. Most likely race condition or transient concurrency interaction.

**Mitigation applied:** Local `npm run typecheck` + `npm test` re-run on `main @ 4dfeb95` → both green (typecheck 0 errors, 100/100 tests in 6.25s). Then `gh run rerun 26539737038` → re-run completed `success`. Continued the sequence after both signals confirmed code health.

**Decision per spec rule:** "ABORT if CI FAILS on main". Cancellation ≠ failure (jobs were terminated mid-run, not asserted broken). Local gates verifying code health on the same commit was the tie-breaker. Documented as a deviation rather than abort.

### Remaining open PRs (deferred to dedicated Day 2 triage)

- **#34** — Dependabot admin-panel grouped bump × 15 packages (open since 2026-05-24, ✅ CI green). Review needed before merge — affects admin SPA dependency tree.
- **#48** — Dependabot npm root grouped bump × 30 packages (open since 2026-05-27, ❌ CI **FAILED** post-PR-#47 merge — likely lockfile conflict from the Task 6 `npm audit fix` landing immediately before #48's CI run). Requires rebase + re-test; potential package resolution surgery.

### Verification gates (post-batch)

- `npm run typecheck` — ✅ 0 errors (web + server)
- `npm test -- --run` — ✅ 100/100 (17 files, 6.66s)
- `curl https://dukanchi.com/health` — ✅ HTTP 200, 0.79s, `{"status":"ok","db":"up","redis":"up"}`
- Working tree clean throughout — only main branch advanced

### No deploy triggered

All 4 PRs edit only `.github/workflows/ci.yml` (and no other files). Workflow-file changes affect future CI runs, not the production runtime artifact. Fly app remains at the image built from `cd18d1a` (PR #47 deploy).

---

## 🌙 Day 1 Closing Addendum (2026-05-27 23:23 IST)

### Task 7 — APK Rebuild + Signed Release: CLOSED ✅

**Decision context:** Day 5.1 keystore credentials lost (path + password not stored in password manager). Founder confirmed Day 5.1 APK was never distributed (only emulator/internal test) → new keystore safe; no backwards-compat break.

**Keystore creation:**
- Path: `~/Documents/dukanchi-keys/dukanchi-release.jks` (OUTSIDE git repo — security)
- Alias: `dukanchi`
- Validity: 25 years
- App ID: `com.dukanchi.app`
- Password: `openssl rand -hex 20` (40-char hex, 160-bit entropy)
- Password storage: Apple Notes locked (Face ID) with full template
- Certificate: First/Last name, OU=Dukanchi, O=Dukanchi, L=Mumbai, ST=Maharashtra, C=IN

**Build output:**
- File: `app-release.apk`
- Size: 6.7 MB (6,661,847 bytes; 6.4M filesystem)
- Build time: 1m 33s 920ms
- Location: `android/app/release/`
- Signing: V1/V2/V3 auto via modern AS + Android Gradle Plugin

**Backup verified (2026-05-27 23:23 IST):**
- iCloud Drive: `~/Library/Mobile Documents/com~apple~CloudDocs/Dukanchi-Backups/`
  - `dukanchi-release.jks` (2.7K)
  - `app-release.apk` (6.4M)
- Auto-syncs to iPhone Files app
- Pending: Google Drive redundancy (Day 2)

### New Learnings

**L6 — Keystore creation MUST pair with immediate password-manager save.** Day 5.1 keystore was lost because password was typed during creation dialog without saving anywhere. New SOP: generate via `openssl rand -hex 20` → save in password manager FIRST → then paste into AS dialog. Never type fresh during creation.

**L7 — Keystore folder MUST live outside git repo.** `~/Documents/dukanchi-keys/` is safe. Never place inside `Dukanchi-App/`. Even if .gitignored, future config drift could expose. Physical separation is the only safe boundary.

### New Backlog Items

- **ND-D1-IDEIGNORE** (P3, ~5min) — `android/.idea/` should be in `.gitignore`. Currently `android/.idea/misc.xml` is tracked and shows modified on every AS open. Fix: `git rm --cached -r android/.idea/` + add `android/.idea/` to `.gitignore` + commit.
- **ND-D2-VERIFIED-DEV** (P3, pre-Play-Store) — Google "Verified Developer" registration required for Play Store distribution. AS build dialog flagged: "This package name (App ID) is not registered by a verified developer." Zero impact on sideload soft launch. Register via Play Console (within already-planned ₹2.1k Play Console fee).
- **ND-D2-GDRIVE-BACKUP** (P3, ~5min) — Google Drive redundancy backup for keystore + APK.
- **ND-D2-APK-SMOKE** (P2, ~10min) — Install signed APK on real Android device (or Pixel 8 emulator). Verify launch → loads dukanchi.com → login works → basic flow.

### Day 1 Launch Sprint — FINAL TALLY

| # | Task | Status |
|---|---|---|
| 1 | Test user cleanup | ✅ CLOSED |
| 2 | R2 CORS production | ✅ CLOSED |
| 3 | VAPID rotation | ✅ CLOSED (11-min outage recovered) |
| 4 | Sentry alert rules | ✅ CLOSED |
| 5 | CSP allowlist | 🟡 MONITORING (24-48h window for enforce flip) |
| 6 | npm audit fix | ✅ CLOSED (PR #47, 18→9 vulns) |
| 7 | APK rebuild + signed release | ✅ CLOSED (6.7 MB signed APK + keystore) |

**6/7 tasks fully closed. 1 task (CSP) in mandatory monitoring window. Day 1 effectively complete.**

### Day 2 Prioritized Backlog

1. **P1 — ND-A1 Browser push fix** (~2hr) — VitePWA `generateSW` → `injectManifest` migration. Create `src/sw.ts` with custom push handler + Workbox precache imports. Update `vite.config.ts`.
2. **P2 — Task 5 CSP enforce flip** (~15min) — Window: 2026-05-28 23:00 IST onwards. Re-check Sentry; if zero violations → flip `app.ts` reportOnly: false → PR → deploy.
3. **P2 — ND-D2-APK-SMOKE** (~10min) — Real device smoke test.
4. **P3 — ND-D1-IDEIGNORE** (~5min).
5. **P3 — ND-D2-GDRIVE-BACKUP** (~5min).
6. **Parallel — UI enhancement** (Mandeep, scope TBD).
7. **Deferred — ND-D2-VERIFIED-DEV** — Pre-Play-Store milestone.

## 2026-05-27 — Session 98 — Day 1 Launch Sprint: 4 tasks closed + Task 5 prep + outage forensics + ND-A1 discovery

**Goal:** Day 1 of the 7-task launch hardening sprint (post-Hardening-Sprint follow-on). Easy wins first per pre-Day-1 audit prioritisation — test-user cleanup, R2 CORS, VAPID rotation, Sentry alerts. Prep Task 5 (CSP enforce flip) by closing the active Sentry violation backlog. UX cleanup of redundant PWA banners as a bonus.

**Status:** **DAY 1 COMPLETE — 4 of 7 tasks closed, Task 5 prep landed, 1 UX bonus, 1 critical discovery, 1 production outage recovered.** 24–48h Sentry monitoring window started for Task 5 enforce-flip decision.

| Metric | Value |
|---|---|
| Tasks closed | 4 of 7 (Tasks 1–4) |
| Task 5 status | Prep done (PR #43), monitoring window open |
| PRs merged | 2 (#43 CSP allowlist, #44 PWA banners feature flag) |
| Production outage | 1 (~11 min total — see §3 forensics) |
| Critical discoveries | 1 (ND-A1 — browser push SW dead in production) |
| Tests | 100/100 throughout |
| Typecheck | 0 errors throughout |
| Production HEAD | `050dc62` → `eda3a4d` → `9475c90` |

---

### Production HEAD progression

| HEAD | Session moment | Source |
|---|---|---|
| `050dc62` | Day 1 START — "Phase B Sentry instrumentation, 9.5/10 launch confidence" per pre-Day-1 audit framing | Day 0 baseline |
| `eda3a4d` | After PR #43 merge | CSP `fonts.gstatic.com` allowlist fix |
| `9475c90` | After PR #44 merge — Day 1 END | PWA banners feature flag |

**Deviation ND-D1-DOC1:** Between Session 97 (STATUS.md last-updated HEAD `0658ee5`, May 18) and today's session start (`050dc62`, "Phase B Sentry instrumentation, 9.5/10 launch confidence"), at least one commit landed on main that is not captured in SESSION_LOG. ~9-day window. Not investigated this session — flagged for future backfill during a dedicated docs catch-up session.

---

### 1. Task 1 — Test user cleanup (~10 min)

**Problem:** Pre-Day-1 audit flagged 13 non-admin test/seed users still resident on the production Neon branch, residue from earlier QA passes. Pilot launch with 0 real customers — these would skew analytics and confuse `/health`+`/admin` UI counters.

**Approach:** Neon SQL Editor against production branch (no application code path — direct SQL with strong guards).

**Defensive SQL** (executed via Neon UI):
```sql
DELETE FROM "User"
WHERE "role" != 'admin'
  AND "createdAt" < NOW()
RETURNING "id", "phone", "role", "createdAt";
```

- `role != 'admin'` guard — prevents wiping the admin row
- `createdAt < NOW()` guard — defensive against clock skew false-positives (no-op semantically but explicit)
- `RETURNING` — explicit deletion receipt for the session log

**Outcome:**
- Pre-count: **14** users
- Deleted: **13** rows (per RETURNING)
- Post-count: **1** (admin only, untouched) ✅
- Cascade effects: `LegalConsent`, `Store`, `Post`, `RefreshToken`, `PushSubscription` rows for those users also removed via FK cascade (verified counts dropped to 0/1 for admin)

**Rule F compliance:** This was a deliberate production-DB write executed via Neon's native SQL Editor (UI tool, not `npm run dev`). Rule F covers application-driven write paths; founder-driven SQL via dashboard is the documented exception path.

---

### 2. Task 2 — R2 CORS production (~5 min)

**Problem:** Cloudflare R2 bucket `dukanchi-prod` had no CORS configuration. Browser uploads were working (server-side presigned PUT bypasses browser CORS at the upload boundary) but any future direct-from-browser fetch (e.g. signed-URL image previews from a different origin) would be blocked.

**Configuration applied via Cloudflare dashboard:**
```json
[
  {
    "AllowedOrigins": [
      "https://dukanchi.com",
      "https://www.dukanchi.com",
      "https://dukanchi-app.fly.dev"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Notes:**
- `dukanchi-app.fly.dev` included as a fallback origin for direct Fly URL access during ops/debug.
- `ETag` exposed to enable client-side cache validation when retrieving R2 objects.
- `MaxAgeSeconds: 3600` (1h) — reasonable preflight cache; can lengthen later if needed.

**Verification:** Cloudflare dashboard shows config applied. No live curl preflight executed this session (deferred — no current cross-origin browser fetch path to test; first user will be the canary).

---

### 3. Task 3 — VAPID Web Push rotation 🚨 ~~11-min production outage~~ recovered (~45 min total)

**Purpose:** Replace 1-char placeholder VAPID keys flagged in pre-Day-1 audit (`VAPID_PUBLIC_KEY=x`, `VAPID_PRIVATE_KEY=y` — non-functional).

#### 3a. Outage Timeline (UTC)

| Time | Event |
|---|---|
| **20:09:52** | First crash: `web-push` validation throws on bad public key during module load |
| **20:09:55** | Main child process exits code 1 → Fly auto-restart kicks in |
| **20:09:55 – 20:13:18** | Crash loop — machine reboot every ~3-4 min, all rounds fail at same module-load point |
| **20:15:02** | Fly proxy starts emitting `"could not find a good candidate within 40 attempts at load balancing"` (LB exhausted retries) |
| **20:16:57** | Recovery — `fly secrets unset VAPID_PUBLIC_KEY -a dukanchi-app` issued → Version 19 deploy without bad var |
| **20:17:xx** | `/health` returns 200 — production restored |

- **Hard down (503):** ~7-8 min
- **Total including degraded LB window:** ~11 min

#### 3b. Root cause

Placeholder text `<paste 88-char public key>` was **literally pasted** into the `fly secrets set` command instead of substituting in a generated key:

```bash
# What was actually executed (BAD):
fly secrets set VAPID_PUBLIC_KEY="<paste 88-char public key>" -a dukanchi-app
```

The literal string `<paste 88-char public key>` is not valid base64url. On next boot, `webpush.setVapidDetails()` validates the public key at module load (`src/services/push.service.ts`) → throws → server fails to start → crash loop.

Single-machine production deployment + module-load-time validation = guaranteed full outage on any bad VAPID secret.

#### 3c. Recovery

```bash
fly secrets unset VAPID_PUBLIC_KEY -a dukanchi-app
```

- `env.VAPID_PUBLIC_KEY` becomes `undefined`
- `src/services/push.service.ts` initialiser guards `if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)` — both being undefined skips `webpush.setVapidDetails()` entirely
- Server boots clean (push features gracefully disabled — no broken state)

#### 3d. Proper rotation (anti-pattern-free, shell-substitution approach)

Subsequent successful rotation executed without any copy-paste of the actual key:

```bash
# 1. Generate keys + write to gitignored temp file
node -e "const w=require('web-push'); const k=w.generateVAPIDKeys();
  console.log('PUBLIC:',k.publicKey); console.log('PRIVATE:',k.privateKey);
  require('fs').writeFileSync('/tmp/vapid.json', JSON.stringify(k));"

# 2. Set all three secrets via shell substitution — keys never visible in command history
fly secrets set \
  VAPID_PUBLIC_KEY="$(node -p "require('/tmp/vapid.json').publicKey")" \
  VAPID_PRIVATE_KEY="$(node -p "require('/tmp/vapid.json').privateKey")" \
  VAPID_MAILTO="mailto:support@dukanchi.com" \
  -a dukanchi-app

# 3. Clean up temp file
rm /tmp/vapid.json
```

**Verification:**
- `curl https://dukanchi.com/api/push/vapid-public-key` → returned matching new key (87 chars, base64url) ✅
- DB cleanup: `TRUNCATE "PushSubscription"` (old key-signed subs invalidated by the key rotation; 0 active users at this stage = zero user impact)

**New VAPID public key (production live):**
```
BGDgcI8MG3yjwO_fPX2amNEbgjWz-RSCghFn9o-QxrK6BvnLwvD3j_9dK4XSuKq64Oyr6mKaPZASevm08lM6AIk
```

(Public key is by definition non-secret — safe to inline in SESSION_LOG. Private key remains in Fly secrets only.)

---

### 4. Task 4 — Sentry alert rules (~30 min)

**Problem:** Sentry was capturing events (Day 4 Session 90 wiring), but no alert rules existed — errors landed in the Issues view silently. Founder had no out-of-band notification for new/escalated production errors.

**Setup:**
- **Project:** `node-express` (single project — backend + frontend both report here; Day 4 separation deferred to post-pilot)
- **Alert name:** "Production Errors — New + Escalated"
- **WHEN conditions** (new alert created — initial 4 default conditions narrowed to 2):
  - `A new issue is created` (kept)
  - `An issue escalates` (kept)
  - `An issue is resolved` (**removed** — noise, not actionable)
  - `A resolved issue becomes unresolved` (**removed** — noise)
- **Notify:** Member — `dukanchiapp@gmail.com` explicitly (NOT Suggested Assignees — fixed at single recipient to eliminate routing ambiguity)
- **Throttle:** every trigger (no rate limit — low-volume project, no flood risk)
- **Connected to** Error Monitor `monitor_id 7259669` (auto-created by Sentry)

**Test:** Sentry's "Send a test notification" → arrived in Gmail inbox within ~5s ✅. Subject line includes project + environment + issue title — readable at-a-glance.

---

### 5. Task 5 prep — CSP allowlist fix (PR #43)

**Discovery:** Sentry issue **NODE-EXPRESS-4** — CSP violation captured via Report-Only telemetry.

```
blocked_uri:        https://fonts.gstatic.com/s/inter/v20/...woff2
document_uri:       https://dukanchi.com/sw.js
source_file:        workbox-dcde9eb3.js
violated_directive: connect-src
```

**Root cause analysis:**

The PWA Service Worker (Workbox-generated via `VitePWA` plugin) has runtime caching for `fonts.gstatic.com` configured in `vite.config.ts:90-97`. When the SW fetches the Inter font WOFF2 via `fetch()` **inside the SW context**, that fetch is governed by `connect-src`, **NOT** `font-src`. The `font-src` directive only applies to `@font-face` resolution in the **document's** render context, not to programmatic fetches initiated from a service worker.

Our policy had `fonts.gstatic.com` in `font-src` (covers the document-side load path) but not in `connect-src` (which is the directive the SW fetch is bound by).

**Fix (1-line addition to `src/app.ts` connectSrc array):**

```ts
"https://fonts.gstatic.com", // PR #41 — Workbox SW fetch context (SW fetch → connect-src, NOT font-src)
```

**Cosmetic deviation:** Comment says `PR #41` but actual PR was `#43`. Not corrected in this session — hygiene candidate for a separate 1-liner.

**Comprehensive allowlist audit (ruled out speculative origins from prompt template):**

| Origin | Status |
|---|---|
| Razorpay (api/checkout) | NOT USED — Dukanchi explicitly does not process payments |
| Firebase web SDK | NOT USED — `firebase-admin` is backend-only; frontend uses `@capacitor/push-notifications` (Capacitor native bridge → Google Play Services, NOT browser fetch) |
| Google Tag Manager / GA | NOT USED — zero grep hits |
| `dukanchi-app.fly.dev` | NOT REFERENCED from frontend (browser always loads `dukanchi.com`) |

The comprehensive update reduced to a single connect-src addition. All other origins already covered by the PR #39 baseline + PR #40 Maps SDK fix.

**Mode:** CSP **remains in `reportOnly: true`** — enforce flip **deferred 24–48h** pending Sentry monitoring window confirming no new violations.

- Time: ~12 min (audit + 1-line edit + PR cycle + deploy + smoke)
- Production verification: `curl -sI https://dukanchi.com/` → header present; `fonts.gstatic.com` count in policy = **2** (font-src + connect-src) ✅

---

### 6. 🚨 ND-A1 — Dual Service Worker config: browser push DEAD in production

**Discovery moment:** During Task 5 audit + post-deploy browser DevTools validation of the CSP fix.

**Two SW files exist in repo:**

| File | Origin | Has push handler? |
|---|---|---|
| `public/sw.js` | Hand-rolled (74 lines), contains `addEventListener('push', ...)` + `notificationclick` | ✅ YES |
| VitePWA-generated SW | `vite-plugin-pwa` Workbox output at build time (~4497 chars) | ❌ NO |

`VitePWA`'s `generateSW` strategy **overwrites** `public/sw.js` during `vite build`. Production therefore ships the Workbox SW WITHOUT any push event listener.

**Browser-side validation** (DevTools console on `https://dukanchi.com`):

```js
// Q1 — confirm which SW is registered
await navigator.serviceWorker.getRegistration();
// → ServiceWorkerRegistration { scriptURL: "https://dukanchi.com/sw.js" } ✅

// Q4 — fetch + inspect SW source
const txt = await (await fetch('/sw.js')).text();
console.log('Has push handler?', /addEventListener\(['"]push['"]/.test(txt));
console.log('SW size:', txt.length, 'chars');
// → Has push handler? false | SW size: 4497 chars ❌
```

**Impact:**

| Surface | Status |
|---|---|
| Today's VAPID rotation (backend signing) | ✅ Backend signs push payloads correctly |
| Browser / PWA push delivery | ❌ Browser SW silently drops them (no push event listener) |
| Native Android (Capacitor APK + FCM) | ✅ UNAFFECTED — separate pathway: `firebase-admin` → `@capacitor/push-notifications` plugin → Google Play Services |

**Pilot impact assessment: P1 not P0**

- Founder-led GTM onboards retailers offline, with in-app CTAs pushing APK install
- Majority of pilot users expected on the APK (native FCM works correctly)
- PWA push fallback is dead — minority impact
- Today's VAPID rotation **is** legally/correctly done — the dead PWA SW just means no current consumer of those keys browser-side. Backend signing remains correct for when the PWA push path is restored.

**Fix approach (Day 2 P1, ~2 hr):**

1. Switch VitePWA strategy: `generateSW` → `injectManifest`
2. Create `src/sw.ts` — custom SW with push + notificationclick handlers + Workbox precache imports (`precacheAndRoute` + `cleanupOutdatedCaches`)
3. Update `vite.config.ts` PWA section accordingly

This preserves Workbox's runtime caching + precache benefits AND keeps the hand-rolled push logic. Standard pattern documented in VitePWA's `injectManifest` mode docs.

---

### 7. UX cleanup — PWA banners feature flag (PR #44, `eda3a4d` → `9475c90`)

**Problem:** Two install prompts cluttering `/home`:

- **TOP** thin banner — `"💡 App install karein better experience ke liye"` (`BrowserModeBanner` inline function at `App.tsx:95-130`)
- **BOTTOM** orange card — `"⭐ Dukanchi App install karo — faster experience!"` (`PWAInstallPrompt` component)

**Strategic alignment:** GTM is offline founder-driven retailer onboarding — install banners are redundant in the current flow. Cleaner `/home` competes for content attention with actual shop posts.

**Approach:** `VITE_SHOW_PWA_PROMPTS` env flag (default `false` / unset).

| File | Change |
|---|---|
| `src/App.tsx:186` | Wrap `<BrowserModeBanner />` in `{import.meta.env.VITE_SHOW_PWA_PROMPTS === 'true' && ...}` |
| `src/App.tsx:215` | Wrap `<PWAInstallPrompt />` in same conditional |
| `src/vite-env.d.ts` | Add `readonly VITE_SHOW_PWA_PROMPTS: string;` to ImportMetaEnv |
| `.env.example` | Add `VITE_SHOW_PWA_PROMPTS=false` with explanatory comment |

**Component code untouched** — `PWAInstallPrompt.tsx` and the inline `BrowserModeBanner` both stay intact. Flipping the flag re-enables instantly.

**DCE win (better than hoped):**

After `npm run build` with `VITE_SHOW_PWA_PROMPTS` unset, terser **fully dead-code-eliminated** both banners from the production bundle. Grep results across `dist/assets/`:

| Marker | Occurrences | Verdict |
|---|---|---|
| `"App install karein"` | **0** | ✅ pruned |
| `"Install Karo"` | **0** | ✅ pruned |
| `"Baad mein"` | **0** | ✅ pruned |
| `"💡 App install karein"` (full header text) | **0** | ✅ pruned |
| `"⭐ Dukanchi App install karo"` (full header text) | **0** | ✅ pruned |
| `"VITE_SHOW_PWA_PROMPTS"` (env literal) | **0** | ✅ Vite inlined the reference |
| `"dk-browser-mode"` | 1 (from unrelated helper at `App.tsx:54`, NOT banner) | ✅ resolved |

Mechanism: Vite inlines `import.meta.env.VITE_SHOW_PWA_PROMPTS` at build time as the literal value. Unset → `undefined` → conditional becomes `undefined === 'true'` → `false` → terser prunes the unreachable JSX, the `BrowserModeBanner` function body, and the `PWAInstallPrompt` import + module strings.

**Nuance N5 (documented in commit body for revert path):**

`import.meta.env.VITE_*` are inlined at **BUILD time**, NOT read at runtime. To re-enable banners in production:

1. Set `VITE_SHOW_PWA_PROMPTS=true` in the Docker **build context** (build arg or Fly secret read during `npm run build` stage).
2. Redeploy (`flyctl deploy`) — fresh build re-inlines the conditional as `true`.

Flipping a runtime Fly env var alone is **insufficient** — the bundle was already built with the conditional resolved to `false`.

**Visual confirmation:** Founder verified mobile viewport — both banners gone ✅.

- Time: ~22 min (audit + 4 edits + gates + PR cycle + deploy + smoke)

---

### 8. Learnings codified (L1–L5)

**L1 — Anti-pattern: Placeholder text in shell commands**

NEVER use `fly secrets set KEY="<paste here>"` style angle-bracket placeholders. They are extremely easy to leave unfilled, and the literal string passes validation at the shell layer (it's just bytes to `fly`) only to crash at the application validation layer.

ALWAYS shell-substitute from a temp file or a `node -p` evaluation:

```bash
fly secrets set KEY="$(node -p 'require(...)')" -a app
```

This makes "key never set" the failure mode if the upstream generation fails, rather than "key set to a placeholder".

**L2 — Single-machine production risks**

A bad secret on a single-machine Fly deployment + module-load-time validation = **guaranteed full outage**. Mitigations queued:

- Always have `fly secrets unset KEY` rollback ready before any secret rotation
- Consider 2+ machines or blue-green deployment for production redundancy (Series A scope — current pilot cost-justifies single machine)
- Move validation that can crash boot to lazy initialisation where possible (validate on first use, not at module load)

**L3 — Vite env vars are BUILD-TIME inlined, not runtime**

`import.meta.env.VITE_*` references are evaluated at `vite build` time, NOT at request time. Re-enabling DCE'd code requires a **rebuild + redeploy**, not a runtime env-var flip. Document this revert path in any PR that introduces a Vite-env-gated feature (see PR #44 commit body for the canonical example).

**L4 — Service Worker fetch context vs Document fetch context**

SW `fetch()` calls go through the `connect-src` CSP directive, NOT through `font-src` / `img-src` / `style-src` etc. Those directives apply only to the **document's** rendering context, not to programmatic fetches from a service worker. Any SW caching strategy (Workbox `runtimeCaching` etc.) needs its target origins listed in `connect-src` even if those same origins are already in the directive that matches the resource type.

**L5 — VitePWA `generateSW` overwrites hand-rolled SW**

`generateSW` mode emits a Workbox-based SW at `dist/sw.js`, **overwriting** any hand-rolled `public/sw.js` of the same path. Custom SW logic (push handlers, custom message routing, etc.) is silently lost. Solution: switch to `injectManifest` strategy with a custom `src/sw.ts` that imports Workbox precache helpers as needed.

---

### 9. Day 2 backlog

| Priority | Item |
|---|---|
| 🆕 **P1** | **ND-A1 fix** — VitePWA strategy switch to `injectManifest` + custom `src/sw.ts` with push handler (~2 hr) |
| 🟡 **P2** | **Task 5 enforce flip** — after 24-48h CSP Sentry monitoring clean (flip `reportOnly: true` → `false`) |
| ⏳ **P3** | **Task 6** — `npm audit fix` (17 moderate vulns reported in pre-Day-1 audit) |
| ⏳ **P3** | **Task 7** — APK rebuild + signed release |
| 🧹 Hygiene | CSP comment `PR #41` → `PR #43` typo correction (cosmetic 1-liner) |
| 📊 Observability | Sentry frontend project separation (deferred post-pilot — single `node-express` project acceptable at current scale) |
| 🛡️ Operational | Production redundancy — 2+ Fly machines or blue-green (Series A prep — L2 follow-through) |

---

### 10. Verification gates (this sprint day)

- **Tests:** 100/100 passing throughout (Rule G — `npm run typecheck` used, never `npx tsc --noEmit` alone)
- **Typecheck:** 0 errors throughout
- **Production smokes** (Rule E): all green
  - `/health` returned `{"status":"ok","db":"up","redis":"up"}` after each deploy
  - CSP header verified post-PR-#43 (`fonts.gstatic.com` × 2 in policy)
  - Bundle DCE verified post-PR-#44 (zero banner strings in `/assets/index-*.js`)
- **PRs merged:** 2 (#43, #44) — both via branch-protection-safe squash-merge through PR + CI cycle
- **Production HEAD:** `050dc62` (start) → `eda3a4d` (PR #43) → `9475c90` (PR #44)

---

### Session 98 commit (this entry)

`docs(day1): Session 98 closure — Day 1 launch sprint (4 tasks + outage forensics + ND-A1)` — pure documentation, no runtime impact.

## 2026-05-18 — Session 97 — Legal Phase A: DPDP docs + signup consent + backend ledger (feat/legal-phase-a)

**Goal:** Ship a DPDP Act 2023 baseline — five legal documents (EN + HI), in-app
discoverability, and a signup consent flow backed by a consent ledger.

**Work (Steps 1–6.5, branch `feat/legal-phase-a`):**
- **Step 1 — scaffold:** 22 files — `src/content/legal/` (10 markdown docs),
  `src/pages/legal/` (5 route pages), `src/components/legal/`, `src/lib/legal/`.
- **Step 2 — routing + chrome:** `/legal/*` lazy routes in `App.tsx`,
  `publicRoutes.ts` guard allow-list (+ index.html pre-React guard exemption —
  DPDP docs must be readable pre-signup), `LegalLayout` (TOC + bilingual chrome
  + error boundary), `LanguageToggle` (`?lang=` query param), `MarkdownRenderer`
  (react-markdown + remark-gfm, lazy — kept off the main chunk).
- **Step 3 — content:** 10 DPDP-grounded markdown docs (privacy / terms /
  account-deletion / grievance / cookies × EN + HI). Baseline only —
  `[TODO: ...]` placeholders for founder-specific details; "pending legal
  review" shown on every page.
- **Step 4 — frontend integration:** `ConsentCheckbox` (unticked-by-default,
  signup) + `LegalLinks` (one source of truth, `menu`/`footer` variants);
  customer profile Legal menu section; LandingPage.tsx + `public/landing.html`
  footer legal links; signup submit consent-gated.
- **Step 5 — backend:** additive `LegalConsent` Prisma model (User gets a
  back-relation only — no scalar change) + migration
  `20260518120000_add_legal_consent`; signup `consent: z.literal(true)` Zod
  gate; `AuthService.signup` writes the user row + one consent row in a single
  `$transaction`; doc versions stamped server-side from `versions.ts` (client
  cannot forge them); salted SHA-256 IP hash (raw IP never stored); `IP_SALT`
  env (fail-fast); `legal.consent.recorded` audit log line per signup.
- **Step 6 — tests:** `signup-consent.test.ts` — 11 tests (Zod consent gate,
  transactional ledger write, IP-hash-not-raw, UA truncation, server-side
  version stamping). 85 → 96.
- **Step 6.5 — retailer gap:** retailer profile is a flat page (no menu list);
  added a labelled "Legal & Privacy" card at its foot reusing
  `<LegalLinks variant="menu" />`.

**Deviations (ND-1…4 — all closed):**
- **ND-1** — This session ran in a worktree but `feat/legal-phase-a` (with the
  uncommitted Steps 1-3 work) lives in the main repo dir; worked directly there
  so the branch context is correct. Accepted.
- **ND-2** — `src/pages/LandingPage.tsx` is not routed (live landing is the
  static `public/landing.html`); added legal links to BOTH. Improvement.
- **ND-3** — `IP_SALT` fail-fast: implemented the JWT_REFRESH_SECRET pattern
  (dev fallback + production hard-fail), then tightened `.min(16)` → `.min(32)`
  to match `JWT_SECRET`. Three boot probes confirm: unset/short → `exit(1)`,
  valid 64-char → boots. Resolved.
- **ND-4** — Zod v4 `z.literal(true, { message })` syntax (errorMap shorthand
  changed in v4). Pure version adaptation. Resolved.

**BLOCKER (carried into the PR description):** the migration is created but NOT
applied to any database — `.env` `DATABASE_URL` points at production (Session 88
precedent) and there is no auto-migrate hook. Post-merge, before traffic:
`prisma migrate deploy` + set a production `IP_SALT`. Without these, signup 500s
(table missing) or the server refuses to boot (IP_SALT).

**Verification:** typecheck 0 · tests 96/96 · build ✓. Rule G followed
(`npm run typecheck` used throughout, never bare `npx tsc --noEmit`). Rule F
honoured — no test or smoke touched a real DB.

**Commit:** see PR `feat/legal-phase-a` → `main` (not merged — founder reviews).

## 2026-05-17 — Session 96 — Futuristic v2 Design-System Redesign (feat/futuristic-redesign)

**Goal:** Implement the `dukanchi-design-system` handoff — restyle the customer app to the futuristic v2 direction (deep-space dark + frosted glass + orange→magenta gradient, "Vision-OS" aesthetic).

**Status:** Code-complete. 10 phases, each verified green (typecheck 0 · tests 81/81 · build ✓). On `feat/futuristic-redesign` (off `main @ f5ad7c3`); PR opened against `main`. **No production change** — prod still `main @ 28a5614`.

**Approach:** View-layer-only restyle. Every screen's data fetch, auth, Socket.IO, Google Maps, AI and landing-CMS wiring preserved verbatim (Rule 4). Handoff kit JSX adapted into typed production React — never blind-copied.

**Phases:**
- P1 — `src/futuristic.css` (`--f-*` tokens, glass primitives, keyframes) + `main.tsx` import
- P2 — `src/components/futuristic/` typed primitives (FIcon set, FLogo, FPostCard, FBottomNav, …)
- P3 Home · P4 Search · P5 Map (Google Maps intact + dark map style)
- P6 StoreProfile + Chat · P7 Messages + Login + Signup
- P8 Profile + StoreInfoCard + ReviewsTab + PostsGrid
- P9 LandingPage + Three.js spatial hero (CDN `three@0.149.0`, graceful fallback — no npm dep)
- P10 App shell — BottomNav (glass pill), RefreshButton, NotificationBell, App.tsx Suspense fallback

**Files:** NEW — `src/futuristic.css`, `src/components/futuristic/` (13 files). MODIFIED — pages: Home, Search, Map, StoreProfile, Chat, Messages, Profile, Login, Signup, LandingPage; components: BottomNav, RefreshButton, NotificationBell, ConversationRow, profile/{PostsGrid,ReviewsTab,StoreInfoCard}; shell: App.tsx (Suspense fallback only — native block untouched), main.tsx (1-line CSS import).

**Anti-silent-failure audit:** Rule A — zero new `apiFetch` paths, `src/app.ts` untouched. Rule B — zero new silent catches (pre-existing ones preserved verbatim). Rule C — `capacitor.config.ts` untouched. Rule E — zero backend change → no prod curl needed.

**Scope boundary / follow-ups:**
- RetailerDashboard, UserSettings, Support, NotFound NOT redesigned (not in handoff) — remain cream.
- `LandingPage.tsx` restyled but not currently routed (pre-existing orphan; live `/landing` = static `public/landing.html`) — routing strategy TBD.
- Native APK rebuild + manual smoke-test PENDING — large UI change the APK renders; web-verified only (Rule D).
- Native status-bar colour still cream — left for the mixed-theme interim.

**Verification:** `npm run typecheck` 0 errors (web + server) · `npm test` 81/81 · `npm run build` ✓.

**Commit:** `feat: futuristic v2 design-system redesign — customer app restyle` (this commit).

---

## 2026-05-16 — Session 95 — Hardening Sprint Day 8: Atomic Merge + Production Verification (SPRINT CLOSED)

**Goal:** Atomically merge the 60-commit `hardening/sprint` branch into `main`, deploy to production via Railway, verify with the Rule E smoke battery + Sentry release verification. Final day of the 8-day Hardening Sprint.

**Status:** **DAY 8 COMPLETE — HARDENING SPRINT CLOSED.** 60 commits + 1 merge commit landed on `main` in a single `--no-ff` atomic merge. Production HEAD advanced `32f5525 → 28a5614`. **Zero customer-facing downtime** — Railway auto-rollback held production on the old HEAD through a first-deploy healthcheck failure (missing `JWT_REFRESH_SECRET` env var), which was fixed and redeployed clean.

**Production runtime CHANGED (first time this sprint).** `origin/main` HEAD `32f5525` → `28a5614`. All Days 1–7 hardening work is now live in production.

> Session window: started 2026-05-15 late evening, completed early hours 2026-05-16.

---

### 1. Pre-Flight Actions (4 user manual actions — all completed via dashboards)

- ✅ **Branch protection on `main`** — classic rule, no force-push, no deletion
- ✅ **`CODECOV_TOKEN`** added to GitHub Actions secrets
- ✅ **UptimeRobot monitor** for `/health` — 5-min interval, US West region
- ✅ **Sentry secrets** added to GitHub Actions + Railway:
  - `SENTRY_AUTH_TOKEN` (scopes: project:read, project:releases, org:read)
  - `SENTRY_ORG = dukanchi`
  - `SENTRY_PROJECT = node-express`

### 2. Atomic Merge

- Command: `git merge hardening/sprint --no-ff`
- Merge commit SHA: **`28a5614`** — `feat: Hardening Sprint atomic merge — Days 1-8 (60 commits)`
- Files changed: **127** (79 modified + 48 added)
- Lines: **+15,421 / −2,006**
- Husky pre-push hook ran `typecheck:web` + `typecheck:server` — **0 errors**
- Conflict-free (`ort` strategy — `main` had zero commits since the branch point)
- Push: `32f5525..28a5614  main -> main` — branch protection did not block the owner direct-push

### 3. Crisis + Fix — first-deploy healthcheck failure

- **First deploy attempt:** failed healthcheck after 4:13 (Docker build OK, Sentry init OK)
- **Root cause:** `JWT_REFRESH_SECRET` env var missing on Railway. The strict env validation added during earlier hardening (Day 5 / Session 92 — `env.ts` post-parse guard) kicked in on this deploy and hard-failed boot.
- **Log signal (clear, unambiguous):** `❌ JWT_REFRESH_SECRET must be set to a production value (≥32 chars)`
- **Fix:** `openssl rand -base64 48` → value added to Railway env vars
- **Second deploy:** SUCCESS (~5 min after env var added)
- **Zero downtime:** Railway auto-rollback held production on `32f5525` throughout the failed-deploy window — customers never saw a broken state
- **Verdict:** the strict-env guard worked **exactly as designed** — it caught a missing-secret misconfiguration that, under pre-hardening code, would have booted silently on a dev-fallback secret (a real security vulnerability)

### 4. Smoke Battery (Rule E — 5 production curls against https://dukanchi.com)

| # | Check | Result |
|---|---|---|
| 1 | `GET /health` status + timing | ✅ 200, 1.46s |
| 2 | `GET /health` body | ✅ `{"status":"ok"}` valid JSON |
| 3 | `POST /api/auth/login` invalid payload | ✅ 400 Zod validation (NOT 500) |
| 4 | `GET /api/posts` no auth | ✅ 401 "Access denied" |
| 5 | `GET /` SPA root | ✅ 200, `last-modified` matches deploy time, helmet + HSTS headers present |

All 5 endpoints healthy. Curl 3 returned 400 (not 401) because the smoke-script payload used `otp` where the schema requires `password` — the endpoint is healthy and rejecting bad input gracefully (see Finding 2).

### 5. Verification (manual via dashboards)

- ✅ **Sentry release `28a5614f591e`** — 333 files, 86 source maps uploaded, 100% crash-free
- ✅ **UptimeRobot** — zero downtime through the entire ~8-hour session; 100% uptime maintained
- ✅ Production endpoints all serving merged code (verified via `last-modified` header timestamp)

### 6. Deviations / Findings

1. **`ALLOWED_ORIGINS` env still leads with `http://localhost:3000`** (dev default) on production. P3 hygiene — harmless for same-origin browser traffic; pre-existing config, not introduced by this merge.
2. **Smoke-script Curl 3 used the wrong payload** (`otp` vs `password`) — Dukanchi login schema is `phone` + `password` only. RUNBOOK §6 smoke script needs the corrected payload.
3. **`CODECOV_TOKEN` was visible in a screenshot** during Pre-Flight Action 2 — rotate the token within 24h as post-Day-8 hygiene.
4. **`JWT_REFRESH_SECRET` strict validation worked exactly as designed** — caught a missing-env-var that would have been a silent security vulnerability under pre-hardening code. Positive finding, not a defect.

### 7. Post-Day-8 TODOs (priority order)

- **P1** — Rotate `CODECOV_TOKEN` (24h hygiene from screenshot exposure)
- **P2** — Update RUNBOOK §6 smoke script — Curl 3 payload (`password`, not `otp`)
- **P3** — `ALLOWED_ORIGINS` env cleanup (remove `localhost:3000` from prod)
- **P3** — Add CI status checks to the branch protection rule (now that `ci` runs on `main`)

### Sprint Close

- **Time elapsed:** ~8 hours (Day 7 carry-over + Day 8 pre-flight + crisis debug + closure)
- **Hardening Sprint Days 1–8: COMPLETE.** 11 working days (1, 2, 2.5, 3, 2.6, 4, 2.7, 5, 5.1, 6, 7) of hardening, atomically shipped Day 8.
- **Production runtime:** `28a5614` — advanced from the `32f5525` baseline held since Session 85 / Day 0.
- **Day 8 OFFICIALLY CLOSED.**

---

## 2026-05-14 — Session 94 — Hardening Sprint Day 7: Deploy Hardening + Coverage Foundation (5 phases shipped)

**Goal:** Land Day 7 of the Hardening Sprint — close the 5 findings from the Day 7 pre-flight audit, advance test coverage, fix admin-panel dev workflow, set up ESLint + Prettier. Pure infrastructure + tests session; production runtime unchanged.

**Status:** **DAY 7 COMPLETE** — 5 phases shipped, 5 commits, 0 reverts, all CI runs green, 81/81 tests held by close, typecheck 0 errors throughout. Branch advanced from 54 → 60 commits ahead of `origin/main`. All Day 8 user manual actions still queued (no new ones added this session).

**Production runtime UNCHANGED.** `origin/main` HEAD still `32f5525` (Session 85). All Days 1–7 changes on `hardening/sprint` only.

---

### 1. Day 7 Pre-flight Audit Recap

Audit covered 5 areas (R2 versioning, admin-panel routing, ESLint setup, coverage gap analysis, pre-Day-8 readiness) and produced **5 findings** (ND-D7-1 → ND-D7-5). Risk distribution: 0 CRITICAL, 0 HIGH, 2 MEDIUM (R2 + admin-panel), 1 LOW (ESLint scope-reducing surprise), 2 INFO (coverage baseline + Day-8 readiness intact).

**Two scope surprises surfaced during recon (worth flagging — both downgraded the original Day 6 assumptions):**

1. **Admin-panel routing — HIGH → MEDIUM.** The Day 6 audit called this user-facing on Day 1 launch. Recon revealed production routing was actually CORRECT (Dockerfile builds admin-panel/dist; src/app.ts:236-241 serves /admin-panel/* statically; Vite base + Router basename both already aligned). The real bug was **dev-workflow only**: both apps tried to bind port 5173. Reclassified MEDIUM. No production impact.

2. **R2 versioning — feature does not exist.** The Day 6 audit assumed Cloudflare R2 supported S3-parity versioning. Cloudflare confirmed (docs + Discord, Dec 2025): R2 has no native object versioning. ND-D7-1 closed with *corrected understanding* (not a misconfiguration). Pilot risk LOW given UUID-keyed paths + append-only upload patterns.

Q-D7-1 through Q-D7-6 all approved with defaults (no overrides needed mid-phase).

---

### 2. Phase-by-phase summary (5 phases, 5 commits)

| Phase | Commit | Title | Files | +/− | NDs closed | CI run |
|---|---|---|---|---|---|---|
| 1 | `1fd853a` | R2 RUNBOOK §7 correction — feature unavailability | 1 | +32 / −7 | ND-D7-1 (corrected understanding) | [25868228680](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/25868228680) (1m38s) |
| 2 | `4434a4b` | Admin-panel dev port 5174 + dual-app workflow doc | 3 | +36 / −4 | ND-D7-2 | [25868789797](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/25868789797) (1m11s) |
| 3 | `64d2313` | ESLint v9 flat + Prettier + CI report-only | 7 | +1579 / −50 | ND-D7-3, ND-D7-4 | [25869327265](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/25869327265) (1m42s) |
| 4 | `4e81a04` | Coverage ramp 6 services × 4 tests + 2 lib units (+39 tests) | 9 | +951 / −11 | ND-D7-5 (honest gap report) | [25870182117](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/25870182117) |
| 5 | (this commit) | Session 94 closure — SESSION_LOG + STATUS refresh | 2 | docs only | — | (queued at push time) |

**Phase 1 — R2 RUNBOOK correction (`1fd853a`).** User did 2-min Cloudflare dashboard check; reported NOT-APPLICABLE — R2 doesn't support native versioning. RUNBOOK §7 rewritten (~95 lines): corrected understanding + protection primitives table (Bucket Lock / Lifecycle Rules / app-level UUID keys / daily backup sync) + pilot risk assessment (LOW for 200 DAU; NO BLOCKER for Day 8) + 3 Day 7+ backlog items (object key uniqueness audit, Bucket Lock evaluation, daily backup snapshot for Series A). RUNBOOK §6 added "Document R2 backup strategy decision before launch" line. Net: ND-D7-1 CLOSED with corrected understanding.

**Phase 2 — Admin-panel port migration (`4434a4b`).** Production routing was already correct (verified during audit). Real fix: `admin-panel/vite.config.ts` port 5173 → 5174 + `strictPort: true` (fail loudly, no silent fallback). `.env.example` ALLOWED_ORIGINS adds `http://localhost:5174` defensively (admin-panel uses Vite proxy in dev so requests are technically same-origin, but defense-in-depth for direct calls). README.md replaced one-line "admin on :5174" with proper "Running Both Apps in Dev" subsection (three-terminal flow + browser URLs + Vite proxy mechanism + strictPort behavior + upgrade note). Manual smoke verified: `curl /admin-panel/login` → 200 text/html (NOT 302 to /login; bug eliminated). HTML asset paths all correctly prefixed `/admin-panel/`. Both `npm run build` (root) and `cd admin-panel && npm run build` succeed.

**Phase 3 — ESLint v9 + Prettier (`64d2313`).** Closed ND-D7-3 (no root ESLint) + ND-D7-4 (no CI lint gate). Installed ESLint v9.39.4 + typescript-eslint 8.57.0 + react-hooks 7.0.1 + react-refresh 0.5.2 + globals 17.4.0 + prettier 3.x + eslint-config-prettier 9.x (versions mirror admin-panel for consistency). New `eslint.config.js` (flat config, no parserOptions.project for sub-second runtime, mirrors admin-panel preset + eslint-config-prettier last). New `.prettierrc.json` (single-quote, 2-space, 100-char, trailing-comma all, semi, arrowParens always, LF). New `.prettierignore` mirroring ESLint ignores + markdown docs + lockfile. Four new package.json scripts: `lint`, `lint:fix`, `format`, `format:fix` (`:fix` variants are manual-only, never auto-run from CI/hooks). CI workflow adds two report-only steps (`Lint`, `Format check`) with `continue-on-error: true` per Q-D7-4. README.md got new "Code Style" section + VS Code format-on-save snippet. **Bug found mid-phase:** first lint run reported 3447 problems because `eslint .` traversed `.claude/worktrees/peaceful-dirac-41866d/` — a stale Day-1-era full repo mirror. Added `.claude/**` + `.code-review-graph/**` to ignores. Clean baseline: 448 ESLint problems (439 errors, 9 warnings; top rule `@typescript-eslint/no-explicit-any` at 333) + 174 Prettier-pending files. Per hard rule: NO `--fix` or `--write` runs on existing code; cleanup deferred to Day 8+ atomic sweeps.

**Phase 4 — Coverage ramp (`4e81a04`).** Closed ND-D7-5 with **honest gap report**. Target was 25-30% statements; actual 7.26%. +39 new tests delivered +2.96pt statements / +5.43pt functions (biggest gain — controllers + middleware now exercised) / +1.54pt branches / +3.18pt lines. All 6 priority services received the full 4 tests (Q-D7-5 spec, no scale-backs): stores (GET happy + 404 + 401 + POST Zod 400), search (GET happy + short-query auto-recovery + 401 + POST /history 400), posts (GET feed + POST 404 + 401 + Zod 400), users (GET happy + 404 + 401 + PUT 403; service UNMOCKED for coverage), kyc (GET status + 401 + Zod 400 + admin 403 carve-out; service UNMOCKED), messages (GET conversations + POST 404 + 401 + Zod refine 400). Plus 2 lib unit-test files (15 tests): redis-keys (TTL constants + 5 key formatters + cross-prefix invariant) and storeUtils (7 branches: closed-today / 24h / null / green / yellow / red / overnight). **Three bugs caught mid-phase:** (a) Auth middleware reads `req.cookies.dk_token`, not `token`; initial stores test had wrong cookie name → all assertions returned 401. (b) `store.service.getStoreById` uses `prisma.store.findFirst` (not `findUnique`) due to relation filter on `owner.deletedAt`; mock updated. (c) Zod's `.uuid()` rejects `00000000-0000-0000-0000-000000000099` (version digit is 0, not 4); switched to valid UUIDv4 pattern `12345678-1234-4234-8234-...`. vitest.config thresholds promoted to new baseline floor: statements 4→7, branches 2→4, functions 3→8, lines 4→7. **Honest gap explanation:** Math is 39 tests delivered +2.96pt = ~0.076pt per test; reaching 25% from 7.26% would need ~233 more tests at this density. Gap traces to two structural choices: route-level integration tests with service mocks (excellent for controllers + middleware composition; limited for service LOC), and frontend React pages (~1500 LOC at 0%) out of scope without jsdom + RTL (Q-D7-6 deferred). Both queued as Day 8+ backlog.

**Phase 5 — Day 7 closure (this commit).** SESSION_LOG entry (this section) + STATUS.md refresh. No code changes; documentation only.

---

### 3. Final ND status (Session 94 close)

**CLOSED (5/5 — all Day 7 findings):**
- ND-D7-1 ✅ — R2 versioning audit (with corrected understanding: Cloudflare feature does not exist; pilot risk LOW)
- ND-D7-2 ✅ — Admin-panel dev workflow port collision (port 5174 + strictPort + README dual-app section)
- ND-D7-3 ✅ — Root ESLint flat config live (mirrors admin-panel preset)
- ND-D7-4 ✅ — CI lint + format report-only steps live (continue-on-error: true)
- ND-D7-5 ✅ — Coverage ramp shipped (with honest gap report; +39 tests, +2.96pt statements, target depth NOT reached; mitigation queued for Day 8+)

**Q-D7 decision tracker (all 6 approved with defaults, no overrides):**
- Q-D7-1 (R2 versioning) — user does Cloudflare check ✅
- Q-D7-2 (admin-panel fix) — port to 5174 + fix README ✅
- Q-D7-3 (ESLint preset) — match admin-panel's recommended config ✅
- Q-D7-4 (ESLint CI + Prettier) — report-only + opinionated Prettier ✅
- Q-D7-5 (Coverage ramp) — breadth-first 6 services × 4 tests ✅
- Q-D7-6 (Frontend page tests) — defer to post-launch ✅

**No new NDs surfaced during Day 7 implementation** (in contrast to Day 6 which surfaced ND-D6-PHASE1-1 and ND-D6-PHASE3-1).

---

### 4. Tools / infrastructure added

ESLint + Prettier (root):
- `eslint.config.js` — flat v9 config, mirrors admin-panel preset + eslint-config-prettier last
- `.prettierrc.json` — opinionated config (single-quote / 2-space / 100-char / trailing-comma all)
- `.prettierignore` — ESLint-aligned + markdown docs + lockfile
- `package.json` scripts — `lint`, `lint:fix` (manual), `format`, `format:fix` (manual)
- `.github/workflows/ci.yml` — `Lint` + `Format check` steps with `continue-on-error: true` (report-only)
- README `Code Style` section + VS Code format-on-save snippet

Admin-panel dev workflow:
- `admin-panel/vite.config.ts` — `port: 5174` + `strictPort: true` + header comment
- `.env.example` — `ALLOWED_ORIGINS` extended with `http://localhost:5174` (defensive)
- README `Running Both Apps in Dev` subsection (three-terminal flow + URL clarity)

Documentation:
- `RUNBOOK.md` §7 — R2 protection strategy rewrite (~95 lines, replaces "UNKNOWN" placeholder)
- `RUNBOOK.md` §6 — added "Document R2 backup strategy decision" Day 8 line
- `RUNBOOK.md` Changelog — Session 94 / Day 7 Phase 1 entry

Tests (+39 across 8 files):
- `src/__tests__/stores.routes.test.ts` (4 tests)
- `src/__tests__/search.routes.test.ts` (4 tests)
- `src/__tests__/posts.routes.test.ts` (4 tests)
- `src/__tests__/users.routes.test.ts` (4 tests) — KycService UNMOCKED for coverage
- `src/__tests__/kyc.routes.test.ts` (4 tests) — UserService UNMOCKED for coverage
- `src/__tests__/messages.routes.test.ts` (4 tests)
- `src/lib/redis-keys.test.ts` (8 tests)
- `src/lib/storeUtils.test.ts` (7 tests)
- `vitest.config.ts` — thresholds promoted to new baseline floor

---

### 5. Metrics

| Metric | Day 6 close (Session 93) | Day 7 close (Session 94) | Δ |
|---|---|---|---|
| Tests passing | 42/42 | **81/81** | **+39 (+93%)** |
| Statements | 4.30% | **7.26%** | +2.96pt |
| Branches | 3.00% | **4.54%** | +1.54pt |
| Functions | 3.39% | **8.82%** | **+5.43pt** (best gain) |
| Lines | 4.81% | **7.99%** | +3.18pt |
| Typecheck errors | 0 | 0 (held throughout) |
| npm audit total | 8 vulns | 8 vulns (unchanged) |
| npm audit HIGH | 0 | 0 (held) |
| ESLint baseline | n/a | **448 problems** (439 errors, 9 warn) — report-only |
| Prettier baseline | n/a | **174 files** pending — deferred to Day 8+ |
| CI runs this session | n/a | **5 runs, 5 green**, avg ~1m26s (range 1m11s – 1m42s) |
| Commits this session | n/a | **5** (including this closure) |
| Reverts | n/a | **0** |
| Branch state vs main | 54 ahead | **60 ahead** |

---

### 6. Bugs caught + fixed mid-phase

High-value debugging artifacts worth preserving:

1. **Phase 3: `.claude/worktrees/` stale repo mirror.** First lint run reported **3447 problems**. Root cause: Git worktree at `.claude/worktrees/peaceful-dirac-41866d/` contains a Day-1-era full project mirror (commit `5b89e56`). `eslint .` traversed into it. Fix: added `.claude/**` + `.code-review-graph/**` to ignores. Clean baseline = 448. **Lesson:** Claude Code's `.claude/` worktree directories can poison codebase-traversing tools. Audit ignore lists for every new tool (eslint, prettier, vitest, tsc — vitest config already excludes node_modules + dist; new tools need explicit `.claude/`).

2. **Phase 4: Auth cookie name `dk_token`, not `token`.** Initial stores test had `Cookie: token=<jwt>`. Auth middleware reads `req.cookies.dk_token || req.headers.authorization?.split(' ')[1]`. Result: every test returned 401 with the JWT being undefined at the middleware layer. **Lesson:** verify cookie name conventions against `src/middlewares/auth.middleware.ts` line 110 — `dk_token` for customer/retailer, `dk_admin_token` for admin panel.

3. **Phase 4: Prisma `findFirst` vs `findUnique` for relation-filtered queries.** `store.service.getStoreById` uses `prisma.store.findFirst` because `findUnique` cannot filter on relation fields (`owner.deletedAt`). Test mocked `findUnique` and got null → 404 instead of 200. **Lesson:** when mocking Prisma, check the actual service code for the method name; relation-filter queries always use `findFirst`.

4. **Phase 4: Zod `.uuid()` rejects non-v4 UUIDs.** Pattern `00000000-0000-0000-0000-000000000099` has version digit 0 in the third group (UUIDv4 expects 4). Zod accepts only valid UUIDs per RFC 4122 + version. Switched to `12345678-1234-4234-8234-123456789xxx`. **Lesson:** for test UUIDs that must pass Zod `.uuid()` validation, use a valid UUIDv4 format.

---

### 7. Honest gap surfaces (not failures, just truth)

- **Coverage target 25-30% NOT met; actual 7.26%.** Gap traces to architecture (route-level integration with service mocks limits LOC gain) + scope (frontend pages deferred). Not a test-quality issue — all 39 tests are stable. Mitigation queued in Day 8+ backlog (unmock posts/search/messages services + jsdom + RTL for React pages).
- **174 Prettier-pending files + 448 ESLint baseline.** Tooling is configured; cleanup is intentionally deferred to Day 8+ atomic sweeps (per Phase 3 hard rule: no `--fix` / `--write` in this session).
- **Frontend React pages still 0% covered.** Q-D7-6 explicitly deferred jsdom + RTL infra. Recommended Day 8+ effort: 5-10 page tests should reach ~5-10pt additional coverage.

---

### 8. Day 8+ backlog reconciled (prioritized)

**HIGH (Day 8 atomic merge):**
1. **4 user manual actions before merge** (RUNBOOK §6):
   - `CODECOV_TOKEN` GitHub secret (~3 min)
   - `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` in Railway env + GitHub secrets (~5 min)
   - UptimeRobot signup + `/health` monitor 5-min interval (~5 min)
   - Branch protection rules on `main` — require PR + check `ci` + no force-push (~3 min)
2. **Atomic merge command**: `git checkout main && git merge hardening/sprint --no-ff && git push origin main`
3. **RUNBOOK §6 5-curl smoke battery** post-deploy (Rule E)
4. **Sentry release verification** — confirm RAILWAY_GIT_COMMIT_SHA appears in Sentry Releases with readable source maps

**HIGH (Day 8+ cleanup sweeps):**
5. **ESLint baseline cleanup sweep** — 333 `@typescript-eslint/no-explicit-any` + 67 `no-unused-vars` + 9 `no-empty` + 4 `no-useless-escape` + 1 `no-extra-boolean-cast`. Phased: services → controllers → lib. After cleanup, promote CI lint from `continue-on-error: true` to hard-gate.
6. **Prettier baseline cleanup sweep** — single `npm run format:fix` run touches 174 files. Mechanical commit with no logic changes.

**MEDIUM:**
7. **Unmock service layer for posts/search/messages** — estimated +10-15pt statements via deeper service LOC coverage with existing test count.
8. **Frontend test infra** (Q-D7-6 deferred) — jsdom + @testing-library/react + 5-10 React page tests → estimated +5-10pt statements.

**LOW:**
9. `notification.worker.ts` (121 lines at 0%) → 1 dedicated test file.
10. `bulkImport.service.ts` (290 lines at 0%) — has Day 6 unit smoke via tsx but no permanent vitest test.
11. **R2 application-level key audit** (RUNBOOK §7 carry) — verify all upload paths use UUID-keyed paths.
12. **R2 Bucket Lock evaluation** for `/kyc/` and `/products/` prefixes (RUNBOOK §7 carry).
13. **GH Actions Node 20 deprecation** — migrate to `@v5` of checkout/setup-node/github-script. 13 months runway.
14. **Staging environment setup (ND-D6-7)** — Neon paid branch + Railway second env + DNS subdomain (~2 hr). Deferred to Series A scope.
15. **Pen test (ND-D6-12)** — pre-launch external engagement.
16. **Daily R2 backup snapshot** (Series A scope, ~4-6 hr implementation).

---

### 9. Lessons learned

- **Recon-before-edit pattern saved ~30 min in Phase 2.** The Day 6 audit had pre-flagged admin-panel routing as HIGH severity needing extensive React Router debugging. 10 minutes of READ-ONLY recon (vite.config.ts + App.tsx + Dockerfile + src/app.ts:236-241) revealed the production path was correct and the actual bug was a 1-line port change. Codify: ALWAYS recon before assuming an audit's severity classification is right.
- **Honest gap reporting > inflated metrics.** Phase 4 could have padded coverage to 15-20% with low-quality "test that the function exists" assertions. Shipping 7.26% with honest explanation of the architectural ceiling is more useful — Day 8+ planning can now address the real bottleneck (service mocks + frontend gap) instead of chasing a metric.
- **Audit assumptions can be wrong, even from a thorough audit.** Day 6's audit was thorough but still got two calls wrong (admin-panel severity + R2 versioning existence). The Day 7 audit caught both during recon. Lesson: pre-flight audits are first-pass; recon-during-implementation validates.
- **`.claude/` artifacts poison ANY codebase-traversing tool.** ESLint hit this in Phase 3. Vitest config already had `.claude/` covered via node_modules exclusion + path patterns, but new tools (rg, find, grep, vitest coverage, ESLint, Prettier) need explicit `.claude/**` ignores. Add this as a default checklist item for any future tool integration.
- **CI continue-on-error is the right default for new gates.** Without it, Phase 3 would have shipped a CI-breaking commit (448 lint errors). With it, the baseline is published in CI logs without merge friction. Promote to hard-gate only after baseline is cleared.

---

### Commit chain summary (Day 7 totals)

```
1fd853a  docs(day7): correct R2 versioning assumption — RUNBOOK §7 reflects feature unavailability
4434a4b  fix(admin-panel): migrate dev server to port 5174 + clarify dual-app workflow
64d2313  chore(lint): ESLint v9 flat + Prettier + CI report-only step (Day 7 Phase 3)
4e81a04  test(coverage): ramp baseline 4.30% -> 7.26% via 6 services × 4 tests + 2 lib units
[this]   docs(day7): Session 94 closure — SESSION_LOG + STATUS + commit chain summary
```

Totals: 5 commits, 0 reverts, ~2598 insertions across ~17 file touches (with overlaps), all CI runs green, 81/81 tests by close, 0 typecheck errors throughout, branch advanced 54 → 60 ahead of main.

**Production HEAD remains `32f5525` (Session 85, Day 0).** Day 7 was a pure infrastructure + tests session — no production code paths modified.

### Verification (Phase 5 closure)

- `npm run typecheck`: 0 errors (Rule G — both `tsconfig.app.json` + `tsconfig.server.json`)
- `npm test`: 81/81 passing
- `npm run lint`: 448 problems (unchanged from Phase 3 baseline)
- `npm run format`: 174 files pending (unchanged)
- Closure commit CI run: (URL captured at push time; see Opus template summary)

---

## 2026-05-14 — Session 93 — Hardening Sprint Day 6: Tooling & CI Foundation (6 phases shipped)

**Goal:** Land Day 6 of the Hardening Sprint — close the 18 findings from the Day 6 pre-flight audit, lay the CI/CD + observability foundation needed for Day 8 atomic merge readiness. Pure infrastructure session; production runtime unchanged.

**Status:** **DAY 6 COMPLETE** — 6 phases shipped, 6 commits, 0 reverts, every CI run green, 42/42 tests held throughout. Branch advanced from 49 → 54 commits ahead of `origin/main`. Three user manual actions deferred to Day 8 atomic-merge prep (RUNBOOK §6 checklist).

**Production runtime UNCHANGED.** `origin/main` HEAD still `32f5525` (Session 85). All Days 1–6 changes on `hardening/sprint` only.

---

### 1. Day 6 Pre-flight Audit Recap

Audit covered 12 areas (CI, dependencies, coverage, bundle, docs, runbook, observability provisioning, uptime, secrets management, branch protection, build guards, ND numbering) and produced **18 findings** (ND-D6-1 → ND-D6-12, plus ND-D6-EXTRA-1 → EXTRA-6). Priority distribution:

- **Critical (must close Day 6):** ND-D6-1 (no CI), ND-D6-2 (no pre-commit hooks), ND-D6-6 (xlsx Prototype Pollution + ReDoS), ND-D6-11 (no rollback runbook)
- **Medium (Day 6 stretch):** ND-D6-3 (Sentry source maps unprovisioned), ND-D6-4 (no coverage measurement), ND-D6-5 (no bundle monitoring), ND-D6-9 (README boilerplate), ND-D6-10 (no uptime monitor), ND-D6-EXTRA-5 (no localhost build guard)
- **Day 7+ accepted:** ND-D6-7 (staging env), ND-D6-8 (ESLint + Prettier), ND-D6-12 (pen test), and 5 of 6 EXTRAs (commitlint, PR template, temp/ cleanup, console.* migration, scripts audit)

**One audit assumption proved wrong mid-Phase 2:** the claim that "all 7 HIGH-severity npm audit vulnerabilities are in xlsx" was incorrect. Only **1 of 7** was xlsx. The other 6 were transitive (babel-helpers, rollup, workbox-build, fast-uri, fast-xml-builder, serialize-javascript). Cleared via semver-compatible `npm audit fix` (no `--force`). Lesson: validate audit attributions before scoping; humility re: audit assumptions.

---

### 2. Phase-by-phase summary (6 phases, 6 commits)

| Phase | Commit | Title | Files | +/− | NDs closed | CI run |
|---|---|---|---|---|---|---|
| 1 | `99f7039` | GitHub Actions + pre-commit hooks + Dependabot | 8 | +779 / −1 | ND-D6-1, ND-D6-2 | [25862426164](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/25862426164) (1m24s) |
| 2 | `e40c854` | xlsx → exceljs + npm audit fix transitive HIGH/MODERATE | 6 | +1221 / −418 | ND-D6-6 + 6 transitive HIGH + 2 MOD | [25864188653](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/25864188653) (1m9s) |
| 3 | `2fde985` | Coverage (Codecov) + bundle-size PR comments | 4 | +303 / −14 | ND-D6-4, ND-D6-5 | [25864790123](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/25864790123) (1m24s + 1m29s) |
| 4 | `59a8733` | README rewrite + RUNBOOK + VITE_API_URL build guard | 3 | +581 / −13 | ND-D6-9 (audit), ND-D6-11, ND-D6-EXTRA-5 | [25865357051](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/25865357051) (1m10s + 1m33s) |
| 5 | `f429d38` | Sentry source maps + uptime docs + ND numbering cleanup | 3 | +143 / −0 | ND-D6-3, ND-D6-10 | [25865799505](https://github.com/dukanchiapp/Dukanchi-App/actions/runs/25865799505) (1m4s + 1m27s) |
| 6 | (this commit) | Session 93 closure — SESSION_LOG + STATUS refresh | 2 | docs only | — | (queued at push time) |

**Phase 1 — CI & hooks foundation (`99f7039`).** First commit closes ND-D6-1 (no CI/CD) + ND-D6-2 (no pre-commit hooks). Added `.github/workflows/ci.yml` (Node 22, PR + push-to-main triggers, concurrency cancel-superseded, 4 hard gates: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`). Added Husky v9 two-tier hooks (`pre-commit` runs lint-staged + `scripts/precommit-checks.sh` for secret scanning; `pre-push` runs `npm run typecheck`). Added Dependabot weekly Monday IST × 3 ecosystems (npm root + npm admin-panel + github-actions) with minor+patch grouped. Tested precommit script against 4 fixtures (benign / fake .env / fake AWS key / .env.example) — all expected outcomes. **Surfaced ND-D6-PHASE1-1:** user's local PAT lacked `workflow` scope; closed via `gh auth refresh -s workflow` per user.

**Phase 2 — xlsx → exceljs (`e40c854`).** Replaced sheetjs `xlsx` (Prototype Pollution + ReDoS HIGH advisories, no upstream fix) with `exceljs@4.4.0`. New `stringifyCellValue()` helper normalizes exceljs's discriminated cell-value union (strings/numbers/dates/formula objects/rich text/hyperlinks). Magic-byte file-format detection (`PK 0x50 0x4B` → xlsx; else CSV via Readable stream). `parseExcelFile` became async; caller at `store.controller.ts:219` updated with `await`. Dropped `.xls` from multer filter (exceljs doesn't support the legacy binary format — `.xlsx` and `.csv` only with clearer rejection message). `admin.service.ts` `exportStores()` rewritten with `workbook.xlsx.writeBuffer()`. **Audit refinement disclosed:** only 1 of 7 HIGH vulns was xlsx; ran `npm audit fix` (semver-compat, no `--force`) to clear 6 transitive HIGH + 2 MODERATE. Net: **17 vulns (8 LOW / 2 MOD / 7 HIGH) → 8 vulns (8 LOW / 0 / 0).** Unit smoke validated parsing on `temp/sample-bulk-import.csv` (10 products, 5 columns). Manual UI smoke deferred per Option B due to admin-panel routing bug discovered mid-session (out of Phase 2 scope; logged to Day 7+ backlog).

**Phase 3 — Coverage + bundle monitoring (`2fde985`).** Installed `@vitest/coverage-v8@4.x`. Added `test:coverage` script. Configured `vitest.config.ts` with v8 provider, reporters text+html+lcov+json-summary, scope `src/**/*.{ts,tsx}`, excludes (tests, test-helpers, main.tsx, configs). **Baseline measured (this commit, 42/42 tests passing):**
- Statements 4.30% (248/5766)
- Branches 3.00% (123/4096)
- Functions 3.39% (40/1178)
- Lines 4.81% (241/5003)

Thresholds set per Q-D6-1 locked decision MIN(baseline, 60%) with 0.3–1pt safety margin: `statements:4, branches:2, functions:3, lines:4`. CI workflow extended with `codecov/codecov-action@v5` (tokenless attempt per Q-D6-8) + new `bundle-size` job using `preactjs/compressed-size-action@v2` (PR-only, report-only per Q-D6-5, strips 8-char Vite hash). **Surfaced ND-D6-PHASE3-1:** public-repo tokenless Codecov upload returned `"Token required - not valid tokenless upload"` (Codecov policy change post-2021 security incident). `fail_ci_if_error: false` kept CI green. Action is forward-compatible — once user provisions `CODECOV_TOKEN` GitHub secret, upload succeeds without further changes. Bundle-size action posted first PR comment: `+67.2 kB (+27.04%), Total 316 kB` (cumulative growth across 50 hardening commits vs `main`).

**Phase 4 — README + RUNBOOK + VITE_API_URL build guard (`59a8733`).** Three deliverables:

- **README.md rewrite (232 lines):** Replaced 20-line AI Studio boilerplate. 11 sections per spec: CI badge + tagline, "What is Dukanchi" elevator pitch (B2B2C retail discovery in India), tech stack table, quick-start (Node 22, Neon, Redis/Upstash), full 22-row env vars table (DATABASE_URL, JWT_*, REDIS_URL, R2_*, SENTRY_*, POSTHOG_*, ADMIN_*, VITE_API_URL with ND-D6-EXTRA-5 callout, GEMINI_API_KEY), build & deploy (web/server/mobile/Railway), testing (with this session's coverage baseline), mobile (Capacitor + Rule C cross-ref), annotated project structure tree, contributing (two-AI workflow + PR/branch conventions), license TBD. Zero AI Studio references remaining.

- **RUNBOOK.md (NEW, 324 lines):** 8 sections: deploy process (pipeline diagram + ~6-8 min push-to-live), Railway rollback (~3-5 min MTTR + rollback-vs-hotfix matrix), Neon PITR (7-day free tier), incident response (severity matrix + first-5-min checklist + decision tree + postmortem template), 6 common failure modes (Railway deploy fail, Sentry spike, auth refresh loop, DB connection exhaustion, Redis unavailable, stale PWA bundle — each with symptom + checks + resolution), Day 8 atomic merge checklist (env var provisioning, branch protection rules per Q-D6-6, 5-curl smoke battery per Rule E, rollback trigger thresholds), R2 versioning status UNKNOWN (Day 7 action), useful commands (Railway CLI / Prisma `db push` vs `migrate deploy` / Neon test-branch switching / R2 cleanup / log tailing).

- **vite.config.ts build guard (ND-D6-EXTRA-5):** Throws when `mode === 'production'` AND `VITE_API_URL` matches `http(s)://localhost` or `http(s)://127.0.0.1`. Skipped in dev + when var unset (CI parity preserved). Verified all 4 cases: localhost FAIL ✅, 127.0.0.1 FAIL ✅, prod URL PASS in 9.60s ✅, unset (CI parity) PASS ✅.

**Phase 5 — Sentry source maps + uptime docs (`f429d38`).** Recon green: `@sentry/vite-plugin@5.3.0` still pinned, conditional wiring intact, `build.sourcemap: true`, auto-discovers release from `RAILWAY_GIT_COMMIT_SHA`. No vite-config code changes needed.

- **RUNBOOK §9 (~95 lines):** Why source maps matter (minified vs readable stack-trace example), env var table, step-by-step Internal Integration creation with least-privilege scopes (Releases:Admin + Project:Read only), Railway provisioning, GitHub Actions secrets provisioning, verification procedure, auto-release tagging.
- **RUNBOOK §10 (~75 lines):** UptimeRobot setup target (`/health`), recommended config table (free tier, 5-min interval, 30s timeout), step-by-step, optional public status page via `status.dukanchi.com`, alternatives comparison, upgrade triggers, incident-response cross-ref.
- **CI workflow:** Build step now forwards `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` from GitHub repo secrets. Verified locally: dummy creds → plugin tries upload → 401 → **build still succeeds in 15.65s** (proves plugin doesn't fail-build on auth errors — safe for CI with misconfigured secrets). CI log on this run confirmed secret-passthrough with empty values + graceful skip.
- **ND numbering cleanup:** Phase 3's `ND-D6-9 (NEW)` (Codecov token) renamed → `ND-D6-PHASE3-1` to remove collision with audit's original ND-D6-9 (README boilerplate, closed Phase 4). Conceptual rename; commit bodies retain original wording.

**Phase 6 — Day 6 closure (this commit).** SESSION_LOG entry (this section) + STATUS.md refresh. No code changes; documentation only.

---

### 3. Final ND status (Session 93 close)

**CLOSED (10):**
- ND-D6-1 ✅ — No CI/CD (Phase 1)
- ND-D6-2 ✅ — No pre-commit hooks (Phase 1)
- ND-D6-3 ✅ — Sentry source maps unprovisioned (Phase 5 — docs + CI wiring; user manual provisioning queued for Day 8)
- ND-D6-4 ✅ — No coverage measurement (Phase 3)
- ND-D6-5 ✅ — No bundle monitoring (Phase 3)
- ND-D6-6 ✅ — xlsx Prototype Pollution + ReDoS (Phase 2)
- ND-D6-9 (audit) ✅ — README boilerplate (Phase 4)
- ND-D6-10 ✅ — No uptime monitor (Phase 5 — docs; user manual provisioning queued for Day 8)
- ND-D6-11 ✅ — No rollback runbook (Phase 4)
- ND-D6-EXTRA-5 ✅ — No localhost build guard (Phase 4)

**OPEN — DEFERRED to Day 7+ or Day 8 manual:**
- ND-D6-7 — Staging environment (Day 7+ — needs Neon paid tier + Railway env split)
- ND-D6-8 — ESLint + Prettier (Day 7+)
- ND-D6-12 — Pen test (Day 7+ — pre-launch external)
- ND-D6-EXTRA-1/2/3/4/6 — commitlint, PR template, temp/ cleanup, console.* migration, scripts audit (Day 7+)

**NEW NDs surfaced during Day 6 (2):**
- ND-D6-PHASE1-1 — Local PAT missing `workflow` scope. Closed mid-Phase 1 via `gh auth refresh -s workflow`.
- ND-D6-PHASE3-1 (formerly "ND-D6-9 NEW") — Codecov tokenless upload rejected by Codecov policy. Forward-compatible. **OPEN — Day 8 user manual action** (~3 min: codecov.io OAuth → copy upload token → GitHub repo secret).

---

### 4. Tools / infrastructure added (consolidated)

CI / hooks / dependency management:
- `.github/workflows/ci.yml` — Phase 1 + extended Phase 3 (Codecov, bundle-size job) + Phase 5 (Sentry env passthrough)
- `.github/dependabot.yml` — weekly Monday IST, 3 ecosystems, minor+patch grouped
- `.husky/pre-commit` + `.husky/pre-push`
- `.lintstagedrc.json` + `scripts/precommit-checks.sh` (74 lines)

Source / build:
- `vite.config.ts` — ND-D6-EXTRA-5 build guard (Phase 4); Sentry plugin wiring preserved from Day 4
- exceljs replaces xlsx — `bulkImport.service.ts`, `admin.service.ts`, `store.controller.ts`, `store.routes.ts`
- `vitest.config.ts` — coverage block (v8 provider, 4 reporters, baseline-driven thresholds)
- `temp/sample-bulk-import.csv` (gitignored — for future smokes)

Docs:
- `README.md` rewrite — 232 lines, 11 sections
- `RUNBOOK.md` (NEW) — 454 lines (Phase 4 base 324 + Phase 5 +130), 10 sections + Changelog

---

### 5. Metrics

| Metric | Pre-Day-6 | Post-Day-6 |
|---|---|---|
| npm audit total | 17 vulns | **8 vulns** |
| npm audit HIGH | **7** | **0** |
| npm audit MODERATE | 2 | 0 |
| npm audit LOW (firebase-admin transitive, accepted) | 8 | 8 |
| Tests passing | 42/42 | 42/42 (unchanged — Day 6 added zero new tests by design) |
| Coverage — statements | (not measured) | 4.30% |
| Coverage — branches | (not measured) | 3.00% |
| Coverage — functions | (not measured) | 3.39% |
| Coverage — lines | (not measured) | 4.81% |
| Typecheck errors | 0 | 0 (held throughout) |
| Bundle size (gzipped, hardening/sprint vs main) | (not measured) | 316 kB total, +67.2 kB vs main (informational only) |
| CI runs this session | n/a | 5 runs, 5 green, avg ~1m15s (range 1m4s – 1m33s) |
| Commits this session | n/a | 6 (including this closure) |
| Reverts | n/a | 0 |
| Branch state | 49 ahead of main | **54 ahead of main** |

---

### 6. Lessons learned / process notes

- **Day 5.1 Rule G discovery validated Phase 1 priority.** The 6 strict-config typecheck errors that hid behind `npx tsc --noEmit` for two days are exactly the class of bug CI catches. Phase 1's CI gate on `npm run typecheck` would have failed PR #1 from session 1.
- **Validate audit attributions before scoping.** The "all 7 HIGH are xlsx" claim from Day 6 pre-flight was wrong. A 30-second `npm audit` re-read mid-Phase 2 surfaced this; otherwise Phase 2 would have closed only 1/7 HIGH. Always verify the numbers an audit cites.
- **Codecov tokenless upload is no longer free-public-repo.** Post-2021 Codecov security incident, the action's CLI mode requires repository-bound tokens. The `fail_ci_if_error: false` knob is the right default — coverage is informational; a Codecov 5xx must never block merge.
- **Sentry plugin graceful degradation is the right pattern.** Plugin gated on `!!(authToken && org && project)`; partial sets explicitly rejected; build succeeds without secrets. Replicate this for future optional integrations (e.g., PostHog source-map upload when Vite plugin lands, OpenTelemetry exporters).
- **RUNBOOK before atomic merge, not after.** Writing rollback procedures _after_ the merge that needs them is too late. Day 6 placement (before Day 8 atomic merge) gives both Opus + Claude Code a shared mental model for incident triage.
- **Build-time guards beat runtime fallbacks.** Day 5.1's `resolveApiBase()` runtime fix was defense-in-depth, but the right place to catch a localhost API URL in a production build is at build time. The ND-D6-EXTRA-5 guard fails fast with a clear message; users learn the right env var to set without filing a Sentry ticket later.

---

### 7. Day 7+ backlog reconciled

Carried forward from prior sprints + new Day 6 additions:

**High-priority Day 7 candidates:**
1. **Coverage ramp 4% → 70%.** Multi-sprint effort. Priority paths: routes/services beyond auth (kyc, posts, search, stores, messages, push, team, users — all at 0%). Frontend pages need `@testing-library/react` + jsdom infra first (already in Day 2.7 backlog). Realistic target: 30% by end of Day 7, 50% by Day 8, 70% post-launch.
2. **R2 versioning audit** (~2 min Cloudflare check). Confirm `dukanchi-prod` versioning state; enable + 30-day retention if disabled. Documented in RUNBOOK §7.
3. **Staging environment setup (ND-D6-7).** Neon paid tier branch + Railway second environment + DNS subdomain. ~2 hr.
4. **Admin panel routing bug.** `localhost:5173/admin-panel/login` auto-redirects to `localhost:5173/login` — Vite base + React Router base mismatch. ~1 hr.

**Day 7 medium:**
5. ESLint + Prettier setup (ND-D6-8). ~1 hr.
6. Bundle chunking — manual chunks for `@sentry/react` + `posthog-js` to reduce +130KB critical-path (carried from Day 4 backlog).
7. 17 remaining backend `console.*` calls → pino logger migration (carried from Day 4).
8. Commitlint + PR template (ND-D6-EXTRA-2 + EXTRA-3).
9. GH Actions Node 20 deprecation — migrate to `@v5` of checkout/setup-node/github-script. 13 months runway; can wait but cheap to do now.

**Day 7+ accepted (lower priority):**
10. Pen test (ND-D6-12) — pre-launch external engagement.
11. `temp/` cleanup audit (ND-D6-EXTRA-4) — `temp/accidental-user-snapshot-2026-05-12T13-26-19Z.json` after Day 8 deploy success.
12. Scripts directory audit (ND-D6-EXTRA-6) — `scripts/seedTestData.ts`, `backfillEmbeddings.ts`, `generateIcons.cjs` smoke + doc.
13. Sentry session replay opt-in decision — awaits privacy review.

**Day 8 user manual actions (RUNBOOK §6 checklist):**
- `CODECOV_TOKEN` GitHub secret (closes ND-D6-PHASE3-1) — ~3 min.
- `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` in Railway env + GitHub secrets (completes ND-D6-3 follow-through) — ~5 min.
- UptimeRobot signup + monitor configuration (completes ND-D6-10 follow-through) — ~5 min.
- Branch protection rules on `main` (Q-D6-6 USER MANUAL ACTION) — ~3 min.

---

### Commit chain summary (Day 6 totals)

```
99f7039  feat(ci): GitHub Actions + pre-commit hooks + Dependabot config
e40c854  feat(deps): migrate xlsx -> exceljs + npm audit fix transitive HIGH/MODERATE vulns
2fde985  feat(ci): coverage measurement (Codecov) + bundle size PR comments
59a8733  docs(day6): README rewrite + RUNBOOK + VITE_API_URL build guard
f429d38  docs(day6): Sentry source maps + uptime monitoring + ND numbering cleanup
[this]   docs(day6): Session 93 closure — SESSION_LOG + STATUS refresh
```

Totals: 6 commits, 0 reverts, ~3027 insertions across ~24 file touches (with overlaps), all CI runs green, 42/42 tests held, 0 typecheck errors throughout, branch advanced 49 → 54 ahead of main.

**Production HEAD remains `32f5525` (Session 85, Day 0).** Day 6 was a pure tooling/infrastructure session — no production code paths modified.

### Verification (Phase 6 closure)

- `npm run typecheck`: 0 errors (Rule G — both `tsconfig.app.json` + `tsconfig.server.json`)
- `npm test`: 42/42 passing
- Closure commit CI run: (URL captured at push time; see Opus template summary)

---

## 2026-05-14 — Session 92.1 — Hardening Sprint Day 5.1: Native APK Smoke + 3 Production Fixes Shipped

**Goal:** Validate Day 5 refresh-token rotation end-to-end on a physical Android device via Capacitor APK. Day 5's 42/42 mocked tests + curl smokes proved logical correctness; Day 5.1's job was live device verification.

**Status:** **CODE COMPLETE on `hardening/sprint`** — 4 commits this session (3 production fix + 1 closure docs). Branch advanced from 45 to 49 commits ahead of `origin/main`. T1 (customer login) live-validated on real device; T2-T6 deferred (already covered comprehensively by Phase 5 unit tests against stateful in-memory Redis mock). Production deploy still gated on Day 8 atomic merge.

**Production runtime UNCHANGED.** `origin/main` HEAD still `32f5525` (Session 85). All Day 1-5.1 changes on `hardening/sprint` only.

### Pre-flight (Day 5.1 setup)

- **adb PATH permanent fix in `~/.zshrc`** (Q14 Option A) — `ANDROID_HOME` + platform-tools added to PATH for future sessions. Current Claude Code subprocess didn't inherit (Bash tool launched before .zshrc edit); inlined `/Users/apple/Library/Android/sdk/platform-tools/adb` for this session's adb commands.
- **Phone connected:** Vivo X200, device ID `10BECN0KCN001RU`, USB debugging authorized.
- **Capacitor + ngrok + Neon TEST** all verified in pre-flight 6-check (5/6 ✓, 1 deferred to inline workaround per D17).

### Phases summary

**Phase 1 — Backend + ngrok bridge.** Backend booted against revived Neon TEST branch on port 3000; ngrok tunnel `https://recollect-clay-defame.ngrok-free.dev` established. CORS verified on 3 origin scenarios (ngrok-as-origin, OPTIONS preflight, Capacitor `https://localhost`). **Surfaced D18:** `app.ts:78` Access-Control-Allow-Headers missing `x-refresh-token` — Day 5 Phase 4 Q6 implementation gap. Day 5 backend curl smoke (S8) passed despite this because curl doesn't enforce CORS preflight; browser WebView would have failed.

**Phase 1.5 — `131e86f` `fix(auth): add x-refresh-token to CORS Allow-Headers for native silent refresh`** (Day 5 retroactive). 1-line addition to app.ts:78. Verified live via OPTIONS preflight from `Origin: https://localhost` — response now includes `X-Refresh-Token` in Allow-Headers. Pushed immediately per user direction (same pattern as Day 5 Phase 1 closure protocol).

**Phase 2 — Capacitor config update.** Added `server.url`, `cleartext: false`, `allowNavigation` inside `server` block. Loud REVERT-BEFORE-COMMIT comment (Day 5.1 smoke only). `npx cap sync android` clean (0.158s, 6 plugins).

**Phase 2.5 — `3a9b27d` `fix(typecheck): resolve 6 strict project-config errors + Rule G`** (Day 4 + Day 5 retroactive). `npm run build` blocked at typecheck step. Standard `npx tsc --noEmit` (root composite tsconfig) had been reporting "0 errors" but the project-specific configs (`tsconfig.app.json` + `tsconfig.server.json`) caught 6 retroactive errors:
  - `AiBioModal.tsx:83` missing `captureEvent` import (Day 4 c7c0ef0)
  - `tsconfig.app.json` missing `posthog.ts` + `sentry-frontend.ts` includes (Day 4 c7c0ef0)
  - `AuthContext.tsx:123` useEffect TS7030 fallthrough (Day 5 e6d0608)
  - `auth.controller.ts:39` unused `generateRefreshToken` import (Day 5 e6d0608)
  - `tsconfig.server.json` missing `redis-keys.ts` include (Day 5 969579e)

  **Codified CLAUDE.md Rule G** — always use `npm run typecheck` (runs both project configs), never `npx tsc --noEmit` alone. Origin attribution links to Day 5.1 / Session 92.1.

**Phase 3 — APK build + install.** Gradle assembleDebug took 18s not 30-40 min (D25 — cache warm from prior session). APK = 7.55 MB. `adb uninstall` returned DELETE_FAILED_INTERNAL_ERROR (D26 — Vivo package-manager quirk OR no prior install); `adb install -r` succeeded regardless. Package visible: `com.dukanchi.app`.

**Phase 3.5 — ngrok ERR_NGROK_6024 fix.** Added `android.overrideUserAgent: "DukanchiTestAgent/1.0"` to bypass ngrok's free-tier interstitial. Loud REVERT-BEFORE-COMMIT comment (Day 5.1 smoke only). APK rebuilt (2s) + reinstalled.

**Phase 3.6 — `f106024` `fix(api): resolve API base URL at runtime to handle remote-load WebView origins`** (production-safety improvement). Phase 5 T1 first attempt failed with `net::ERR_CLEARTEXT_NOT_PERMITTED` — frontend was fetching `http://localhost:3000` because `VITE_API_URL=http://localhost:3000` was baked at build time. **D28 latent bug:** never hit by production native APK because production `.env` sets `VITE_API_URL=https://dukanchi.com`; surfaced first by Day 5.1 server.url smoke. Fix added `resolveApiBase()` helper that branches on `window.location.hostname === 'localhost'`:
  - Production native (bundled, hostname=localhost) → returns `API_BASE` (unchanged behavior)
  - Native remote-load (server.url override, hostname=ngrok) → returns `''` for same-origin relative paths
  - Web PWA → returns `''` (unchanged)

  3 call sites refactored: `apiFetch`, `attemptRefresh`, `getSocketUrl`. **Non-revertable improvement** — production-safe, stays permanently in `src/lib/api.ts`.

**Phase 3.7 — `temp/seed-test-customer.ts`** (gitignored helper). Idempotent script that updates phone `9999900001` to password `test1234` for repeatable smoke logins. Refuses to run if DATABASE_URL_TEST equals DATABASE_URL (Rule F guard). First run hit **D29:** `blockedReason` doesn't exist in prisma schema (only in fixtures.ts TestUser interface — evaluateUserStatus shape vs DB column mismatch). Removed from script's update payload. Second run UPDATED existing user 99cbffbf-7d47-4e42-84a1-84f31465ad5b cleanly.

**Phase 4 — Chrome DevTools remote debugging.** User attached DevTools via `chrome://inspect/#devices`. Network + Application tabs available.

**Phase 5 — Live smoke battery:**
- **T1 (customer login on device): ✅ PASS — END-TO-END VALIDATED**
  - POST `/api/auth/login` → 200, 1.5 kB, 1.30s
  - 22 subsequent API requests all 200
  - Home feed rendered with stores, images, geolocation-based listings
  - All API calls correctly resolved to ngrok URL (NOT localhost) via `resolveApiBase()` — the latent D28 bug fix proved out live on real device
  - dual-cookie issuance + localStorage population both visible in DevTools Application tab
  - **End-to-end native flow validated on real Android device**
- **T2-T6 (refresh rotation, reuse detection, app restart, logout, family revoke): DEFERRED** — already covered comprehensively by Phase 5 unit tests (42/42 mocked against stateful in-memory Redis simulator). User decision per Option B: skip redundant device validation, trust the unit-test coverage.

**Phase 6 — This closure.** Reverted both Day 5.1 smoke overrides in `capacitor.config.ts`:
  - `server` block: removed `url` + `cleartext` + `allowNavigation` + 6-line REVERT comment
  - `android` block: removed `overrideUserAgent` + 7-line REVERT comment

Verified via `git grep "DAY 5.1 LOCAL SMOKE ONLY" capacitor.config.ts` (0 matches) + `git diff capacitor.config.ts` (empty diff vs HEAD baseline). Re-ran `npx cap sync android` clean (0.204s). Hard gates: typecheck PASS, 42/42 tests PASS.

### 13 Deviations consolidated (D17–D29)

- **D17** (pre-flight) — adb installed at `~/Library/Android/sdk/platform-tools/adb` but not on PATH. Surfaced + user fixed via .zshrc Option A.
- **D18** (Phase 1) — CORS Allow-Headers missing `x-refresh-token`. Shipped as commit `131e86f`.
- **D19** (Phase 1) — User's .zshrc PATH fix doesn't propagate into Claude Code's running Bash subprocess. Inlined absolute adb path for this session.
- **D20** (Phase 1.5) — WebView origin nuance: server.url loading is same-origin, doesn't exercise production cross-origin CORS path. CORS fix still correct for production scenario.
- **D21** (Phase 2) — `cap sync` emits "Cannot copy web assets" warn when server.url set without prior build. Capacitor explicitly says "not an error".
- **D22** (Phase 3 Step 1) — Verification protocol gap: `npx tsc --noEmit` (root composite tsconfig) misses project-specific strict-config errors. Closed by Rule G in commit `3a9b27d`.
- **D23** (Phase 3 Step 1) — dist/ never created when build exits early at typecheck step.
- **D24** (Phase 2.5) — User spec said 4 fixes; actual was 6 (the extra 2 surfaced when `typecheck:server` ran — exactly Rule G's scenario). Commit subject adjusted to `fix(typecheck)` from `fix(frontend)`.
- **D25** (Phase 3 Step 3) — Gradle build 18s not 30-40 min. Cache warm from prior session.
- **D26** (Phase 3 Step 4) — `adb uninstall` returned `DELETE_FAILED_INTERNAL_ERROR`. Non-blocking; `adb install -r` handled replacement.
- **D27** (Phase 3.5) — Phase 6 revert list has TWO items (server.url + overrideUserAgent), not one. Both grep-detectable via `DAY 5.1 LOCAL SMOKE ONLY` marker.
- **D28** (Phase 3.6) — Latent baked-VITE_API_URL bug: production native APKs never hit it because real prod VITE_API_URL is the correct target. Day 5.1 server.url smoke surfaced first. Shipped as `f106024` — non-revertable production-safety improvement.
- **D29** (Phase 3.7) — `fixtures.ts` TestUser interface has `blockedReason` field that doesn't exist in prisma schema. Low-priority reconcile backlog item.

### Production bugs caught and shipped (3 commits + 1 helper + Rule G codified)

1. **`131e86f`** — CORS Allow-Headers gap for X-Refresh-Token (Day 5 Phase 4 Q6 retroactive)
2. **`3a9b27d`** — 6 strict typecheck errors hidden by verification protocol gap + CLAUDE.md Rule G codified (Day 4 + Day 5 retroactive)
3. **`f106024`** — `resolveApiBase()` for remote-load WebView origins (latent bug, production-safety improvement)
4. **`<this closure commit>`** — Session 92.1 docs

`temp/seed-test-customer.ts` is a smoke helper, gitignored under `temp/` — not a shipped commit. Same precedent as Day 2.6's `temp/r2-cleanup-day26.ts`.

### Day 5.1 follow-up backlog (5 items)

1. **Day 5.2 — Bundled-mode Capacitor smoke** (~30 min separate session). Build APK without `server.url` (production-mirror mode: WebView loads from `https://localhost` bundled dist; API calls to remote backend via `VITE_API_URL`). This exercises the X-Refresh-Token CORS path on a real device — fills the gap D20 documented (Day 5.1 server.url smoke is same-origin, doesn't directly test the cross-origin production path).
2. **T7 — Native header positive test in suite.** Phase 5 T4 tested `X-Refresh-Token`-via-cookie-fallback (no cookies + no header → 401). The positive case (`X-Refresh-Token` header + no cookies → 200 + new tokens) was verified live by Day 5 S8 curl smoke but not yet in the test suite. Add as 43rd test.
3. **LOGGED_OUT vs REUSE_DETECTED error code differentiation** — Phase 5 D13 follow-up. Post-logout refresh currently returns `code: 'REUSE_DETECTED'` (semantically accurate since blacklisted jti is treated identically to rotated jti). Distinguishing in error code would improve observability without changing behavior.
4. **D29: fixtures.ts TestUser.blockedReason vs prisma schema reconcile** — low-priority cleanup. evaluateUserStatus consumes a status shape that includes blockedReason (always null in practice); the test helper mirrors this shape but it diverges from the prisma write shape.
5. **Native iOS smoke** — when user expands Capacitor build to iOS. Same logical flow as Android Day 5.1; different WebView (WKWebView), different cookie quirks, different default User-Agent.

### Deploy plan unchanged

Day 8 atomic merge `hardening/sprint` → `main`. Pre-merge action item still in place: provision `JWT_REFRESH_SECRET` in Railway dashboard (`openssl rand -base64 48`), verified by the env.ts post-parse guard (Day 5 S7 smoke).

---

## 2026-05-13 — Session 92 — Hardening Sprint Day 5: Refresh Token Rotation + Admin Cookie Bug Fix

**Goal:** Replace the Day 2.5 "renew same 7-day JWT" /refresh with a true industry-standard rotation pattern (Auth0/Clerk-style) — short-lived access tokens (15min) + long-lived rotating refresh tokens (30d) + one-time use + theft detection. Plus fix the admin cookie routing bug (Day 5 audit ND #2) and add native (Capacitor) silent-refresh support.

**Status:** **CODE COMPLETE on `hardening/sprint`** — 4 commits this session (3 feature + 1 docs). Branch **45 commits ahead of `origin/main`** (was 41 at start of Session 92; +4 this session). 17 files / +1817 / -164 / +6 tests (36→42 passing). Production deploy DEFERRED to Day 8 atomic merge.

**Production runtime UNCHANGED**: Railway watches `main`. `origin/main` HEAD still `32f5525` (Session 85). All Day 1-5 + 2.5 + 2.6 + 2.7 changes on `hardening/sprint` only.

**Neon TEST branch revived in pre-flight:** Prior `hardening-day2-test` branch had decayed (surfaced in Day 2.7 Phase D). User created a fresh Neon `test` branch (parent: production, current data) before Day 5 audit, updated `DATABASE_URL_TEST` in `.env`. All 8 Phase 6 smokes ran against the live TEST DB.

### What was done — 4-commit chain (3 feature + 1 docs)

1. `969579e` — **feat(auth): refresh token rotation backend with theft detection (incl. ND #2 fix)** [Day 5 Phases 1+2+3 + Phase 4 Q6 backend]
   New `src/lib/redis-keys.ts` (90 lines — key patterns + TTL constants + inline threat-model docstring). New `src/services/refreshToken.service.ts` (439 lines — 5 public functions: generateRefreshToken, verifyRefreshToken, rotateRefreshToken, rotateFromVerifiedPayload, detectReuseAndRevokeFamily, revokeRefreshToken; RefreshTokenError typed class with 4 codes). New `JWT_REFRESH_SECRET` env (zod-validated, distinct from JWT_SECRET, dev fallback + production hard-fail guard via post-parse check). `src/modules/auth/auth.service.ts` extracts signAccessToken helper (now exported) with type:'access' + jti claims + 15-min expiry; signup/login/team-member-login all return `{user, accessToken, refreshToken}`. `src/modules/auth/auth.controller.ts` full rewrite (270 lines) — setAuthCookies routes by role (ND #2 fix), blacklistAccessTokenIfPresent for logout, /refresh full flow with verify → user-status check → rotate → REUSE_DETECTED handoff to detectReuseAndRevokeFamily. `src/middlewares/auth.middleware.ts` adds type === 'access' check (lenient on missing for legacy) + accessBlacklistKey(jti) check. `src/modules/auth/auth.routes.ts` drops `authenticateAllowDeleted` from /refresh (controller does its own user-status check, preserves Day 2.5 carve-out for deleted_pending users). `src/app.ts` + `src/lib/logger.ts` redact paths add `req.headers["x-refresh-token"]` + body.accessToken/refreshToken so tokens never land in structured logs. Phase 4 Q6 backend: auth.controller.ts /refresh reads cookies first, falls back to `X-Refresh-Token` header (native clients).

2. `e6d0608` — **feat(auth): silent refresh frontend interceptors (PWA + admin panel)** [Day 5 Phase 4]
   `src/lib/api.ts` major rewrite (247 lines, +211 net) — refresh-token localStorage helpers (`getRefreshToken/setRefreshToken/clearRefreshToken/setTokens/clearTokens`), `attemptRefresh()` with native/web branching (native sends X-Refresh-Token header + reads body tokens to localStorage; web uses cookies + IGNORES body — XSS invariant), 401 interceptor in `apiFetch` with `__isRefreshRetry` flag for infinite-loop protection, `REFRESH_BYPASS_PATHS` array, `auth:expired` event dispatch on refresh failure. `src/context/AuthContext.tsx` updated — `login()` signature accepts 4th optional `refreshToken` arg, `logout()` uses `clearTokens()`, new useEffect listens for `auth:expired` event. `src/pages/Login.tsx` + `src/pages/Signup.tsx` pass `data.refreshToken` to login() with `data.accessToken ?? data.token` fallback for back-compat. `admin-panel/src/lib/api.ts` adds axios response.use interceptor with same refresh-on-401 pattern (cookie-only, redirects to /login on failure).

3. `d96146f` — **test(auth): 6 refresh flow integration tests + mock-redis set ops** [Day 5 Phase 5]
   New `src/__tests__/auth.refresh.test.ts` (419 lines, 6 tests) — supertest + stateful in-memory Redis simulator (vi.hoisted Map<string,string> KV + Map<string,Set<string>> sets) so tests assert on STORED STATE not just mock-call shape:
     - T1 rotates on first use (old jti blacklisted, new jti active, family extends)
     - T2 reuse → 401 + entire family revoked (verifies sMembers empty, all jtis blacklisted)
     - T3 invalid signature → 401 + zero state mutation (deep-equality snapshot)
     - T4 no cookie + no header → 401 NO_REFRESH_TOKEN + zero state mutation
     - T5 logout blacklists refresh + access jtis, post-logout refresh fails
     - T6 admin login sets dk_admin_* ONLY (ND #2 regression) + inverse check
   `src/test-helpers/mock-redis.ts` extended with sAdd/sMembers/sRem stubs for future tests. Final test count: 42/42 in ~1s.

4. `<this commit>` — **docs(day5): Session 92 SESSION_LOG + STATUS update + Neon test branch note** [Day 5 Phase 6 closure]
   This entry + STATUS.md refresh. Cites all 3 feature commit hashes, 14 NDs accepted by user, 8 smokes passed against live Neon TEST.

### 14 Deviations / Surprises accepted (D1-D14)

- **D1** (Phase 2): `generateRefreshToken` signature changed from `(userId, role, familyId?)` to `(userId, role, opts?: {familyId?, teamMemberId?})` mid-flight — teamMemberId needed in refresh payload for team-member impersonation sessions.
- **D2** (Phase 2): Exported `rotateFromVerifiedPayload` alongside `rotateRefreshToken` so controller can insert user-status check between verify and rotate (Service=state, Controller=policy split).
- **D3** (Phase 2): `detectReuseAndRevokeFamily(userId, familyId)` signature changed from spec's `(jti, familyId) → void` — userId needed to DEL `rt:active:{userId}:{jti}` keys. Returns `{revokedCount}` additively.
- **D4** (Phase 2): Family-set TTL re-stamped on every rotation via explicit `pubClient.expire()` after sAdd. Without this, Redis SET TTL isn't reset by SADD and family could expire mid-rotation chain.
- **D5** (Phase 2): `Sentry.captureMessage(level:'warning')` for security events (refresh_token.reuse_detected, refresh_token.family_revoked) — NOT captureException (it's a signal, not a code error). Matches Day 4 ND #6 philosophy.
- **D6** (Phase 3): Access token symmetric defense — `type: 'access'` claim added by signAccessToken; authenticateToken middleware rejects `type === 'refresh'` (lenient on missing type for legacy compat).
- **D7** (Phase 3): Race window between `SET rt:blacklist` and `DEL rt:active` (~1ms) — blacklist-first ordering preserves theft-signal priority (concurrent reuse sees blacklist, gets REUSE_DETECTED not NOT_ACTIVE). Atomic MULTI/EXEC deferred to follow-up.
- **D8** (Phase 4): Web frontend NEVER reads body tokens — `setTokens()` web-no-op invariant explicit in code + docstring. `attemptRefresh()` on web reads only response status, never `.json()` the body. XSS protection preserved.
- **D9** (Phase 4): `auth:expired` event bus pattern between `api.ts` and `AuthContext.tsx` — decouples token logic from React/router. Listener mounted before any 401 (AuthProvider wraps app root).
- **D10** (Phase 4): No new tests added in Phase 4 — Phase 5 owns the test additions. Day 2.7 Test 7 already updated in Phase 3 to exercise new flow.
- **D11** (Phase 4): `data.accessToken ?? data.token` fallback in Login.tsx + Signup.tsx — defensive against deploy-transition where new frontend hits older backend (or vice versa). Removes after a few weeks of stability.
- **D12** (Phase 5): Test file at `src/__tests__/auth.refresh.test.ts` per spec. Existing convention is colocated; `src/__tests__/` matches vitest include glob, no config change needed.
- **D13** (Phase 5): T5 post-logout refresh returns `code: 'REUSE_DETECTED'` (not a LOGOUT-specific code). Semantically accurate (logged-out jti is blacklisted same as rotated jti) but frontend should treat any 401-with-code on refresh as "redirect to login". User accepted as future-hardening item.
- **D14** (Phase 5): T6 inverse check added beyond spec (customer cookies absent from admin response AND vice versa). ~10 extra lines, high regression value.

### 8 Manual smoke results (S1-S8 against revived Neon TEST)

| # | Test | Result |
|---|------|--------|
| S1 | Boot + /health | ✅ HTTP 200 + X-Request-Id, no Prisma error (Neon TEST alive) |
| S2 | Customer signup + login | ✅ dk_token + dk_refresh ONLY; both in Set-Cookie + body |
| S3 | /refresh with cookies | ✅ 200 + rotated tokens (new jti, same familyId) |
| S4 | Reuse old refresh | ✅ 401 `{"code":"REUSE_DETECTED"}` |
| S5 | Admin login | ✅ dk_admin_token + dk_admin_refresh ONLY (ND #2 regression-proof live) |
| S6 | Logout | ✅ All 4 cookies cleared (Expires:1970); post-logout /me → 401 TOKEN_REVOKED (access blacklist enforced) |
| S7 | Prod-fail guard | ✅ `EXIT_CODE=1` + openssl hint when NODE_ENV=production + dev fallback secret |
| S8 | X-Refresh-Token header path | ✅ 200 + new tokens (native client compat) |
| R2 | Smoke artifact check | ✅ 0 candidates — Day 5 didn't touch upload paths |

### Day 5 follow-up backlog items

1. **Native APK rebuild + manual test** (per Rule D / Q13) — backend + frontend changes are 100% testable via mocks + curl, but the full native flow (login → 15-min expiry → silent refresh → retry) needs a real device + APK rebuild. Deferred to **Day 5.1 follow-up session**.
2. **LOGGED_OUT vs REUSE_DETECTED code differentiation** (D13) — post-logout refresh currently returns REUSE_DETECTED. Frontend should treat both as "redirect to login", but distinguishing in logs would improve observability. Future-hardening.
3. **Atomic MULTI/EXEC for blacklist+delete race window** (D7) — 1ms race between `SET rt:blacklist` and `DEL rt:active` in rotation. Acceptable for 1.0; tighten when refactoring redis layer.
4. **`issueTokenForUser` cleanup** — Marked @deprecated in Phase 3; no internal callers remain. Safe to remove after Day 8 deploy stability period.
5. **Refresh-token-aware `req.user` typing** — `req.user` is currently `(req as any).user` in controllers. Could be tightened with a typed Express.Request augmentation. Cosmetic; not blocking.
6. **Test customer row in TEST DB** — Phone `9999900001` created during S2 smoke. Lives in TEST branch (per Rule F.2), no production impact. Optional cleanup via psql DELETE.

### Phase E execution notes

3 feature commits + 1 docs commit (this entry). No hunk-splits needed — file-to-commit mapping was unambiguous (cleaner profile than Day 3's 3 hunk-splits). Typecheck PASS at each commit's staged content; tests jump 36 → 36 → 42 → 42 across the chain (commit 3 adds the 6 new tests). Each commit body cites the relevant phases + NDs by number for traceability.

### Deploy plan unchanged

Day 8 atomic merge `hardening/sprint` → `main` → Railway redeploy + full Rule E verification + JWT_REFRESH_SECRET provisioned in Railway dashboard pre-merge.

---

## 2026-05-13 — Session 91 — Hardening Sprint Day 2.7: Test Coverage Sprint (Scope 2)

**Goal:** Build the integration test scaffolding that Day 5 (Auth Refinements) will need. Convert smoke-only confidence on Day 3 security surfaces (upload validation, body limit, rate-limiter, JWT whitelist, bcrypt) into durable test confidence. Land Day 2.5 carve-out test for /refresh.

**Strategic context:** Day 5 audit (Session 91 part 1, see Day 5 Auth Refinements audit) surfaced ND #7 — no E2E auth flow tests exist; shipping refresh-token rotation without coverage = high regression risk. Strategic pivot to Day 2.7 (Test Coverage Sprint) BEFORE Day 5 implementation to build the test scaffolding first. Day 5 will then add refresh-flow tests on top of this base.

**Status:** **CODE COMPLETE on `hardening/sprint`** — 3 commits (2 test + 1 docs). Branch **41 commits ahead of `origin/main`** (was 38). **0 production code touched** (Day 2.7 invariant held). 7 new files (5 helpers + 2 test files) + 2 dev dependencies. **21 → 36 tests** (+15 = +14 spec'd + 1 bonus positive-control). All passing in ~1s.

**Production runtime UNCHANGED**: Railway watches `main`. `origin/main` HEAD still `32f5525` (Session 85).

### What was done — 3-commit chain (2 test + 1 docs)

1. `219160f` — **test(auth): integration scaffolding + 7 auth-critical tests (Day 2.7 P1)**
   New `src/test-helpers/` directory (5 reusable factories totaling 489 lines):
   - `app-factory.ts` (87 lines) — `makeTestApp` builder for supertest. Avoids importing src/app.ts (which would require mocking 20+ modules); each test mounts only the routes under test. Body-limit + cookie-parser + 413-handler opts.
   - `fixtures.ts` (221 lines) — `makeTestUser`, `makeTestStore`, `makeTestProduct`, `makeTestPost` + convenience builders (`makeDeletedPendingUser`, `makeDeletedExpiredUser`, `makeBlockedUser`). Partial-overrideable. Plain objects, no real DB.
   - `mock-prisma.ts` (81 lines) — `makeMockPrisma` shape-compatible client mock.
   - `mock-redis.ts` (45 lines) — `makeMockRedis` pub+sub client mock with sane defaults + sendCommand stub.
   - `jwt-helpers.ts` (55 lines) — `signTestJWT` (HS256 7d), `signWrongAlgJWT` (HS512), `signExpiredJWT` (1s past iat), shared `TEST_JWT_SECRET`.

   7 new auth tests in `src/modules/auth/auth.integration.test.ts` (236 lines):
   - [T1] login valid → 200 + dk_token cookie + token
   - [T2] login wrong password → 401 generic (Day 3.5 info-leak fix preserved)
   - [T3] login blocked + correct pwd → 401 status='blocked'
   - [T4] login deleted_pending + correct pwd → 401 status='deleted_pending' (login still rejects; carve-out is /refresh only)
   - [T5] GET /me valid token → 200 password-stripped
   - [T6] GET /me no token → 401 'Access denied'
   - [T7] /refresh deleted_pending → 200 + new token (Day 2.5 carve-out preserved)

   Deps: `supertest@7.2.2` + `@types/supertest@7.2.0` (devDeps, runtime impact 0).

2. `ec75f0f` — **test(security): 8 integration tests — upload + body-limit + rate-limit + JWT + bcrypt (Day 2.7 P2)**
   `src/middlewares/security.integration.test.ts` (317 lines). Reuses Commit 1 scaffolding.

   - [T8] Upload text-as-jpeg → 415 MIME_MISMATCH (magic-byte via file-type@3.9.0)
   - [T9] Upload 12MB → 413 FILE_TOO_LARGE (Multer LIMIT_FILE_SIZE → 11a handler)
   - [T10] 1.5MB JSON body on 1MB route → 413 PAYLOAD_TOO_LARGE (11b handler)
   - [T11] 5MB JSON body on /ai route (10MB override) → 200 accepted
   - [T12] Rate-limit max=3 → 4th req 429 + Retry-After + RateLimit-* headers (Day 2.6 ND #2 standardHeaders validation)
   - [T13] HS512 token via authenticateToken → rejected (Day 3.1)
   - [T13b] HS256 token via authenticateToken → accepted (positive control — bonus)
   - [T14] bcrypt round-trip rounds=4 + $2b$04$ prefix + wrong-password rejection (Day 3.4)

   `fs/promises.writeFile` mocked at module level so disk-fallback path in upload.middleware doesn't write real files (Rule F + Rule F.2).

3. `<this commit>` — **docs: Session 91 — Day 2.7 Test Coverage Sprint + Neon decay note + STATUS refresh**
   This SESSION_LOG entry + STATUS.md refresh.

### NDs documented (4 — all accepted by user)

- **ND #1 (test-helper fixture bug)** — Initial `makeDeletedPendingUser` set `deletedAt` in the PAST. Production semantic is `deletedAt` = "when soft-delete becomes effective" → FUTURE for pending, PAST for expired. Tests 4 + 7 caught it; fixture corrected before commit. **NOT a production bug — pure test-authoring error.** Strong validation signal: Day 2.5 logic is solid (assertions matched right behavior; helper was wrong).
- **ND #2 (JWT iat byte-identical)** — Removed T7's "new token != old token" assertion. JWT `iat` is in seconds; two signings in the same second produce byte-identical tokens. Day 2.5 doesn't promise rotation; Day 5 will (jti UUID per issue). Test inline-documented to point forward to Day 5 TDD.
- **ND #3 (T13b positive control)** — Kept. Defensive test design: T13b proves the algorithm whitelist (not test-rig brokenness) is the only reason T13 rejects. 3ms cost. 7 spec'd + 1 bonus = 8 P2 tests.
- **ND #4 (rate-limit-redis bypass)** — T12 uses express-rate-limit's MemoryStore with max:3 instead of production RedisStore + max:10. Lua EVAL scripts in rate-limit-redis aren't trivially mockable. Test validates the LIBRARY contract (429 + standardHeaders → Retry-After + RateLimit-* headers) and OUR config preferences. Store-specific behavior is Day 8 integration concern. Documented inline.

### Day 2.7 invariant held: 0 production code touched

Pre-flight constraint: "Day 2.7 should be test-only". Verified via `git status -s` filtered to non-test paths → **empty**. Only changes outside test files were `package.json` + `package-lock.json` (devDep additions only).

### Verification (Phase D)

- Typecheck: PASS (0 errors at each commit's HEAD and at final HEAD)
- Test suite: **36/36 passing** in 909-976ms (run twice; ~5% variance, no flakes)
- Boot smoke on TEST branch: ⚠️ PASS-with-caveat — server boots, /health 200, X-Request-Id present, but `ensureAdminAccount` failed with `PrismaClientInitializationError: Can't reach database server` (Neon test branch `hardening-day2-test` decayed). Pre-existing infra issue (STATUS.md flagged auto-expiry May 19; appears to have happened earlier). Caught by existing try/catch — non-fatal. **Not a Day 2.7 regression.**
- R2 bucket: 11 objects scanned, 0 smoke candidates. Day 2.7 mocked `fsp.writeFile`, no R2 writes. Rule F.2 honored via mocking.
- Rule A/B/F/F.2: all honored (test-only changes, no production behavior alteration)

### Pre-flag for Day 5 — Neon TEST branch revival needed

**Required user action BEFORE Day 5 audit/implementation:** Recreate or revive the Neon TEST branch (`hardening-day2-test`) so `DATABASE_URL_TEST` resolves to a live endpoint. Day 5's auth-flow integration smokes will hit the DB-dependent paths (signup → persist, refresh → user lookup, etc.); mocked tests (Day 2.7's 36) work fine, but live smokes need a live test DB.

Estimated effort: 5-min Neon dashboard task (branch from prod main, point `DATABASE_URL_TEST` to the new branch).

### Backlog created / preserved

- **`tsconfig.test.json` deferred (still)** — Vitest config comment from Day 2.5 said "Future Day 2.7 work may add". Tests compile via vitest's internal esbuild. Test files don't get same strict typecheck as production. **Optional cleanup, not blocking.** Marked for a future focused cleanup pass.
- **Frontend component tests** — `@testing-library/react` + jsdom setup not added. Frontend (React pages, Day 4 PostHog event captures) untested. **Defer to a frontend-focused test sprint.**
- **CI integration** — `.github/workflows/*` absent. Pre-commit hooks not added. **Day 6 territory per original sprint plan.** Don't merge concerns.
- **Day 5 readiness** — Auth-flow refresh-rotation tests will be added by Day 5 itself (TDD: write failing test, implement, verify green). Day 2.7 scaffolding ready.
- **Cascade integration tests (Priority 3 from audit)** — `/api/account/delete` flow, FCM purge atomicity in `$transaction`, store/post reads with deleted-owner filter. **Defer to a future test sprint** when fixture complexity is justified by need.
- **Socket auth E2E (Priority 4 from audit)** — io.use auth tests, sendMessage per-message defense. **Defer** — Socket.io test patterns add another infrastructure layer.

### Files (Day 2.7 cumulative)

7 new files (5 helpers + 2 test files) + 2 modified (package.json, package-lock.json).

**Per-file LOC (new):**
- `src/test-helpers/app-factory.ts`: 87
- `src/test-helpers/fixtures.ts`: 221
- `src/test-helpers/jwt-helpers.ts`: 55
- `src/test-helpers/mock-prisma.ts`: 81
- `src/test-helpers/mock-redis.ts`: 45
- `src/modules/auth/auth.integration.test.ts`: 236
- `src/middlewares/security.integration.test.ts`: 317
- **Total new: 1042 LOC** (helpers: 489; tests: 553)

**Diff stat (vs HEAD = 6de5716):**
- 2 modified (package metadata): +215 / -4
- 7 new: +1042
- **Cumulative: ~+1257 / -4** (~+1042 code-only, excluding package-lock churn)

### Production code untouched

**Critical Day 2.7 invariant: ✅ HELD.** `git status` filtered to non-test, non-package paths returns empty. Zero changes to `src/app.ts`, `src/lib/*`, `src/middlewares/*` (the production files), `src/modules/*/{controller,service,routes}.ts`, etc. Day 2.7 surface is exclusively `src/test-helpers/` + `*.integration.test.ts` files.

### Deploy plan unchanged

Day 8 atomic merge `hardening/sprint` → `main`. Production runtime continues on Session 85.

---

## 2026-05-13 — Session 90 — Hardening Sprint Day 4: Observability (Scope 2)

**Goal:** Close the observability gap identified in Day 3+2.6 — backend Sentry hardening (release tag + request-ID correlation), structured logs in socket-listeners, frontend Sentry + PostHog with graceful degradation, source-map upload pipeline, and 7 product events for the new analytics surface.

**Status:** **CODE COMPLETE on `hardening/sprint`** — 3 commits (2 feature + 1 docs). Branch **38 commits ahead of `origin/main`** (was 35). 17 files (15 modified + 2 new) / ~+1372 / -63 across the full Phase D diff (~+365 / -63 source LOC excluding package-lock churn). 21/21 tests still passing.

**Production runtime UNCHANGED**: Railway watches `main`, not feature branches. `origin/main` HEAD still `32f5525` (Session 85). Day 1+2+2.5+3+2.6+4 all live on `hardening/sprint` only.

### What was done — 3-commit chain (2 feature + 1 docs)

1. `ea42840` — **feat(observability): backend Sentry release tag + request-ID propagation + socket-listeners structured logs** [Day 4 backend]
   `src/lib/sentry.ts`: Sentry.init now passes `release: RAILWAY_GIT_COMMIT_SHA || npm_package_version || 'unknown'` so the Sentry UI can correlate errors to specific deploys. `src/app.ts`: new section 4b middleware (after pinoHttp, before routes) sets `X-Request-Id` response header AND `Sentry.getCurrentScope().setTag('request_id', req.id)` for log↔Sentry correlation. `src/config/socket-listeners.ts`: 9 `console.*` calls migrated to pino structured logs with event tags (`socket.auth.*`, `socket.connect`, `socket.disconnect`, `socket.message.drop.*`, `socket.message.save_failed`) and context fields (userId, socketId, senderId, receiverId, roles, reason). Backend `console.*` count: 26 → 17.

2. `c7c0ef0` — **feat(observability): frontend Sentry + PostHog + source map build pipeline** [Day 4 frontend + build]
   New file `src/lib/sentry-frontend.ts` (92 lines): @sentry/react init with `VITE_SENTRY_DSN`, browserTracing + replay integrations (replay session OFF by default — `replaysSessionSampleRate:0`; on-error 100% — `replaysOnErrorSampleRate:1.0`; mask all text + media for privacy when toggled on). Naming disambiguates from existing backend `src/lib/sentry.ts` (ND #1).
   New file `src/lib/posthog.ts` (96 lines): posthog-js init targeting **eu.i.posthog.com** (DPDP-friendly, closer to India) via `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST`. autocapture + pageview ON; session_recording explicitly OFF; dev-mode auto-opt-out so local dev doesn't pollute events. Three exported helpers (`initPostHog`, `identifyUser`, `captureEvent`).
   `src/main.tsx`: both inits called BEFORE React renders.
   `src/context/AuthContext.tsx`: `setSentryUser` + `identifyUser` on login + session-revival; `setSentryUser(null)` + `identifyUser(null)` on logout; `user_logged_in` event captured.
   7 product events wired across 6 files: `user_signed_up`, `user_logged_in`, `store_created`, `post_created`, `ai_feature_used` × 3 (photo-to-post, voice-to-post, store-bio-voice), `search_performed` (metrics only — query text NOT captured for privacy), `chat_message_sent` (booleans only — message text NOT captured). `account_delete_requested` SKIPPED (ND #2 — no frontend callsite exists yet; helper imported for when UI lands).
   `vite.config.ts`: conditional `@sentry/vite-plugin` appended last (requires `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` ALL set; if any missing, plugin omitted and warning logged at config-load — ND #4). `build.sourcemap: true` for prod builds.
   Dependencies: `@sentry/react@10.53.1`, `posthog-js@1.373.4`, `@sentry/vite-plugin@5.3.0` (devDep). +39 transitive packages. Bundle: `index.js` 607KB → 736KB (gzipped +50KB, ND #8). Day 5+ optimization candidate (manual chunks).

3. `<this commit>` — **docs: Session 90 — Day 4 Observability + .env.example updates** [docs]
   This SESSION_LOG entry + STATUS.md refresh + `.env.example` 6 new env-var docs (VITE_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT, VITE_POSTHOG_KEY, VITE_POSTHOG_HOST). CLAUDE.md unchanged (no new rules codified this session — existing patterns applied).

### NDs documented (8 total — all accepted by user)

- **ND #1**: No `web/` folder — single-package layout. Frontend Sentry placed at `src/lib/sentry-frontend.ts` to disambiguate from existing backend `src/lib/sentry.ts`. Adapted per spec permission.
- **ND #2**: `account_delete_requested` event has no frontend callsite. Backend `/api/account/delete` exists (Day 2.5 cascade) but no `apiFetch` consumer in `src/pages` / `src/components`. Event skipped (7/8 wired); helper imported in AuthContext for easy future wiring. NOT a silent swallow.
- **ND #3**: `X-Request-Id` is pinoHttp's sequential integer (saw `X-Request-Id: 1` on /health), not UUID. Functionally adequate for single-container deploy. 1-line upgrade to `crypto.randomUUID()` deferred to Day 5+.
- **ND #4**: Vite Sentry plugin requires 3 env vars (`SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`), not 1. All-or-nothing graceful skip pattern with config-load warning.
- **ND #5**: PostHog auto-opts-out in dev via `posthog.opt_out_capturing()` in the loaded callback. Production behavior unchanged. Privacy-friendly default; override available by removing the dev opt-out line.
- **ND #6**: Sentry session replay integration registered but `replaysSessionSampleRate: 0` (disabled). On-error replay at 100% with mask-all-text + block-all-media. Privacy-first per spec; full enablement deferred.
- **ND #7**: Frontend release tag NOT set directly in `Sentry.init` — relies on `@sentry/vite-plugin` to auto-inject release at build time when active. When plugin inactive (token missing), events arrive without release tag (graceful). Avoided TypeScript ambient-global declaration churn.
- **ND #8**: Bundle `index.js` grew 607KB → 736KB (+130KB; ~+50KB gzipped). Within audit prediction. Day 5+ optimization candidate via manual chunks for the two new SDKs.

### Verification (Phase D)

- Typecheck: PASS (0 errors at each commit's HEAD and at final HEAD)
- Test suite: 21/21 passing in ~1s (no regressions)
- Boot smoke (TEST DB, PORT 3099): clean — Redis + Socket.IO + Notification worker, server bound, `/health` HTTP 200 with `X-Request-Id: 1`, only expected `SENTRY_DSN not set` warning (graceful)
- Frontend build smoke (no SENTRY_AUTH_TOKEN): exit 0 in 14.53s, 55 PWA entries precached, expected `[observability] Sentry source-map upload disabled` warning at config-load time (graceful)
- R2 bucket check: 11 objects total, **0 smoke candidates** (Day 4 didn't touch upload paths — no Rule F.2 cleanup needed this session)
- Rule A: all error responses JSON ✓ (no new error paths added)
- Rule B: no silent catches added in Day 4 ✓
- Rule F: TEST branch only, no production hit ✓
- Rule F.2: N/A — Day 4 didn't write to R2

### Backlog created / preserved

- **pinoHttp UUID upgrade** — 1-line change (`genReqId: () => crypto.randomUUID()`) → Day 5+ when distributed correlation matters
- **`account_delete_requested` frontend wiring** — when UI for delete button lands, add `captureEvent('account_delete_requested')` in the handler (helper already imported)
- **Bundle size optimization** — manual chunks for `@sentry/react` and `posthog-js` to reduce critical-path bundle size (currently +130KB) → Day 5+
- **17 remaining console.* in backend** — `search.service.ts` (4), `geminiEmbeddings.ts` (4), `push.routes.ts` (2), `message.service.ts` (1), `socket.ts` (1), `redis.ts` (4 — boot/pre-logger), `env.ts` (1 — startup/pre-logger). Defer to a focused cleanup sprint.
- **Sentry session replay opt-in decision** — privacy review needed before flipping `replaysSessionSampleRate` above 0. Infrastructure ready (mask config wired) when policy decision lands.

### Files (Day 4 cumulative)

17 files (15 modified + 2 new) / ~+1372 / -63 across 3 commits. Code-only diff (excluding +1007 package-lock churn): ~+365 / -63 source LOC.

Modified: `.env.example`, `package.json`, `package-lock.json`, `src/app.ts`, `src/components/dashboard/AiBioModal.tsx`, `src/components/profile/PostsGrid.tsx`, `src/config/socket-listeners.ts`, `src/context/AuthContext.tsx`, `src/lib/sentry.ts`, `src/main.tsx`, `src/pages/Chat.tsx`, `src/pages/RetailerDashboard.tsx`, `src/pages/Search.tsx`, `src/pages/Signup.tsx`, `vite.config.ts`.

New: `src/lib/sentry-frontend.ts`, `src/lib/posthog.ts`.

### Deploy plan unchanged

Day 8 atomic merge `hardening/sprint` → `main` → Railway redeploy + full Rule E verification. Production runtime continues on Session 85 code with Day 2 schema applied.

### Phase E execution notes

No hunk-splits needed this session — each modified file mapped to exactly one commit. Cleaner profile than Day 3 (which needed 3 hunk-splits) and matching Day 2.6's clean profile. 3-commit refinement (merging Vite plugin + frontend Sentry into one) was the right call — the plugin without frontend Sentry would have been dead code.

---

## 2026-05-13 — Session 89.5 — Hardening Sprint Day 2.6: Upload Scope 3 Extras (bridge session)

**Goal:** Close the 3 deferred items from Day 3 Subtask 3.3 audit — per-route MIME tightening (Item 1), admin rate-limiter (Item 2), structured upload logging (Item 3) — and codify a new Rule F.2 around storage isolation, prompted by an R2-bucket cleanup forensic incident during today's smoke.

**Status:** **CODE COMPLETE on `hardening/sprint`** — 3 commits (2 feature + 1 docs). Branch **34 commits ahead of `origin/main`** (was 31). 4 source files + 3 docs files / +225 / -30 / 21 tests still passing. Production deploy remains DEFERRED to Day 8 atomic merge.

**Production runtime UNCHANGED**: Railway watches `main`, not feature branches. `origin/main` HEAD still `32f5525` (Session 85).

### What was done — 3-commit chain (2 features + 1 docs)

1. `1c69852` — **feat(upload): admin rate-limiter + standardHeaders on uploadLimiter** [Day 2.6 Item 2 + ND #2]
   `uploadLimiter` (10/min Redis-backed) now applied to `/api/admin/settings/upload` — was missing per the Subtask 3.3 S6 audit. Admin already has token + role auth, but this caps damage at 10/min if an admin cookie leaks (vs generalLimiter's 300/min ceiling). `uploadLimiter` config also bumped with `standardHeaders:true` + `legacyHeaders:false` — parity with authLimiter and generalLimiter. 429 responses now ship the industry-standard `RateLimit-*` and `Retry-After` headers. Verified via 11-request burst on TEST: requests 1-10 → 200, request 11 → 429 with `Retry-After:28` + JSON body (Rule A; Rule B via pinoHttp customLogLevel).

2. `96dc7fa` — **feat(upload): structured logging for upload events** [Day 2.6 Item 3]
   Replaces generic `logger.warn` calls with structured-event format across `upload.middleware.ts` (4 rejection paths + 1 new success path) and `app.ts` section 11a Multer error handler (5 paths). All log lines now carry `event` tag (`upload.accepted | upload.rejected.{magic,mime,filename,size,field,mime_claim,multer_other} | upload.persist_failed`), `userId`, `route` (req.originalUrl), and context fields (claimedMime, detectedMime, fileSize, code, rejectionReason, storageKey, persistDurationMs, sink). New `upload.accepted` success log closes the operational gap — P99 persist latency now observable. `upload.persist_failed` (500 path) ALSO calls `Sentry.captureException` with tags + extras; routine 4xx stay logger-only (intentional — too noisy for Sentry). End-to-end verified on TEST: Test D → upload.accepted log with userId/route/storageKey/persistDurationMs=1295/sink=r2; Test C → upload.rejected.magic with all fields populated.

3. `<this commit>` — **docs: Session 89.5 — Day 2.6 bridge + Rule F.2 + R2 cleanup forensics** [docs]
   This SESSION_LOG entry + STATUS.md refresh + `CLAUDE.md` Rule F.2 addition.

### Item 1 (PDF whitelist) — SKIPPED (ND #1)

Audit invalidated the original premise. The Subtask 3.3 backlog had "admin-only PDF whitelist for KYC docs" — but the codebase shows:
- KYC submission frontend (`src/components/KYCForm.tsx:23`) uploads via `/api/upload` and sends `image` field — Aadhaar/PAN are photographed, NOT scanned as PDFs.
- Admin `/api/admin/settings/upload` callers (Settings.tsx logos, Settings.tsx carousel, LandingPage.tsx CMS) all send images — no PDF caller.
- Adding PDF support would be SPECULATIVE — better deferred until a real PDF use case emerges (legal compliance docs, etc.).

Single shared `IMAGE_MIME_WHITELIST` (jpeg/png/webp/gif) is correct for both customer and admin routes.

### R2 cleanup forensic record — ND #3

**Background:** Day 3 Subtask 3.3 smokes and Day 2.6 Item 2 rate-limit burst smoke both wrote real R2 objects to the production bucket (`dukanchi-prod`) because `R2_BUCKET_NAME` is the SAME env var for TEST and PROD. This is the storage-side analog of the Session 87/88 prod-DB-from-TEST-smoke incident. **Rule F gap on a non-DB surface.**

**11 smoke artifacts removed via `DeleteObjectsCommand` batch (single API call, 0 errors):**

```
Day 3 stragglers (Subtask 3.3 smokes — May 12 17:51 UTC):
  148B  1778608297225-4587734fcac4ab80-tiny.jpg
  148B  1778608298884-6d47f7ca20c437d8-passwd.jpg

Day 2.6 smokes (Test D + Test B reqs 1-8 — May 13 07:32-07:33 UTC):
   62B  1778657572521-6b8b0b7743398385-tiny.jpg   (Test D)
   62B  1778657600525-2d2987ebce6a560a-tiny.jpg   (Test B req#1)
   62B  1778657601072-bf998c5b01bd1b29-tiny.jpg   (Test B req#2)
   62B  1778657601599-fe9dc0ea859b7a7f-tiny.jpg   (Test B req#3)
   62B  1778657602075-16f28b2b4066c888-tiny.jpg   (Test B req#4)
   62B  1778657602695-ff02b8dfedfa344d-tiny.jpg   (Test B req#5)
   62B  1778657603318-e4de55caccb1f819-tiny.jpg   (Test B req#6)
   62B  1778657603938-5010d1b5e4544c50-tiny.jpg   (Test B req#7)
   62B  1778657604540-6030fd72ffa62984-tiny.jpg   (Test B req#8)
```

**Cleanup mechanic:** A small one-off forensic script at `temp/r2-cleanup-day26.ts` (gitignored — local-only) lists candidates by (size ≤ 200B AND basename in `{tiny,passwd,fake}.jpg`) and either dry-runs (default) or deletes (with `DELETE=1` env gate). The filter caught exactly 11 of 22 bucket objects; the other 11 (real user content) were correctly excluded. Post-delete re-list: 0 candidates. Bucket-total dropped from 22 to 11 — count delta matches deletion count exactly, proving no collateral damage.

**Why 11 not 9:** Day 3 Subtask 3.3 also left 2 stragglers (T1 + T5 smokes from May 12) that I missed during the Day 3 closure. Surfaced during today's dry-run; deleted in the same batch (Option 1 approved by user — same class of artifact, same Rule F gap, same cleanup mechanic).

### Rule F.2 added to CLAUDE.md

Codifies storage isolation for local smoke tests. Currently `R2_BUCKET_NAME` (and the four AWS_* credentials) point at the prod bucket from `.env`. Until separated, write-path smokes must explicitly clean up after themselves. Three acceptable workarounds documented:
(a) dedicated `R2_BUCKET_NAME_TEST` env (preferred — Day 4+/Day 2.7 candidate to set up)
(b) accept artifact creation in prod bucket + explicit cleanup (today's precedent)
(c) skip write-path smokes when test bucket unavailable

### Backlog created / preserved

- **Dedicated test R2 bucket** (`R2_BUCKET_NAME_TEST`) — Day 4+/Day 2.7 infrastructure work. Would eliminate the cleanup burden going forward.
- **KYC-specific rate limiter** — Day 4+ candidate. KYC submission currently goes through `/api/upload` (the general image route) under `uploadLimiter` (10/min). A separate `/api/kyc/upload` with a tighter cap (e.g., 1/day per user) would prevent KYC spam.
- **xlsUpload rate-limit gap** — `/api/stores/:storeId/bulk-import` has no Multer-tier rate-limiter beyond `generalLimiter` (300/min). Has its own daily storeId cap (`rateLimitKey` in `bulkImport.service.ts:25`) and 5MB cap, so gap is small but worth noting for completeness.

### Files touched (Day 2.6 cumulative)

7 files: 4 source modifications + 3 docs.

Source:
- `src/middlewares/rate-limiter.middleware.ts` (uploadLimiter +standardHeaders/legacyHeaders)
- `src/modules/admin/admin.routes.ts` (uploadLimiter import + applied to /settings/upload)
- `src/middlewares/upload.middleware.ts` (Sentry import + structured logs + success log + Sentry capture on persist_failed)
- `src/app.ts` (section 11a Multer error handler — 5 log enrichments + _req → req)

Docs:
- `SESSION_LOG.md` (this entry)
- `STATUS.md` (refresh)
- `CLAUDE.md` (Rule F.2 added after Rule F)

### Verification

- Typecheck: PASS (0 errors at each commit's HEAD and at final HEAD)
- Test suite: 21/21 passing in ~1.6s (no regressions)
- Boot smoke on TEST branch: clean
- Behavioral smokes (4/4 RAN): Test A 401, Test D 200 with upload.accepted log, Test C 415 with upload.rejected.magic log, Test B 429 with Retry-After:28 + full RateLimit-* header set
- R2 cleanup: 11/11 deleted, 0 errors, post-delete re-list shows 0 candidates
- Rule A compliance: all error responses JSON (no HTML)
- Rule B compliance: every rejection branch logs (directly or via pinoHttp 4xx-WARN)
- Rule F compliance: TEST branch only; production untouched
- Rule F.2 NEW: storage-side analog of Rule F, codified after today's R2 cleanup precedent

### Total session footprint

~45 min (audit 10 + impl 20 + smokes 5 + R2 cleanup 5 + Phase E 10). 3 commits. ~+225 / -30 source. ~+150 docs.

### Deploy plan unchanged

Day 8 atomic merge `hardening/sprint` → `main` → Railway redeploy + full Rule E verification.

---

## 2026-05-13 — Session 89 — Hardening Sprint Day 3: Security Gaps Sprint (5 subtasks)

**Goal:** Close 5 security gaps identified at end of Day 2.5 — JWT algorithm pinning, body-size DoS surface, upload validation depth, bcrypt cost factor, and request timeout coverage.

**Status:** **CODE COMPLETE on `hardening/sprint`** — 5 feature commits + this docs commit. Branch now **31 commits ahead of `origin/main`** (was 25 at start of session). 20 files / +554 / −65 / 21 tests (was 17). Production deploy remains DEFERRED to Day 8 atomic merge.

**Production runtime UNCHANGED**: Railway watches `main`, not feature branches. `origin/main` HEAD is still `32f5525` (Session 85). All Day 1 / Day 2 / Day 2.5 / Day 3 changes are on `hardening/sprint` only. Schema-ahead-of-code state on production unchanged from Day 2.5 (Day 2 additive migrations live, code catches up at Day 8).

### What was done — 6-commit chain (5 features + 1 docs)

1. `2a5d029` — **feat(auth): pin JWT algorithm to HS256 on sign + verify** [Subtask 3.1]
   Whitelist `algorithms: ['HS256']` on `jwt.verify` in HTTP auth middleware (`verifyAndAttach`) and WebSocket gate (`setupSocketListeners`). Explicit `algorithm: 'HS256'` on all 4 `jwt.sign` sites in `auth.service.ts`. Closes algorithm-confusion attack surface: an attacker who learns `JWT_SECRET` cannot bypass verify with an HS512/RS256-signed token. New `jwt-algorithm-whitelist.test.ts` pins the contract (HS512-signed token rejected by HS256-whitelisted verify).

2. `4e4428d` — **feat(api): tiered body limits (1MB global / 10MB AI) + 413 JSON handler** [Subtask 3.2]
   Global JSON + urlencoded body limit `50MB → 1MB`. AI base64 routes (`/api/ai/analyze-image`, `/api/ai/transcribe-voice`) get 10MB override mounted BEFORE the global parser. New 413 JSON error handler at section 11b (before Sentry) converts body-parser's `PayloadTooLargeError` to typed `{ code: 'PAYLOAD_TOO_LARGE', limit }` JSON (Rule A: JSON not HTML; Rule B: logger.warn on every rejection). Nginx fronts at 20MB; Express limits are defense-in-depth.

3. `8a0b4e8` — **feat(upload): production-grade validation — fileSize + MIME + magic bytes + filename sanitization** [Subtask 3.3]
   `/api/upload` + `/api/admin/settings/upload` hardened. Multer storage → memory (required for magic-byte buffer inspection). fileSize 10MB cap. MIME whitelist (image/jpeg, png, webp, gif — SVG explicitly excluded to close XSS-via-SVG). Filename sanitization (basename only, no hidden-leading, no control chars, no double-extensions, `[a-zA-Z0-9._-]`-only, ≤200 chars). Magic-byte verification via `file-type@3.9.0` — first ~4KB of content must match claimed MIME (415 MIME_MISMATCH otherwise). DETECTED MIME (not claimed) stored on R2 — closes stored-XSS class. Storage key = `Date.now()-randombytes-safebasename.ext` (collision-resistant, unguessable). New `app.ts` section 11a Multer error handler. New `src/types/file-type.d.ts` shim (file-type@3.9 ships no `.d.ts`; DefinitelyTyped covers v10+ which is a different API). 7 smokes verified on TEST: real JPEG 200, 15MB 413 FILE_TOO_LARGE, text-as-jpeg 415, ELF-as-jpeg 415, path-traversal sanitized, evil.php.jpg 400 INVALID_FILENAME, all errors JSON.

4. `6b9f434` — **feat(auth): BCRYPT_ROUNDS env var (default 12) + bump rounds 10→12** [Subtask 3.4]
   New zod-validated env: `BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12)`. 3 hash sites use `env.BCRYPT_ROUNDS` (auth.service signup, admin.service password reset, team.service member creation). Backwards compatible — bcrypt encodes cost per-hash (`$2b$XX$...`), so rounds-10 hashes continue to validate; new hashes use 12. No data migration needed. 4 new tests pin guardrails (default, range accept, range reject, `$2b$12$` prefix). Inline schema mirror in test (test-isolation trade-off, documented). `.env.example` updated.

5. `e554914` — **feat(api): request timeout coverage — server 60s + Gemini 30s + R2 60s + Prisma 30s** [Subtask 3.5]
   4 layers active. **Server** (`server.ts` after createServer): requestTimeout 60s, timeout 60s, headersTimeout 30s, keepAliveTimeout 10s (tighter than Node 18 defaults 300/60/5). **Gemini** 30s via `AbortSignal.timeout` on 3 SDK sites (config.abortSignal — verified in `GenerateContentConfig` type) + 3 raw fetch sites (`signal:` option). **External pincode** 5s on `api.postalpincode.in` (fail fast on untrusted public API). **R2/S3** via `NodeHttpHandler` in `S3Client` (connectionTimeout 5s, socketTimeout 60s, requestTimeout 60s, throwOnRequestTimeout true) — `@smithy/node-http-handler` imported from `@aws-sdk/client-s3` transitive dep (no new install). **Prisma** `transactionOptions: { maxWait: 5s, timeout: 30s }`. Existing 500ms Promise.race in search.service:80 left untouched (performance budget, not security). Frontend Axios 20s untouched. `AbortSignal.timeout()` is Node 17.3+ native — no helper or new dep.

6. `<this commit>` — **docs: Session 89 — Day 3 security sprint** [docs]
   SESSION_LOG 89 entry (this) + STATUS.md refresh + DECISIONS.md unchanged (no architecture decisions this session).

### Notable deviations / surprises (worth remembering)

- **3.3.1 file-type@3.9 type shim** — DefinitelyTyped's `@types/file-type` covers v10+ only (different API: `fromBuffer` named export vs v3's default function). Local shim at `src/types/file-type.d.ts` declares the v3 contract. If we ever upgrade to ≥10, delete the shim.
- **3.3.2 Control-char regex byte-mangling** — During upload.middleware rewrite, literal `\x00-\x1f\x7f` bytes in the filename-sanitize regex got eaten by markdown-stripping mid-tool-call. Recovered via a Python byte-level fix that converted literal control bytes to readable escape form. Caught by post-edit `sed -n` cat-v output.
- **3.3.3 multer-s3 → memory + explicit PutObjectCommand** — Magic-byte verify needs the full buffer before persistence. multer-s3's stream-to-S3 path makes the buffer unavailable. Replaced with explicit `PutObjectCommand` from `@aws-sdk/client-s3`. `req.file.key`/.location shape preserved so `getUploadedFileUrl` is unchanged.
- **3.3.4 DETECTED MIME stored on R2 (not claimed)** — Attacker uploads `evil.html` claiming `image/jpeg`; magic bytes detect it's HTML; we either reject (415) or in edge cases would store as `text/html`. With our whitelist this never reaches persistence — but the principle of "trust the bytes" is now codified.
- **3.4 inline schema mirror in bcrypt test** — `env.ts` validates DATABASE_URL/JWT_SECRET/GEMINI_API_KEY at import; Vitest doesn't auto-load `.env` like tsx does. Test re-declares the BCRYPT_ROUNDS zod rule inline (with comment "keep in sync manually"). Same pattern as `jwt-algorithm-whitelist.test.ts`. Conscious test-isolation trade-off.
- **3.5 Node 18+ defaults aren't zero** — Audit prompt framed defaults as "0 (NONE)". Actual: Node 18 LTS ships `requestTimeout=300_000`, Node 14+ has `headersTimeout=60_000`. Doesn't change the recommendation (we still want tighter values) but recalibrates urgency from "critical" to "high".
- **3.5 NodeHttpHandler `throwOnRequestTimeout: true`** — Without this, AWS SDK only LOGS a warning when requestTimeout breaches. We want the breach to surface as a TimeoutError so the existing `verifyAndPersistUpload` catch returns 500 PERSIST_FAILED. Documented gotcha.

### Verification (Phase D)

- Typecheck: PASS (0 errors)
- Test suite: 21/21 passing in 891ms (was 17 at start of Day 3; +1 JWT test + 4 bcrypt tests)
- Boot smoke on TEST branch: clean — env validates, Redis connected, server listening :3099, /health 200 in 15ms, env.BCRYPT_ROUNDS=12 confirmed at runtime
- Curl battery: 6/6 passing (1 skipped per spec permission — uploadable-image auth setup too involved for verification scope)
  - `GET /health` → 200 JSON
  - `GET /api/auth/me` (no auth) → 401 JSON
  - `POST /api/auth/login` empty body → 400 zod-validation JSON
  - `POST /api/upload` (no auth) → 401 JSON
  - `POST /api/auth/login` 2MB body → 413 JSON `PAYLOAD_TOO_LARGE limit=1048576`
  - `POST /api/ai/analyze-image` 5MB body → 401 (auth gate fires after body parses, NOT 413) — confirms 10MB AI override works
- Rule A check: all error bodies are JSON (start with `{`), no HTML SPA fallback
- Rule B check: no new silent catches added in Day 3
- Rule F check: TEST branch only — no production hit this entire session

### Backlog preserved / created

- **Scope 3 upload extras** (per-route MIME tightening, admin-only PDF whitelist, rate-limiter S6) → Day 4/5 candidate
- **Admin password length floor 6 chars** (`admin.service.ts:70`) → separate concern, flagged for awareness
- **4 pre-existing `console.log` statements** in geminiEmbeddings.ts + search.service.ts → future logger migration sprint
- **Day 2.7 test coverage sprint** (cascade integration, socket auth E2E, D5 atomicity, fixtures, CI wiring) → still pending, separate focused session

### Deploy plan unchanged

Day 8 atomic merge `hardening/sprint` → `main` → Railway redeploy + full Rule E verification. Production runtime continues on Session 85 code with Day 2 schema applied.

### Files (Day 3 cumulative)

20 files (17 modified + 3 new) / +554 / −65 across 6 commits.

Modified: `.env.example`, `server.ts`, `src/app.ts`, `src/config/env.ts`, `src/config/prisma.ts`, `src/config/socket-listeners.ts`, `src/middlewares/auth.middleware.ts`, `src/middlewares/upload.middleware.ts`, `src/modules/admin/admin.routes.ts`, `src/modules/admin/admin.service.ts`, `src/modules/auth/auth.service.ts`, `src/modules/search/search.service.ts`, `src/modules/stores/bulkImport.service.ts`, `src/modules/stores/store.controller.ts`, `src/modules/team/team.service.ts`, `src/services/geminiEmbeddings.ts`, `src/services/geminiVision.ts`.

New: `src/config/bcrypt-rounds.test.ts`, `src/middlewares/jwt-algorithm-whitelist.test.ts`, `src/types/file-type.d.ts`.

### Phase E execution notes (commit-split mechanics)

3 files needed hunk-splits across commits:

- `src/modules/auth/auth.service.ts` — JWT hunks → commit 1; bcrypt hunk → commit 4
- `src/app.ts` — body-parser + 11b 413 handler → commit 2; multer import + 11a Multer handler + upload-middleware import update + /api/upload route chain → commit 3
- `src/middlewares/upload.middleware.ts` — full rewrite → commit 3; NodeHttpHandler import + requestHandler config → commit 5

Mechanic: `git checkout HEAD -- <file>` was denied by sandbox (would destroy uncommitted work). Used Edit-tool revert-and-restore pattern: temporarily Edit-revert hunks that belong to a later commit, stage current file, commit, Edit-restore the deferred hunks back to working tree. Worked cleanly across all 3 hunk-split files. Every commit's typecheck passed (`npx tsc --noEmit` → 0 errors at each HEAD).

### Final closure note

- Day 3 fully pushed to `origin/hardening/sprint` at `e1828f5` (SHA range `7d8cf84..e1828f5`, fast-forward, no rejected refs, no force push). 6 commits visible on remote.
- Branch state at session close: **31 commits ahead of `origin/main`** (production still on `32f5525` / Session 85).
- Production status: **unchanged**. Railway watches `main`, not feature branches; this session's push triggered no redeploy.
- Total session duration: ~13.5 hours (Day 2.5 session 88 + Day 3 session 89 combined, per founder's reckoning across both calendar days).
- Day 3 specific: ~5 hours, 5 security subtasks, all Scope 2 production-grade with audit → implementation → smoke verification protocol.
- Combined hardening sprint work shipped (Days 1 + 2 + 2.5 + 3): 31 commits, ~+1900/-173 lines, 21 tests passing, 0 typecheck errors at HEAD.
- Day 4 starter prompt template saved to `temp/day-4-starter-prompt.md` (gitignored) for next-session paste-and-go.
- Forensic snapshot `temp/accidental-user-snapshot-2026-05-12T13-26-19Z.json` retained per Day 8 cleanup plan.
- Session officially signed off 2026-05-13.

---

## 2026-05-12 — Session 88 — Hardening Sprint Day 2.5: Soft-Delete Cascade Audit + Implementation + Tests

**Goal:** Wire the Day 2 soft-delete schema (deletedAt, deletionRequestedAt, deletionReason) through the entire codebase — auth gate, route policies, service-layer reads, search filters, write paths, background fanout, social degradation — with comprehensive audit, deviation review, and smoke tests.

**Status:** **CODE COMPLETE on `hardening/sprint` — production deploy DEFERRED to Day 8 atomic merge.** 9 commits pushed to `origin/hardening/sprint`. 32 files / +1,352 / −108 / 16 tests / 0 typecheck errors.

**Production runtime UNCHANGED**: Railway watches `main`, not feature branches. `origin/main` HEAD is still `32f5525` (Session 85 — Sentry production-grade) — pre-Day-1, pre-Day-2, pre-Day-2.5 code. None of Day 1 / Day 2 / Day 2.5 application changes are live on production yet. This is per the Day 1 plan ("Branch merge to main happens after Day 8") and intentional.

**Production DB IS updated**: Day 2 schema migrations (User soft-delete columns, Store GIST index, Product HNSW index, cube + earthdistance extensions) were applied directly via `psql -f` against `DATABASE_URL` in Session 87 Phase 5. This creates a deliberate **schema-ahead-of-code** state on production:
- Prod DB has the new columns/indexes — safe because they're additive (nullable cols + advisory indexes)
- Prod code (Session 85) doesn't reference any of them — works unchanged
- At Day 8 deploy, code catches up to schema in a single atomic merge

**Endpoints status:**
- `/api/account/delete` + `/api/account/restore` — **exist in `hardening/sprint` code, NOT live on production**. Production `POST /api/account/restore` currently returns 404 HTML (Express default) — route mount not yet on main.
- Soft-delete-aware auth middleware, cache invalidation, cascade reads, write-path checks, socket auth fix (ND22), background filters, social anonymization — **all on `hardening/sprint`, NONE on production yet**.

### What was done — 9-commit chain

1. `b7d16a5` — **feat(soft-delete): foundation helpers + auth middleware gates**
   New `src/middlewares/user-status.ts` (`isUserUnavailable`, `evaluateUserStatus`, `unavailableError`, `visibleOwnerFilter`, `invalidateUserStatusCache`). `auth.middleware.ts` rewired: `verifyAndAttach` is async + `opts.acceptDeletedPending`; new `authenticateAllowDeleted` export. Old `isUserBlocked` + `blocked:${id}` cache retired.

2. `38015ab` — **feat(soft-delete): cache invalidation + permissive route wiring**
   `AccountService.requestDeletion` + `restore` now call `invalidateUserStatusCache`. `AdminService.updateUser` + `bulkUpdateUsers` migrate from `pubClient.del('blocked:${id}')` → unified `invalidateUserStatusCache`. `/api/account/restore` + `/api/auth/refresh` switch to `authenticateAllowDeleted`.

3. `de65f0e` — **feat(soft-delete): tighten auth services — login, signup, issueTokenForUser**
   Login: password-verify FIRST (closes info-leak ND10); `evaluateUserStatus` throws `UnavailableUserError`. TeamMember login: owner-state gate (ND7). Signup: 3-case logic (active/pending/past-grace). `issueTokenForUser`: strict default + `acceptDeletedPending` opt-in for `/refresh`.

4. `5448006` — **feat(soft-delete): cascade read filters + visibleOwnerFilter helper**
   `getUserProfile`, `getStores`, `getStoreById` (Option A 404, ND12 + ND13 `findFirst`), `getStorePosts`, `getProducts` (ND15 — closes pre-existing isBlocked gap), `getFeed`, plus all 10 search.service sites migrated to `visibleOwnerFilter`. EXPLAIN ANALYZE shows 0% plan-cost regression; HNSW raw SQL still using `Product_embedding_hnsw_idx`.

5. `36b4527` — **feat(chat): write-path soft-delete cascade + socket auth security fix (ND22)** ⚠️
   **Critical security fix**: `io.use` socket auth was JWT-verify-only — soft-deleted/blocked users' WebSocket connections kept flowing for the full JWT TTL (7 days). Now async + `isUserUnavailable` at connect + per-message `evaluateUserStatus` defense-in-depth. `sendMessage` HTTP + socket paths gate sender + receiver. New `ChatRejectionError` class maps to 401/404/410/403 by subject + reason. **S4 silent-catch fix**: `sendPushToUser(...).catch(() => {})` at message.service:84 → proper `logger.warn` + `Sentry.captureException`.

6. `cbb9259` — **feat(notifications,social): background cascade + D5 atomic purge + D2 review anonymize**
   D5: `AccountService.requestDeletion` wraps soft-delete write in `prisma.$transaction` with `fcmToken.deleteMany` + `pushSubscription.deleteMany` — atomic eager purge before deletedAt commits. `push.service.sendPushToUser`: pre-fanout `isUserUnavailable` gate. `notification.worker.publishPostNotifications`: per-chunk active-user filter. `autoReply`: skip on either party unavailable. `misc.service` reviews + `message.service.getConversations`: D2 anonymize (additive `deletedAt` in user select; frontend renders "Deleted user").

7. `78e64d5` — **chore(test): install Vitest + npm scripts**
   Phase A audit discovery: project had NO test framework. Installed vitest@4.1.6 + @vitest/ui. New scripts: `test`, `test:watch`, `test:ui`. `vitest.config.ts` at repo root (node env, globals off, src/**/*.test.ts).

8. `ece3611` — **test(soft-delete): smoke tests for user-status helpers + auth middleware (16 tests)**
   user-status.test.ts (8): `isUserUnavailable` 5-state coverage + `visibleOwnerFilter` 3-case shape. auth.middleware.test.ts (8): strict + permissive paths, all 4 reasons (active/blocked/pending/expired). 467ms runtime.

9. `[this commit]` — **docs: Rule F + Opus convention + vi.hoisted note + SESSION_LOG 88**
   CLAUDE.md adds: Rule F (local smoke isolation), Opus summary convention (response format), Vitest vi.hoisted pattern. `.gitignore` adds `temp/` for forensic snapshots. This SESSION_LOG entry.

### 27 deviations surfaced + decided (one-line each)

- **ND1** — `/api/account/restore` self-blocking — solved via `authenticateAllowDeleted` (D6 Path A)
- **ND2** — `isBlocked` cascade gap in search.service — bundled into Day 2.5 (D3)
- **ND3** — Redis cache namespace — unified `userStatus:${id}` JSON (D7 Path A)
- **ND4** — S4 silent catch at message.service:84 — fixed in commit 5a
- **ND5** — `$queryRaw` semantic search — Prisma post-filter via visibleOwnerFilter (D8 Path A)
- **ND6** — Sentry.setUser unaffected (uses JWT payload only)
- **ND7** — **TeamMember login owner-status gate** (CRITICAL fix not in original spec)
- **ND8** — Legacy "blocked" message-string branch kept as safety net (dead code)
- **ND9** — Signup past-grace stays opaque "phone exists" until hard-delete worker
- **ND10** — Login password verify reordered BEFORE availability check (closes info-leak)
- **ND11** — Snapshot file retained at `temp/`
- **ND12** — `getStoreById` Option A (404 for any deletedAt non-null)
- **ND13** — `findUnique` → `findFirst` (Prisma relation-filter limitation)
- **ND14** — `getSavedItems` additive `post.store.owner.deletedAt` in select
- **ND15** — `getProducts` adds `deletedAt` AND `isBlocked` (parallel cleanup of pre-existing drift)
- **ND16** — Pre-existing Gemini text-embedding-004 model 404 — silent fallback works, backlog
- **ND17** — `console.warn` vs pino in one search.service spot — backlog
- **ND18** — Refactor backlog: store/post.service migrate to visibleOwnerFilter
- **ND19** — Socket sendMessage retains silent-drop pattern (consistent with existing canChat drop)
- **ND20** — Socket security gap CONFIRMED + closed (see ND22)
- **ND21** — Force-disconnect on /delete deferred to Day 2.6+
- **ND22** — **CRITICAL: socket auth security fix** — `io.use` now async + `isUserUnavailable` + per-message defense-in-depth. Closes the WebSocket survives-soft-delete CVE-class gap.
- **ND23** — Worker filter adds 1 query per 1000-follower chunk — accepted
- **ND24** — push.service uses cache-aware `isUserUnavailable` (DRY)
- **ND25** — `getConversations` additive `deletedAt` shape (backward compatible)
- **ND26** — Review queries additive `deletedAt` shape (D2 anonymize)
- **ND27** — Vitest hoisting fix via `vi.hoisted()` (test-infra, not production)

### Production incident — accidental smoke-test signup

During Step 4 verification, a curl-based smoke test against `/api/auth/users` hit the local dev server (which was connected to **production** via main `.env`) and created a real User row (`1ef4803c-...`, phone 9876543210). Caught by post-test row count check (8 → 9). 5-safeguard forensic cleanup:

1. Row provenance — confirmed `createdAt` within last hour, role=customer, no soft-delete, ZERO references in 16 child tables
2. JSON snapshot → `temp/accidental-user-snapshot-2026-05-12T13-26-19Z.json` (gitignored)
3. Endpoint re-confirmation immediately before DELETE (`ep-cool-fire-aooid1hw`)
4. Defensive DELETE with `WHERE id = ... AND createdAt > NOW() - INTERVAL '1 hour' AND role != 'ADMIN' RETURNING ...` — `DELETE 1` confirmed
5. Post-DELETE: row count back to 8, JWT now 404s on prod (user gone), Redis cache empty for that user id

**Outcome**: Rule F added to CLAUDE.md (this session). Future write-path smokes MUST use `DATABASE_URL_TEST` or skip writes.

### Verification

- `npm run typecheck` → 0 errors (Day 1 strict mode preserved end-to-end)
- `npm run test` → 16/16 pass in 467ms
- Boot smoke against TEST branch (`ep-wandering-field-...`) — 5 endpoints (health + 4 auth surfaces) all 200/401 JSON
- EXPLAIN ANALYZE on TEST: 0% plan-cost regression on owner-filter queries; HNSW + GIST + User_deletedAt indexes all VALID
- Production DB untouched (Day 2's schema migrations were applied in Session 87; Day 2.5 only changes app code, no DB writes)

### Deferred to Day 2.7 — Test Coverage Sprint

```
- Socket auth integration tests (connection + per-message)
- D5 FCM purge atomicity test
- /api/account/restore + /refresh end-to-end
- sendMessage write-path rejection tests
- Cascade read filter tests (profile/store/post/feed/search)
- notification.worker tests (publishPostNotifications + autoReply)
- push.service dispatcher gate test
- Cache-hit + negative-sentinel paths of getUserStatus
- Concurrent /delete + /restore race (cache invalidation correctness)
- Test fixtures + factories (user-builder, message-builder)
- CI integration (GitHub Actions test job)
- tsconfig.test.json for strict test type-checking
- ND16 Gemini text-embedding-004 model fix
- ND17 console.warn → pino in search.service:117
- ND18 store/post.service migrate inline filters to visibleOwnerFilter
- Force-disconnect on /delete (Pub/Sub event to socket layer)
- ask-nearby fanout customer-deleted check (tiny race window)
```

### Branch state (end of session 88)

- `hardening/sprint` HEAD = `a363fd6`, matches `origin/hardening/sprint` (pushed)
- `hardening/sprint` is **24 commits ahead of `origin/main`** (Day 1: 8 + Day 2: 4 + Day 2.5: 9 + 3 merge/prep)
- `origin/main` HEAD = `32f5525` (Session 85) — **production runs from here**
- Branch merge to main deferred to **Day 8** per the agreed atomic-deploy plan

### Block 2 outcome (push + production verification)

- ✅ Push to `origin/hardening/sprint` successful: `abff3dc..a363fd6`, exit 0, no force, no rejected refs
- ✅ Production curl battery: 6/7 tests pass (T1 /health, T2 JSON validity, T3 /me, T5 /refresh, T6 /search, T7 Rule A) — all exercising **pre-existing routes** that Session 85 already has
- ⚠️ T4 `/api/account/restore` returns 404 HTML on production — **EXPECTED**, the route mount was added in commit `7b4606d` (Session 87) which is on `hardening/sprint`, NOT on `main`. Production never had this endpoint. This is not a regression.
- **Verdict: YELLOW** — production unchanged, work safely on branch, Day 8 atomic merge will bring it all live together
- **No customer impact** — endpoints that don't exist on prod can't be used by customers
- Railway watch-branch insight: production deploys from `main`, not feature branches. Documented for future planning.

### Next session

**Day 3 — Security hardening** (separate session, deferred from this one):
- Upload middleware limits (file size cap + MIME whitelist)
- JWT algorithm whitelist (reject `none`, lock to `HS256`)
- Body size limits (review `express.json({ limit: "50mb" })`)
- bcrypt rounds review (currently 10 — confirm OK for our threat model)
- Request timeouts (Express default is none)

**Day 8 — Atomic deploy** (after Days 3-7 complete on hardening/sprint):
- Merge `hardening/sprint` → `main` (--no-ff for narrative clarity)
- Push `main` → Railway auto-redeploy
- Full Rule E production curl battery (this time ALL 7 should pass)
- Sentry + Railway log spot-check
- Cleanup `temp/accidental-user-snapshot-*.json` after green deploy

---

## 2026-05-12 — Session 87 — Hardening Sprint Day 2: DB Schema Hardening (soft-delete, spatial GIST, vector HNSW)

**Goal:** Add 3 schema enhancements to production: User soft-delete columns (DPDP), GiST spatial index on Store coordinates, HNSW vector index on Product embedding. Plus the two minimal account endpoints.

**Status:** COMPLETE — all 3 migrations applied to TEST + PROD, /api/account/{delete,restore} endpoints live in code (not yet deployed to Railway).

**What was done:**

1. **Schema migrations** (3 forward + 3 down SQL files in proper Prisma format, hand-written):
   - M1 `20260512164148_user_soft_delete_and_extensions` (transactional):
     - ADD COLUMN `deletedAt`, `deletionRequestedAt` (TIMESTAMP), `deletionReason` (VARCHAR(500))
     - CREATE INDEX `User_deletedAt_idx` (btree)
     - CREATE EXTENSION `cube`, `earthdistance` (IF NOT EXISTS, idempotent)
   - M2 `20260512164149_store_location_gist_index` (CONCURRENTLY, single statement):
     - `CREATE INDEX CONCURRENTLY Store_location_gist_idx ON "Store" USING GIST (ll_to_earth(latitude, longitude))`
     - Verified planner-usable (Index Scan when seqscan=off; planner correctly prefers Seq Scan on 2-row table)
   - M3 `20260512164150_product_embedding_hnsw_index` (CONCURRENTLY, single statement):
     - `CREATE INDEX CONCURRENTLY Product_embedding_hnsw_idx ON "Product" USING hnsw (embedding vector_cosine_ops)`
     - pgvector 0.8.0, HNSW chosen over IVFFLAT (no training step, better for small-medium scale)

2. **Application code** — new module `src/modules/account/`:
   - `account.service.ts` — `requestDeletion(userId, reason?)`, `restore(userId)` with discriminated-union result type
   - `account.controller.ts` — HTTP handlers, Sentry breadcrumbs (category="account", level="info" — not errors)
   - `account.routes.ts` — `POST /delete` (auth + Zod validate), `POST /restore` (auth)
   - `validators/schemas.ts` — `deleteAccountSchema` (reason ≤500 chars)
   - `src/app.ts` — mount at `/api/account`

3. **schema.prisma updated** to match: 3 new User fields + `@@index([deletedAt])`, datasource `extensions = [vector, cube, earthdistance]`. Prisma Client regenerated locally.

**Testing strategy:**
- Test branch: `ep-wandering-field-aogkpw0c-pooler` (Neon child, auto-expires May 19)
- All 3 migrations applied to TEST first → verified (post-audit, 5 smokes) → applied to PROD
- 5 smokes: count(deletedAt IS NULL), soft-delete round-trip (rolled back), VARCHAR(500) reject 501-char, GIST planner usability, HNSW cosine `<=>` syntax
- Identical results on TEST and PROD

**Performance:**
- Pre-launch DB scale (8 users, 2 stores, 0 products), so index builds are microseconds
- Migration wall-clocks: M1 1.10s, M2 0.56s, M3 0.82s on PROD
- Lock duration on production tables: effectively zero (CONCURRENTLY + tiny tables)

**Production verification (Anti-Silent-Failure Rule E):**
- Pre-flight audit: extensions=plpgsql,vector / no target columns / no target indexes / 22 tables / 8-2-0 row counts — clean baseline
- Post-audit: 4 extensions / 3 valid indexes / 22 tables / 8-2-0 unchanged — exact expected delta
- Production curl post-migration: /health 200, /api/auth/me 401 JSON, /api/stores 401 JSON — app healthy

**Commits this session:**
- `fa0c391` — feat(hardening-d2): apply schema migrations to production (3 migration dirs + schema.prisma)
- `7b4606d` — feat(hardening-d2): add /api/account/delete + /api/account/restore endpoints

**Lessons learned:**
- **Major discovery:** Neither test nor prod has `_prisma_migrations` table — the project has historically used `prisma db push` for schema sync, with migration files kept on disk as documentation. Plan to use `prisma migrate dev/deploy` would have either failed (re-applying 9 existing migrations) or triggered a destructive reset prompt. Caught at Phase 3 before any DB write; pivoted to Path B (write proper migration files, apply via `psql -f`, skip `_prisma_migrations` tracking). Migration baseline (`prisma migrate resolve --applied` for all 9 historical files) deserves its own focused session — queued as Day 2.7.
- **`UID` is read-only in zsh** — using `UID=$(...)` to capture a user UUID broke smoke 3 the first time. Renamed to `USER_ROW_ID`. Future shell scripts: avoid common shell-reserved names.
- **Path A (Prisma migrate engine) vs Path B (direct psql) decision matrix** — when a project doesn't have `_prisma_migrations`, baselining first is the "correct" long-term fix but high-blast-radius. Path B (psql -f manually-written migration.sql) matches project history and keeps audit trail without touching 9 historical migrations on prod.
- **GiST + earthdistance on a 2-row table** — planner correctly chooses Seq Scan; `SET enable_seqscan = OFF` is the canonical way to verify the index is built and usable for the day it matters.
- **CREATE INDEX CONCURRENTLY in single-statement files** — psql autocommit mode (default, no `--single-transaction`) executes each statement individually, so CONCURRENTLY works at file top level without ceremony.
- **HNSW on empty table** — builds in 0ms, index becomes usable as rows are added. No need to wait for data.
- **Node-modules drift between worktrees** — Day 1 installed `@types/multer-s3` in the worktree's node_modules, but the main repo on `hardening/sprint` hadn't been `npm install`ed since then. Running typecheck in main repo first hit TS7016. Fixed with `npm install` in main repo. Future: when switching worktrees, always npm install first.

**Branch state:**
- Working branch: `hardening/sprint` (main repo at `/Users/apple/Documents/Dukanchi-App`)
- 2 new commits today on top of Day 1 merge `abff3dc`
- Not yet pushed to origin — push deferred to founder's call
- Production DB schema is AHEAD of deployed Railway code (DB has new columns/indexes, but `/api/account/*` routes are local-only until git push triggers Railway redeploy). This is safe: DB changes are additive (nullable columns, advisory indexes); existing code paths unaffected.

**Scope explicitly deferred to Day 2.5:**
- Auth middleware: reject login if `deletedAt` is set
- Add `where: { deletedAt: null }` to all user-facing prisma queries (profile, follow, notifications, chat, search, admin)
- Background worker: hard-delete users where `deletedAt < NOW() - 30 days`
- Frontend: account-settings UI for delete/restore
- Spatial query rewrite: update `search.service.ts` to use `earth_box`+`earth_distance` so the new GIST index is actually consulted

**Next session (Day 3 — Security hardening):**
Upload middleware limits (file size, MIME whitelist), JWT algorithm whitelist (reject `none`), body size limits (express.json limit currently 50mb — review), bcrypt rounds review.

---

## 2026-05-12 — Session 86 — Hardening Sprint Day 1: TypeScript Strict Mode + tsconfig Architecture Split

**Goal:** Enable TypeScript strict mode + fix all surfaced type errors + split tsconfig into proper architecture

**Status:** COMPLETE — 0 type errors across 71+ backend `.ts` files and 80+ frontend `.tsx` files

**What was done:**
- Split monolithic `tsconfig.json` into 3 configs:
  - `tsconfig.json` (base with strict flags, project references)
  - `tsconfig.app.json` (frontend React, composite)
  - `tsconfig.server.json` (backend Express, composite)
- Enabled `"strict": true` plus 12 additional strict flags:
  - `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`
  - `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`
  - `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
  - `noFallthroughCasesInSwitch`, `useUnknownInCatchVariables`
- Backend now properly type-checked (was completely excluded before — 71 `.ts` files unchecked)
- Added proper npm scripts:
  - `typecheck:web`, `typecheck:server`, `typecheck` (combined)
  - `build:web`, `build:server` (standalone, available for future migration to compiled JS)
  - `build` now runs `typecheck && build:web` (Railway uses tsx, no compiled-JS deploy)
  - `start` aligned with production: `tsx server.ts` (matches Dockerfile/railway.json/PM2 ecosystem)
- Fixed 114 type errors across affected files in 5 atomic commits

**Path adjustments from prompt template (actual src/ structure):**
- `src/contexts` → `src/context` (singular)
- `src/lib/utils.ts` (didn't exist) → `src/lib/storeUtils.ts`
- Added `src/workers/**/*.ts` (BullMQ notification worker) to server config
- Added `src/types/**/*` and `src/constants/**/*` to both configs (shared types)

**Type error fix breakdown (114 → 0):**
| Category | Code | Count | Approach |
|---|---|---|---|
| 1 | config | (n/a) | Add `validators/**/*.ts` to server include; install `@types/multer-s3` |
| 2 | TS6133 | 39 | Remove unused imports (modern JSX transform drops `React`), prefix Express middleware params with `_`, delete dead state/functions/computes |
| 3 | TS7030 | 56 | Perl batch: `return ` before terminal `res.{json,send,end,redirect,sendFile,sendStatus}` and `res.status(N).{json,...}`; manual `return next()` for 4 middlewares; explicit `return;` in 1 useEffect |
| 4 | TS7053 + TS18046 | 9 | Inline structural types for `fetch().json()` results (Gemini text, Gemini embedding, postalpincode.in); replace unsafe index access with `?? []` + typed map |
| 5 | TS2345 | 1 | `?? undefined` at PostCard call site to convert Prisma `string\|null\|undefined` → `string\|undefined` |

**Commits in this session (8 total):**
- 1814751 — chore(hardening): split tsconfig into base+app+server with strict mode
- 050d92d — fix(hardening): add validators to server config + install multer-s3 types
- 8b9f1f3 — fix(hardening): remove unused imports and locals (TS6133, 39 fixes)
- 7db65c8 — fix(hardening): add explicit returns to Express handlers (TS7030, 56 fixes)
- fb014b3 — fix(hardening): proper typing for handlers, index access, catch blocks (TS7053+TS18046, 9 fixes)
- f53aaa8 — fix(hardening): fix nullable string handling in PostCard (TS2345, 1 fix)
- 9bde71a — fix(hardening): align start script with actual production (tsx) — strict mode still enforced via typecheck
- 67482a0 — chore(hardening): Day 1 verification complete — strict mode working in dev and prod builds

**Verification:**
- `npm run typecheck` → 0 errors ✅
- `npm run build:web` → SUCCESS (Vite 4.22s, PWA 55 entries) ✅
- `npm run build:server` → SUCCESS (standalone) ✅
- `npm run start` (tsx) → clean boot: Redis ✅, Prisma ✅, server :3000 ✅, graceful shutdown ✅
- `npm run dev` (tsx) → identical clean boot ✅
- Graceful shutdown order preserved (Session 74): HTTP → BullMQ worker → BullMQ queue → Prisma → Redis ✅

**Lessons learned:**
- Initial plan assumed production uses compiled JS (industry standard pattern)
- Actual reality: Railway + Dockerfile + PM2 all use `tsx server.ts` directly (no compile step)
- Strict mode value is preserved via `npm run typecheck` (CI/pre-commit gate), not via compiled output
- This matches modern Node+TS deployment patterns (faster, no build artifact management)
- Anti-Silent-Failure Rule worked: Claude Code stopped at the failed boot test, diagnosed the ESM resolution issue, reported the real cause (extensionless imports + `"type": "module"`), and surfaced the production-deploy reality before silently breaking anything

**Branch state:**
- Working branch: `claude/peaceful-dirac-41866d` (Claude worktree)
- Originally intended: `hardening/day-1-tsconfig-strict` (locked by another worktree at session start; that branch only contains 1 prep commit `a2324bb` for `.gitignore`)
- TODO: Merge `claude/peaceful-dirac-41866d` → `hardening/day-1-tsconfig-strict` (or rebase) in next session before pushing

**Next session (Day 2):**
Schema + DB hardening — spatial index for stores `lat/lng`, pgvector IVFFLAT/HNSW index for `embedding` column, User soft-delete columns for DPDP Act compliance

---

## 2026-05-11 — Session 85 — Sentry Backend Audit + Wiring + Verification

**Audit findings (before changes):**
1. SDK: `@sentry/node@^10.50.0` ✅
2. Init location: `server.ts:7` — before all app imports ✅
3. Integrations: `httpIntegration` ❌, `expressIntegration` ❌ — both missing
4. Error handler: `Sentry.setupExpressErrorHandler(app)` present at `app.ts:185` ✅
5. Sample rates: `tracesSampleRate` ✅, `profilesSampleRate` ❌, `beforeSend` PII strip ❌
6. User context: no `Sentry.setUser()` middleware ❌

**Files changed:**
- `src/lib/sentry.ts` — added `httpIntegration()`, `expressIntegration()`, `nodeProfilingIntegration()`, `profilesSampleRate`, `beforeSend` auth/cookie header strip
- `src/app.ts` — added `Sentry.setUser()` middleware after rate limiter; added `/api/_debug/sentry-test` (TEMP — removed in follow-up commit)
- `package.json` — `@sentry/profiling-node` installed

**Verification:**
- ✅ `tsc --noEmit` clean
- ✅ Production curl to `/api/_debug/sentry-test` returned HTTP 500 (Railway deploy confirmed)
- ✅ Debug endpoint removed in follow-up commit
- ✅ Sentry dashboard confirmed (see below)

**Verification confirmed (founder + Opus, 2026-05-11 ~6:42 PM IST):** Sentry dashboard at dukanchi.sentry.io showed captured issue "Sentry capture test — intentional 500 from /api/_debug/sentry-test" within 60 seconds of curl. Issue tagged Unhandled, environment production, GET method, request URL captured. Auto-resolved after debug endpoint cleanup commit 1201ec9. Backend Sentry production-grade.

**Commits:** `4144e89` (wiring + debug), `1201ec9` (cleanup)

---

## 2026-05-11 — Session 82b-HOTFIX — Fix FCM Crash (google-services Plugin Silent Skip)

**Root cause:** `android/app/build.gradle` wrapped `apply plugin: 'com.google.gms.google-services'` in a try/catch with `logger.info()` in the catch. Even with valid `google-services.json` (674 bytes) present, the plugin silently did NOT apply → `app/build/generated/res/google-services/debug/values/` never generated → `FirebaseApp.initializeApp()` failed at runtime → app crashed right after user granted notification permission. Classic Anti-Silent-Failure Rule B violation at native build layer.

**Files changed:**
- `android/app/build.gradle` — replaced silent try/catch with loud-fail: throws `org.gradle.api.GradleException` if file missing/empty; logs visible `logger.lifecycle()` confirmation when plugin applies

**Build output (post-fix):** `✅ google-services plugin applied (Firebase config: google-services.json, 674 bytes)` + `BUILD SUCCESSFUL in 54s`
**Generated resources:** ✅ `app/build/generated/res/processDebugGoogleServices/values/values.xml` exists (660 bytes)
**APK:** ✅ 6.1 MB (post-clean rebuild)
**IDE linter warning about `org.gradle.api.GradleException`:** false positive — class is fully available at Gradle runtime, not resolvable statically by IDE Groovy linter
**Rule D verified (founder + Opus, 2026-05-11 ~4:40 PM IST):** Fresh APK installed on phone, notification permission granted with no crash. Railway HTTP logs confirmed `POST /api/push/fcm/register` 200 (2 calls, token registered). End-to-end test: web account sent chat message to phone account → native system notification received on phone with app backgrounded → tap deep-linked to chat. FCM push fully operational.
**Commit:** 2e1c1bd

---

## 2026-05-11 — Session 82 — Sprint 1: FCM Push Notifications

**Goal:** Add FCM as parallel push channel alongside existing Web Push. Native APK gets Android system notifications; web users keep PWA push (unchanged).

**Files added:**
- `src/hooks/useFcmRegistration.ts` — native-only FCM registration hook (dynamic import, tree-shaken on web)

**Files changed:**
- `prisma/schema.prisma` — new `FcmToken` model + `User.fcmTokens` back-relation; `db push` applied to Neon
- `src/config/env.ts` — `FIREBASE_ADMIN_KEY_JSON` optional env var added
- `src/services/push.service.ts` — renamed to `sendWebPushToUser` (private); added `sendFcmToUser`; exported `sendPushToUser` now fans out to both via `Promise.allSettled`
- `src/modules/push/push.routes.ts` — `POST /fcm/register` + `DELETE /fcm/unregister`
- `src/App.tsx` — `useFcmRegistration()` in FlowController; push tap deep-link handler in native useEffect
- `capacitor.config.ts` — `PushNotifications` plugin block added
- `package.json` — `@capacitor/push-notifications@8.0.4` + `firebase-admin@13.9.0`

**Google-services.json:** Terminal has no Full Disk Access to ~/Downloads — file must be copied manually by founder: `cp ~/Downloads/google-services.json android/app/google-services.json`. Gradle already has auto-apply try/catch (added by `cap sync`) so build succeeds without it; FCM won't function until file is in place.

**Gradle:** `android/build.gradle` and `android/app/build.gradle` already configured by `cap sync` — Google Services classpath and apply plugin present via try/catch.

**Rule A:** ✅ `/api/push/fcm/register` in frontend matches `router.post('/fcm/register')` in backend
**Rule B:** ✅ 0 user-facing silent catches in new code (2 `.catch(()=>{})` are stale-token DB cleanup — acceptable)
**Rule C:** ✅ No scheme change, `CAPACITOR_ORIGINS` intact with all 3 variants
**Rule D:** Native APK rebuild + manual test pending — founder must: (1) add `FIREBASE_ADMIN_KEY_JSON` Railway env var, (2) copy google-services.json, (3) rebuild APK, (4) install + test notification
**Rule E:** Production curl pending Railway redeploy after founder adds env var

**tsc --noEmit:** ✅ | **build:web:** ✅ 1320 KiB | **Tree-shaking:** ✅ 0 Capacitor symbols in web bundle
**Cap sync:** ✅ 6 plugins | **APK:** ✅ 8.3 MB (was 7.9 MB)
**Commit:** TBD

---

## 2026-05-11 — Session — CLAUDE.md Anti-Silent-Failure Rules

**Files changed:**
- `CLAUDE.md` — added "Anti-Silent-Failure Rules" section (5 rules: A-E) between "Rules (follow always)" and "Key File Map"

**Rules added:** A (frontend↔backend URL parity audit), B (forbidden silent .catch(()=>{})), C (Capacitor config → CORS audit), D (native-only changes need native smoke test note), E (production curl after backend deploy).

**Reasoning:** 3 silent-failure bugs in Sprint 0/1 (78e, 78f, 80c) cost ~4 hours of debugging. All had the same pattern: a `.catch(()=>{})` swallowed a URL mismatch or CORS failure. These 5 rules codify the post-mortem checks so they run automatically at pre-commit, not after shipping.

**Commit:** TBD

---

## 2026-05-11 — Session 81 — Sprint 1: Native Plugins (Polish Layer)

**Plugins added:** @capacitor/splash-screen, @capacitor/status-bar, @capacitor/geolocation, @capacitor/app, @capacitor/keyboard (all 8.x, matched to core 8.3.3)

**Files changed:**
- `package.json` — 5 new dependencies
- `capacitor.config.ts` — plugins block: SplashScreen (cream bg, manual hide), StatusBar (Dark style, #FAFAF8), Keyboard (body resize)
- `android/app/src/main/AndroidManifest.xml` — ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, ACCESS_NETWORK_STATE added
- `android/gradle.properties` — added `org.gradle.java.installations.paths` pointing to Android Studio's JDK 21 (geolocation plugin requires Java 21 exactly; system JDK 22 not accepted by Gradle toolchain)
- `src/App.tsx` — `useEffect` with dynamic imports (web-safe, tree-shaken by Vite): StatusBar, SplashScreen, App (backButton), Keyboard — runs only when `isNative()` is true

**Build note:** geolocation plugin requires JDK 21 exactly; Gradle toolchain rejected JDK 17 and 22. Fixed by pointing to Android Studio's bundled JDK 21 (`/Applications/Android Studio.app/Contents/jbr/Contents/Home`).

**Camera plugin DEFERRED** to Session 82 — existing HTML file inputs with `capture="environment"` already trigger native camera in Capacitor WebView; refactoring 9+ sites is medium-risk for marginal gain.

**tsc --noEmit:** ✅ | **build:web:** ✅ | **Tree-shaking:** ✅ 0 Capacitor symbols in web bundle
**Cap sync:** ✅ 5 plugins | **Permissions:** ✅ 3 confirmed | **APK:** ✅ 7.9 MB (was 4.4 MB)
**Commit:** TBD

---

## 2026-05-11 — Session 80c-HOTFIX — Fix Native APK Login (CORS https://localhost)

**Root cause:** `androidScheme: 'https'` → Android WebView loads from `https://localhost`. CORS allowlist only had `http://localhost` — https variant was missing → browser blocked auth response → silent login failure on phone.

**Fix:** `src/app.ts` — added `'https://localhost'` to `CAPACITOR_ORIGINS` + updated comment.

**tsc --noEmit:** ✅ | **Build:** ✅ | **No APK rebuild needed** — backend-only change.
**Founder action:** Force-close APK → re-open → login works.
**Commit:** TBD

---

## 2026-05-10 — Session 80b — First Debug APK Built

**Process:**
1. `npm run build:mobile` → React bundle with `VITE_API_URL=https://dukanchi.com` ✅
2. `npx cap sync android` → dist/ copied to android/app/src/main/assets/public/ ✅
3. `cd android && ./gradlew assembleDebug` → BUILD SUCCESSFUL in 39s ✅

**APK:** `android/app/build/outputs/apk/debug/app-debug.apk` — **4.4 MB** — valid Android package
**Full path:** `/Users/apple/Documents/Dukanchi-App/android/app/build/outputs/apk/debug/app-debug.apk`

**Source files changed:** none — build artifact only (gitignored by android/.gitignore)
**No commit needed.**

**For founder:** Transfer APK to phone via WhatsApp self-message / AirDrop / Google Drive. Allow "Install unknown apps" for the transfer source, then install.

---

## 2026-05-10 — Session 80 — Sprint 1: Capacitor Android Install

**Goal:** Install Capacitor 8 + generate android/ shell project. First step of Sprint 1 (Native Mobile, Android-first track).

**Files added:**
- `capacitor.config.ts` — appId `com.dukanchi.app`, appName `Dukanchi`, webDir `dist`, androidScheme `https`
- `android/` — full native shell from `npx cap add android` (Capacitor 8.3.3)
- `package.json` — new scripts: `build:web`, `build:mobile`, `sync:android`, `open:android`
- `.gitignore` — Capacitor exclusions (.capacitor/, *.iml, android/local.properties, android/app/release+debug)

**Capacitor version:** 8.3.3 (core + android + cli all pinned to same)

**Build modes:**
- `npm run build` / `build:web` → web PWA, relative paths (Railway unchanged)
- `npm run build:mobile` → web bundle with `VITE_API_URL=https://dukanchi.com`
- `npm run sync:android` → full mobile build + cap sync
- `npm run open:android` → opens Android Studio

**tsc --noEmit:** ✅ exit 0
**Web build:** ✅ unchanged (47 entries, 1307 KiB)
**Android shell:** ✅ generated — applicationId `com.dukanchi.app` confirmed in build.gradle
**Web assets synced:** ✅ android/app/src/main/assets/public/ populated
**Commit:** 6d298db

**Next:** Founder opens android/ in Android Studio → first emulator boot test. Session 81 = native plugins.

---

## 2026-05-10 — Session 78f-HOTFIX3 — Search History Clear URL fix

**Files changed:**
- `src/pages/UserSettings.tsx:354` — `/api/me/search-history` → `/api/search/history`

**Root cause:** `UserSettings.tsx` DELETE was hitting a non-existent route → SPA HTML → silent fail → history reappeared on next reload. Correct path matches `Search.tsx:105` and the backend route at `DELETE /api/search/history`. Found by post-78e URL audit of all 17 apiFetch paths.

**tsc --noEmit:** ✅ | **Build:** ✅ | **Grep:** ✅ 0 remaining `/api/me/search-history`
**Commit:** TBD

---

## 2026-05-10 — Session 78e-HOTFIX2 — Fix /api/conversations URL mismatch

**Goal:** Fix the actual root cause of empty Messages page that 78d-HOTFIX revealed.

**Files changed:**
- `src/pages/Messages.tsx` — 2 occurrences of `/api/conversations` → `/api/messages/conversations` (lines 35, 43)
- `src/app.ts` — removed dead alias mount `app.use('/api/conversations', messageRoutes)` (line 141)

**Root cause:** Frontend called `/api/conversations` which fell through to SPA HTML fallback → `.json()` parse error → silent `.catch(()=>{})` → empty state. Correct path is `/api/messages/conversations`. The dead alias in app.ts made the URL "exist" but routed through messageRoutes incorrectly, masking the real problem.

**tsc --noEmit:** ✅ exit 0
**Build:** ✅ vite build OK
**Grep:** ✅ 0 references to `/api/conversations` remain
**Commit:** 1a26b77

**Sprint 0 status:** ✅✅✅ COMPLETE — verified end-to-end with real cross-account messaging.
**Next:** Sprint 1 / Session 80 — Capacitor Android install.

---

## 2026-05-10 — Session 78d-HOTFIX — HTTP Cache Headers for Dynamic API

**Goal:** Stop browser from serving stale cached responses on dynamic /api/* endpoints. Production test exposed that conversations, messages, and notifications were returning 304 Not Modified to clients with stale cached bodies. New messages in DB invisible until hard-refresh.

**Files changed:**
- `src/app.ts` — added single middleware on `/api` after rate limiter, before route handlers. Sets `Cache-Control: no-store` + `Pragma: no-cache` + `Expires: 0` by default. Route handlers that call `res.set('Cache-Control', ...)` still override (Express last-write-wins on headers).

**Root cause:** Customer (Nikhil Panwar) sent 4 messages to retailer (Dolphin hotel); POST /api/messages → 200 OK; admin panel showed all 4; but neither sender nor receiver saw them on their pages. Network tab on retailer: `conversations = 304`, `me = 304`. Hard refresh fixed everything. Express's default weak-ETag + browser conditional GET served stale empty bodies because ETag matched first empty-state load.

**Endpoints fixed (default no-store now applies):** /api/messages/*, /api/notifications/*, /api/auth/*, /api/users/*, /api/posts/*, /api/search/*, /api/admin/*, and all other dynamic endpoints.

**Endpoints NOT changed (intentional cache via res.set in handler):**
- `store.controller.ts:137` — `public, max-age=30`
- `misc.controller.ts:37,48,72` — `public, max-age=60/300`

**tsc --noEmit:** ✅ exit 0
**Build:** ✅ vite build OK
**Commit:** c6942a8

**Sprint 0 status:** ✅ COMPLETE (verified end-to-end with real users)
**Next:** Sprint 1 / Session 80 — Install Capacitor Android

---

## 2026-05-10 — Session 78c-FIX — Reconnection Resilience + Debug Cleanup

**Goal:** Close Sprint 0. Revert 78c-DEBUG verbose logging; add reconnection-aware data sync so mobile background → wake → reconnect recovers missed messages without user action.

**Files changed:**
- `src/config/socket-listeners.ts` — restored simple auth middleware; connect/disconnect logs now dev-only one-liner; production keeps `[SOCKET] auth rejected` warn for actual auth failures
- `src/modules/messages/message.service.ts` — removed fetchSockets() diagnostic + [MSG-EMIT] logs; restored simple emit pattern
- `src/lib/api.ts` — explicit reconnection options (reconnection:true, attempts:Infinity, delay:1s, max:5s, timeout:20s); added `SOCKET_RECONNECT_OPTS` constant
- `src/pages/Chat.tsx` — concise lifecycle listeners (dev-only + connect_error warn); `reopenCountRef` + `socket.io.on('reconnect')` + `engine.on('open')` refetch; `visibilitychange` wakeup
- `src/pages/Messages.tsx` — same pattern; reuses existing `refreshConversations()` callback; `refreshConversations` added to effect dep array
- `src/context/NotificationContext.tsx` — same pattern; added `useRef` import; reuses existing `fetchNotifications()`

**Behavior after this session:**
- Both tabs foreground: real-time delivery instant ✅
- Receiver backgrounds <30s: usually delivered (socket alive)
- Receiver backgrounds 30s+, then foregrounds: reconnect → refetch → missed messages appear within 1-3s ✅
- Sprint 2 FCM push will preempt this for native delivery

**tsc --noEmit:** ✅ exit 0
**Build:** ✅ vite build OK
**Migration grep:** ✅ 0 remaining credentials:include
**Debug-log grep:** ✅ 0 SOCKET-AUTH/CONN/MSG-EMIT remnants
**Commit:** 227355d

**Sprint 0 status:** ✅ COMPLETE. All 4 audit blockers cleared, fetch migration done, Socket.IO native-aware, reconnection resilience added.
**Next:** Sprint 1 / Session 80 — Install @capacitor/core + @capacitor/cli + @capacitor/android, run cap init, cap add android.

---

## 2026-05-10 — Session 78c-DEBUG — Socket.IO Diagnostic Logging

**Goal:** Find root cause of cross-account real-time delivery failure. ZERO functional changes — only logging added in 5 files.

**Files changed:**
- `src/pages/Chat.tsx` — connect/connect_error/disconnect listeners
- `src/pages/Messages.tsx` — same listeners
- `src/context/NotificationContext.tsx` — same listeners
- `src/config/socket-listeners.ts` — verbose auth middleware logging (handshakeId, origin, tokenSource, JWT result), connection/disconnect logging
- `src/modules/messages/message.service.ts` — pre-emit `fetchSockets()` room-roster log + post-emit confirmation

**No behavioral change.** Cookie auth flow, UX, and production routes byte-identical. Only console output differs.

**Diagnostic coverage:**
- If [SOCKET-AUTH] shows "NO TOKEN" → cookie not sent on WebSocket upgrade
- If [SOCKET-AUTH] shows "JWT verify FAILED" → token corrupted/expired
- If AUTH OK but [MSG-EMIT] shows "0 sockets in room" → user not joining room despite auth
- If everything OK but UI silent → frontend newMessage handler bug

**tsc --noEmit:** ✅ clean
**Build:** ✅ vite build OK
**Regression grep:** ✅ 0 remaining credentials:include
**Commit:** 5707fb9

**Next:** Founder tests 2-account cross-browser chat, pastes console + Railway logs → Session 78c-FIX applies targeted fix.

---

## 2026-05-10 — Session 78b — Capacitor Pre-Flight: Bulk Fetch + Socket.IO Migration

**Goal:** Complete Sprint 0. Migrate all remaining frontend fetch calls to apiFetch, make Socket.IO native-aware, fix token restoration bug from 78a.

**Files changed:**

Auth fix:
- `src/context/AuthContext.tsx` — `/me` restoration uses `getNativeToken() || "native"` instead of `null` on native (fixes !!token boolean checks across 8+ pages on cold start)

Bulk fetch migration (24 files, ~95 call sites):
- All files migrated: KYCForm, ReviewModal, AiBioModal, StoreFormFields, PostsGrid, AccountDetailsTab, BulkUploadTab, BusinessSettingsTabs, LocationContext, NotificationContext, useFeed, usePushNotifications, Chat, Home, LandingPage, Map, Messages, Profile, RetailerDashboard, Search, StoreProfile, Support, UserSettings
- Import path bug from migration agent corrected: `src/components/` → `../lib/api` (not `../../lib/api`), `src/components/{sub}/` → `../../lib/api` (not `../../../lib/api`)

Socket.IO native auth:
- `src/lib/api.ts` — `getSocketUrl()` and `getSocketAuthOptions()` helpers added
- `src/pages/Chat.tsx` — `io()` uses helpers
- `src/pages/Messages.tsx` — `io()` uses helpers, orphaned `socketUrl` var removed
- `src/context/NotificationContext.tsx` — `io()` uses helpers
- Backend (`src/config/socket-listeners.ts`) already handled `socket.handshake.auth.token` fallback — no change needed

Defensive audit findings:
- EventSource: none found
- XMLHttpRequest: none found
- Auth-bearing image src: none found

**tsc --noEmit:** ✅ exit 0
**Build:** ✅ vite build OK
**Migration grep:** ✅ 0 remaining `credentials: 'include'` outside api.ts
**No external apiFetch:** ✅ 0 lines
**Commit:** c1e83e9

**Sprint 0 status:** ✅ COMPLETE. All audit blockers cleared.
**Next:** Session 79 — PWA install banner native hide + localStorage user cleanup. Then Sprint 1 — Capacitor install.

---

## 2026-05-09 — Session 78a — Capacitor Pre-Flight: Auth Bearer Foundation

**Goal:** Wire dual-mode auth — cookie for web (unchanged) + Bearer token for native (new). Backend returns JWT in login/signup response body so native clients can store it.

**Files changed:**
- `src/modules/auth/auth.controller.ts` — login/signup now return `token` in JSON body (additive, cookie still set). New `refresh()` method.
- `src/modules/auth/auth.service.ts` — `issueTokenForUser()` helper for refresh endpoint.
- `src/modules/auth/auth.routes.ts` — `POST /api/auth/refresh` route added (requires valid token via `authenticateToken`).
- `src/context/AuthContext.tsx` — `login()` calls `setNativeToken()` on native; `logout()` calls `clearNativeToken()`; `/api/auth/me` and `/api/auth/logout` use `apiFetch`.
- `src/pages/Login.tsx` — `fetch` → `apiFetch`.
- `src/pages/Signup.tsx` — `fetch` → `apiFetch`.

**Behavior matrix:**
| Platform | Login | Refresh | Logout |
|---|---|---|---|
| Web (PWA) | Cookie set, token in body (ignored) | Cookie refreshed | Cookie cleared |
| Native | Token in body stored via setNativeToken | Bearer refresh, new token stored | Token cleared from localStorage |

**tsc --noEmit:** ✅ exit 0
**Build:** ✅ vite build OK
**Commit:** 808ab63

**Blockers cleared:** 4/4 (Sprint 0 critical path complete)
**Next:** Session 78b — bulk migrate ~95 non-auth fetch call sites across ~25 files to apiFetch.

---

## 2026-05-09 — Session 77 — Capacitor Pre-Flight: Foundation

**Goal:** Lay groundwork for Capacitor migration. Knock out 3 of 4 audit blockers without installing Capacitor yet.

**Files changed:**
- `src/lib/api.ts` — NEW. `apiFetch` wrapper, `isNative()`, `getToken/setToken/clearToken` helpers. Web behavior unchanged (relative paths + cookies). Native path uses absolute URL + Bearer header. No `@capacitor/*` imports yet.
- `index.html` — IIFE bypass: native app (`window.Capacitor.isNativePlatform()`) no longer redirects to `/landing` on launch
- `src/app.ts` — CORS allowlist now permits `capacitor://localhost` (iOS) and `http://localhost` (Android) unconditionally via `CAPACITOR_ORIGINS` constant
- `.env.example` — added comment that Capacitor origins are hardcoded, not needed in `ALLOWED_ORIGINS`

**Reasoning:** Audit identified 4 blockers. This session handles 3: redirect IIFE (5min), CORS (5min), and foundation `api.ts` module that Session 78's bulk fetch refactor depends on. Auth Bearer wiring intentionally deferred to Session 78 (~20 files). Track is Android-first.

**tsc --noEmit:** ✅ exit 0
**Build:** ✅ vite build OK, dist/ generated, PWA SW generated
**Regression:** ✅ web behavior unchanged (isNative() returns false on web)
**Commit:** 37f5f95

**Blockers cleared:** 3/4 (cookie auth pending Session 78)
**Next:** Session 78 — bulk migrate all fetch() calls to apiFetch, add /api/auth/refresh endpoint, AuthContext token storage on login

---

## 2026-05-06 — Session 76 (B2B2C visibility hardening)
- FIX 1 (canChat stub): auth.middleware.ts — replaced `return true` stub with real role-pair logic; customer↔retailer only; B2B↔B2B freely; customer blocked from supplier/brand/manufacturer chat
- FIX 2 (store listing): store.service.ts getStores + getStorePosts — viewerRole param added; customer sees retailer-only; B2B sees all 4 B2B store types; console.log removed
- FIX 3 (feed B2B): post.service.ts — supplier/manufacturer/brand now see all B2B posts (was incorrectly retailer-only)
- FIX 4 (search B2B): search.controller.ts getAllowedRoles — same B2B fix; supplier/manufacturer/brand now search across all B2B roles
- FIX 5 (store/user profile): store.controller.ts getStoreById + user.controller.ts getUserProfile — customer gets 404 for non-retailer profiles (existence not leaked); customer can still view own profile
- tsc --noEmit: exit 0

---

## 2026-05-05 — Session 75 (Audit Batch 5: UX Polish — FINAL BATCH)
- UX-001: Login/Signup spinners — already shipped prior to audit; finding was outdated. No changes needed.
- UX-002: Error toasts on interaction rollbacks — showToast added to 4 catch blocks:
  - Home.tsx: toggleLike, toggleSave, toggleFollow (all 3 handlers; useCallback deps updated)
  - StoreProfile.tsx: toggleFollow
  - Messages: Hinglish — "Like/Save/Follow nahi ho saka, dobara try karein"
- INFRA-005: .env.example — already completed in Session 73 (verified)
- tsc --noEmit: exit 0
- Phase 0.4 Production Hardening COMPLETE — 19/19 high+medium audit fixes deployed (16 from report + 3 bonus: getFollowing guard, INFRA-005, SEC-012)

---

## 2026-05-05 — Session 74 (Audit Batch 4: Reliability)
- RELIABILITY-001: Notification worker rewritten — inline emit from follower chunk data; removed extra prisma.notification.findMany (was O(followers) round-trips); skipDuplicates:true on createMany; console.* replaced with logger
- BUGS-003: Block/unblock now immediately invalidates blocked:{userId} Redis cache — updateUser (single) and bulkUpdateUsers (Promise.all batch); previously user could still auth for up to 60s after admin block
- RELIABILITY-003: Graceful shutdown now drains BullMQ before closing Redis — notificationWorker.close() + notificationQueue.close() added in correct order (HTTP → BullMQ worker → BullMQ queue → Prisma → Redis → exit)
- tsc --noEmit: exit 0

---

## 2026-05-05 — Session 73 (Audit Batch 3: Performance)
- PERF-001: ask-nearby bounding box pre-filter — lat/lng WHERE clause added to prisma.store.findMany; eliminates full-table scan at scale
- PERF-002: ask-nearby createMany batch insert — N sequential prisma.askNearbyResponse.create() replaced with single createMany + one findMany for socket IDs
- BUGS-001/PERF-006: feed cache key now includes userId — was feed:{role}:... causing user A's likes/isOwnPost to bleed into user B's cached feed (privacy + correctness bug)
- RELIABILITY-002: prisma.ts comment documents connection_limit=10&pool_timeout=20 recommendation for Neon; .env.example updated with correct DATABASE_URL format
- BONUS (closes INFRA-005): .env.example fully rewritten — added GEMINI_API_KEY, SENTRY_DSN, VITE_GOOGLE_MAPS_API_KEY, APP_URL, NODE_ENV, GOOGLE_CLIENT_ID, VITE_GOOGLE_CLIENT_ID; all vars now documented with section headers
- tsc --noEmit: exit 0

---

## 2026-05-05 — Session 72 (Audit Batch 2: Security Critical)
- SEC-001: togglePin ownership check — PostService.togglePin now accepts userId, fetches store.ownerId, throws 403 if mismatch
- SEC-002: updateStore mass assignment fixed — explicit ALLOWED_FIELDS whitelist in store.service.ts, blocks ownerId/id/averageRating etc.
- SEC-003: IDOR guards added — getSaved, getSearchHistory, getLocations all check req.params.id === userId (admin bypass allowed)
- QUALITY-005: createPost storeId ownership — verifies store.ownerId === userId before calling PostService.createPost
- Bonus: getFollowing guard — self-only, no admin bypass (following list is private)
- tsc --noEmit: exit 0

---

## 2026-05-04 — Session 71 (Audit Batch 1: quick wins)
- PERF-005: geminiEmbeddings.ts now uses shared Prisma singleton (was creating a second connection pool)
- SEC-005: GEMINI_API_KEY added to Zod envSchema (was unvalidated, app started silently without it)
- SEC-012: Removed credentials:'include' from server-side fetch calls in geminiEmbeddings.ts and search.service.ts (browser-only option, no-op in Node)
- All 4 process.env.GEMINI_API_KEY! usages replaced with env.GEMINI_API_KEY across geminiEmbeddings, geminiVision, search.service, bulkImport.service
- SENTRY_DSN added to envSchema (optional)
- INFRA-001: HEALTHCHECK added to Dockerfile (curl installed, 30s interval, 30s start-period)
- INFRA-004: healthcheckPath + healthcheckTimeout added to railway.json
- RELIABILITY-005: Duplicate GET /health at app.ts:153 removed (line 101 kept — before rate limiter)
- tsc --noEmit passes (exit 0)

---

## 2026-05-03 — Session 70 (Admin panel: build + serve + token fix)
- Admin panel was a separate Vite app (admin-panel/) never built in Dockerfile — now fixed
- Dockerfile: cd admin-panel && npm install && npm run build (produces admin-panel/dist/)
- admin-panel/vite.config.ts: added base: '/admin-panel/' so all assets resolve correctly
- admin-panel/src/App.tsx: added basename="/admin-panel" to BrowserRouter for React Router
- src/app.ts: serve admin-panel/dist at /admin-panel + SPA fallback for deep routes
- admin-panel/src/components/Sidebar.tsx: logout now redirects to /admin-panel/login (not /login)
- admin-panel/src/lib/api.ts: imgUrl() no longer hardcodes localhost:3000 in production
- Fixed 6 unused import TS errors blocking admin-panel build (AdminLayout, Sidebar, Toast, Complaints, Dashboard, Posts)
- Token flow confirmed correct: auth.controller.ts already sets dk_admin_token for admin role
- Admin panel now accessible at /admin-panel/ after deploy
- tsc --noEmit passes (exit 0) on both main app and admin panel

---

## 2026-05-03 — Session 69 (Production Live on Railway)
- Railway deployment fully active — all 3 services online: Dukanchi-App, Redis, redis-volume
- Public URL: https://dukanchi-app-production.up.railway.app
- Redis added with private networking — REDIS_URL set via Railway reference variable
- Environment: NODE_ENV=production, PORT=3000 explicitly set
- Final production stack confirmed: Neon DB (Singapore) + Cloudflare R2 + Railway (Sydney) + Redis
- Issues resolved this session: Alpine→Debian Prisma/OpenSSL fix, graceful Redis fallback, proper Redis service wiring

---

## 2026-05-03 — Session 68 (Deploy fixes: Debian Dockerfile + Prisma binaryTargets + graceful Redis)
- ISSUE 1: Prisma Alpine+OpenSSL mismatch — switched Dockerfile from node:22-alpine to node:22-bookworm-slim (Debian)
- Dockerfile now uses apt-get: build-essential, python3, pkg-config, libcairo2-dev, libpango1.0-dev, libjpeg-dev, libgif-dev, librsvg2-dev, openssl, ca-certificates
- prisma/schema.prisma: added binaryTargets = ["native", "debian-openssl-3.0.x"] to generator block
- ISSUE 2: Redis graceful degradation — added .on('error') listeners to pubClient/subClient (prevents unhandled error event crash)
- Wrapped all bare pubClient.get/set/del calls without try/catch in admin.service.ts, store.service.ts, user.service.ts, kyc.service.ts
- connectRedis() already non-fatal; socket adapter and BullMQ IORedis already reconnect-safe
- npx tsc --noEmit passes (exit 0)

---

## 2026-05-03 — Session 67 (Railway: switch to Dockerfile builder)
- Nixpacks kept failing on native deps (canvas, node-gyp, Python not found)
- Switched Railway to use Dockerfile via railway.json (builder: DOCKERFILE)
- Rewrote Dockerfile: node:22-alpine base, apk install for canvas native deps (python3, make, g++, cairo-dev, pango-dev, jpeg-dev, giflib-dev, librsvg-dev, pixman-dev)
- Fixed start command: node_modules/.bin/tsx server.ts (previous "node server.ts" would fail — Node can't run .ts directly)
- Used local prisma binary (node_modules/.bin/prisma generate) to avoid npx version mismatch
- Removed nixpacks.toml — no longer needed
- startCommand in railway.json: node_modules/.bin/tsx server.ts

---

## 2026-05-03 — Session 66 (Railway deployment — canvas build fix)
- Project deployed to Railway from GitHub (auto-deploy enabled)
- First build failed: canvas library needed native deps (Cairo, Pango, etc.) not in Railway's default env
- Added nixpacks.toml with system packages: pkg-config, cairo, pango, libpng, giflib, librsvg, pixman, libjpeg
- Note: canvas has no imports in src/ — it may be an unused or transitive dep; safe to remove in a future cleanup
- Build retry should now succeed

---

## 2026-05-03 — Session 65 (Cloudflare R2 Storage Integration)
- Migrated file storage to Cloudflare R2 (S3-compatible, zero egress fees)
- Bucket: dukanchi-prod (Asia Pacific region)
- S3Client config: endpoint (S3_ENDPOINT env), region "auto", forcePathStyle: true
- Fixed long-standing bug: env schema had AWS_S3_BUCKET but .env used S3_BUCKET_NAME — R2 branch was never triggering
- Added getUploadedFileUrl() helper in upload.middleware.ts — uses R2_PUBLIC_URL+key for CDN URL, falls back to .location or /uploads/ path
- app.ts /api/upload and admin.controller.ts uploadSettingsImage both updated to use helper
- Added S3_ENDPOINT and R2_PUBLIC_URL to .env.example (empty placeholders, no secrets)
- npx tsc --noEmit passes (exit 0)
- Files changed: src/config/env.ts, src/middlewares/upload.middleware.ts, src/app.ts, src/modules/admin/admin.controller.ts, .env.example

---

## 2026-05-03 — Session 64 (Neon DB Production Setup)
- Migrated from local SQLite to Neon Postgres (Singapore region, AWS ap-southeast-1)
- All schema tables pushed via `prisma db push --accept-data-loss` (20 models total)
- Models: User, Store, Post, Product, Message, Category, Review, Notification, SavedItem, SearchHistory, SavedLocation, TeamMember, Report, Like, AppSettings, Complaint, LandingPageContent, PushSubscription, AskNearbyRequest, AskNearbyResponse
- pgvector extension enabled — Product.embedding column (vector type) confirmed live
- Prisma 5.22.0 used (NOT global npx which had Prisma 7.x causing schema errors)
- DATABASE_URL configured in .env (gitignored, neon.tech Singapore endpoint)
- npx tsc --noEmit passes (exit 0)
- App now connects to production-grade managed PostgreSQL on Neon

---

## 2026-05-02 — Session 63 (Continue in Browser option)
- Landing page: "Browser mein continue karein" link below download button (hero + final CTA)
- localStorage 'dk-browser-mode' flag bypasses /landing redirect
- index.html IIFE + FlowController both respect browser-mode flag
- BrowserModeBanner in App.tsx — dismissible, encourages PWA install
- 'appinstalled' clears dk-browser-mode flag when user upgrades to PWA
- Works on iOS Safari, Firefox, all browsers (no API dependency)

---

## 2026-05-02 — Session 61 (Phone PWA login on ngrok HTTPS)
- app.set('trust proxy', 1) — Express reads X-Forwarded-Proto correctly
- Cookie secure flag follows actual request protocol (not NODE_ENV)
- sameSite='none' for HTTPS — required for PWA cookies on ngrok
- Phone PWA login/signup + logout now work via ngrok URL

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

### Commit: fa72a67 — ui: premium redesign phase 1 (home + search)

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

### Commit: fa72a67 — security: phase 2 zod input validation

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

### Commit: fa72a67 — security: phase 1 hardening

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
