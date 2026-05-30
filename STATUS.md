# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-30 | Session 128.19 | 🟡🟢 **BLINKIT PHASE 2 (yellow brand + green action) — LIVE** (PR [#130](https://github.com/dukanchiapp/Dukanchi-App/pull/130) → main `fa04004` → **Fly v55**; bundles `index-Bm6Cz8Ul.css` + `index-BlTTpHi2.js` identical on Fly + Cloudflare; `/health` 200 both; all 4 `--c-action / -dk / -lt / -ink` tokens verified in shipped CSS). Founder shared 5 Blinkit screenshots. Critical insight: Blinkit uses yellow as BRAND canvas (header backgrounds) but GREEN as PRIMARY ACTION (every ADD/Order/CTA). Phase 1 had CTAs yellow (wrong) — Phase 2 makes them green. New tokens `--c-action / -dk / -lt / -ink` (#0C831F Blinkit ADD-green). Surfaces: Home header WHITE→full-bleed YELLOW (white logo tile + dark "द" + dark text); bell peach-outlined→WHITE circle (Blinkit profile pattern); tabs yellow-pill→underline-style (3px dark border + bold — Blinkit All/Vacations bar); PostCard Follow button yellow→GREEN outlined card-style (white surface + green border + green text — Blinkit "ADD" pattern); Login/Signup/empty-state CTAs yellow→solid GREEN + white text; BottomNav active state magenta-text-only→YELLOW rounded square BEHIND icon + dark label (Blinkit Print-tab pattern). UNCHANGED: status pill colors + getLiveStatus + semantic toasts + verified-tick blue + rating gold + FLogo (still yellow 3D for non-yellow surfaces) + favicon. typecheck 0 ✅ · 133/133 tests · build ✓. **Prior:** Session 128.17 Blinkit Phase 1 yellow theme + 3D favicon LIVE (PR #128 → Fly v54). (PR [#128](https://github.com/dukanchiapp/Dukanchi-App/pull/128) → main `963cb07` → **Fly v54**; `/health` 200 both; `<meta name="theme-color" content="#F8CB46">` confirmed in served HTML; `GET /icons/icon.svg` returns `HTTP 200 image/svg+xml 2643 bytes`). Founder: "use blinkit color theme also add the better 3d favicons". Brand pivot orange→magenta → Blinkit yellow (`#F8CB46`) with dark ink (`#1A1A1A`) text. New tokens: `--b-yellow / -dk / -lt / -bg / -ink` + `--c-brand-ink`. `--b-grad` and `--c-brand-grad` now produce a 3D vertical yellow gradient (`#FFD75A → #F8CB46 → #E6B92E`). Surfaces switched: Home header bell, Home tabs active, FLogo (now true 3D — gradient + sheen + glow), PostCard Follow button + avatar circle + letter fallback, Login + Signup CTAs, Home empty-state CTA, carousel + pulse-dot accents. New `public/icons/icon.svg` 512×512 3D app-icon (gradient face + top sheen + bottom radial inner-shadow + outer rim + drop shadow + "द" with white bevel + iOS 22.5% radius). `index.html` `theme-color` `#FF6B35`→`#F8CB46` + `<link rel="icon" type="image/svg+xml">` + mask-icon. `manifest.json` `theme_color` + SVG-first icons list. **UNCHANGED:** status pill colors, getLiveStatus logic, semantic toast colors, verified-tick blue, rating gold, legacy `--f-grad-primary` (53 white-text consumers, will migrate individually). typecheck 0 ✅ · 133/133 tests · build ✓ (PWA precache 70→71). **Prior:** Session 128.15 multi-color system LIVE (PR #126 → Fly v53). (PR [#126](https://github.com/dukanchiapp/Dukanchi-App/pull/126) → main `febae67` → **Fly v53**; new CSS bundle `index-Bm4ry6bg.css` + new JS entry `index-BPE6Ud0N.js` identical on Fly + Cloudflare; `/health` 200; all 6 semantic tokens (`--c-brand-solid` / `--c-success` / `--c-danger` / `--c-warning` / `--c-info` / `--c-rating`) verified in CSS; blue verified-tick `#2563EB` confirmed in Home chunk). Founder: orange gradient everywhere = not god-tier → picked Option C full sweep, with constraint NOT to touch store-close-timing colour logic. Changes: new semantic palette tokens in `futuristic.css` (`--c-brand-solid`, `--c-success/bg`, `--c-danger/bg`, `--c-warning/bg`, `--c-info/bg`, `--c-rating`) — all NEW, `--f-status-*` and `liveStatus.ts` UNTOUCHED. Home header: full-bleed orange→magenta gradient bar → white surface + 40×40 gradient logo tile + dark text + peach-bg outlined-orange bell tile. Home tabs: For-You/Following/Saved active state gradient → solid magenta-ink (`--c-brand-solid` #D11F75). VerifiedTick fill green #0C831F → blue #2563EB (trust signal distinct from open-status green). FLogo translucent-glass → solid gradient tile (works on any surface). Toast accents now use the new semantic tokens consistently (info finally a real blue, not teal). typecheck 0 ✅ · 133/133 tests · build ✓. **Prior:** Session 128.13 upload loading overlays LIVE (PR #124 → Fly v52). (PR [#124](https://github.com/dukanchiapp/Dukanchi-App/pull/124) → main `fe816c7` → **Fly v52**; `/health` 200 both; bundle hashes identical on Fly + Cloudflare; `UploadingOverlay-DNQDOSeX.js` code-split chunk verified shipped with `animate-spin` + `aria-live` + `Uploading…` signatures). Founder ask — "while uploading photos and using AI feature there is no loading animation". Audit found 5 silent gaps fixed in this PR: (1) **logo upload**, (2) **cover upload** (both in RetailerDashboard → StoreFormFields — were silent ~3-6s gaps), (3) **new-post cropper → R2 upload**, (4) **edit-post cropper → R2 upload** (both in PostsGrid — cropper closed, blank state until preview lit up), (5) **chat image preview thumbnail** during send (Chat Send button had a spinner but the 64×64 thumb was silent). Already-good (no changes): Login/Signup, AiBioModal, AI photo→post + voice→post ("AI soch raha hai…"), Chat send button, KYC tile (already swaps Camera→Loader2). New `src/components/ui/UploadingOverlay.tsx` shared component (absolutely-positioned dim layer + animate-spin ring + optional label, ARIA role=status). typecheck 0 ✅ · 133/133 tests · build ✓. **Prior:** Session 128.11 GPS → auto-fill pincode LIVE (PR #122 → Fly v51). (PR [#122](https://github.com/dukanchiapp/Dukanchi-App/pull/122) → main `83cc0d7` → **Fly v51**; `/health` 200; `GET /api/geocode/reverse` unauth → 401 application/json so the new endpoint is properly auth-gated). Today retailer GPS-pin → lat/lng only; pincode/city/state manual. New flow: GPS captures lat/lng → frontend calls new `GET /api/geocode/reverse?lat=X&lng=Y` (authed, Redis-cached 7d at ~110m precision) → server reverse-geocodes via OpenStreetMap Nominatim (with proper User-Agent + 5s timeout) → if 6-digit IN pincode, chains to existing India Post API for authoritative district/state → returns merged `{pincode, city, state, suburb, allCities, allStates}` → frontend setters fill the form. Graceful fallbacks at every step: Nominatim fail → India Post fail → server returns partial data with HTTP 200 → caller falls back to manual entry. `handleGPSUpdate` toast enriched: "📍 Location pinned · 400050, Mumbai". typecheck 0 ✅ · 133/133 tests · build ✓. **Prior:** Session 128.9 PostCard rating + followers + area-data restore LIVE (PR #120 → Fly v50). (PR [#120](https://github.com/dukanchiapp/Dukanchi-App/pull/120) → main `300caa9` → **Fly v50**; new JS bundle `index-BZYg4u5M.js` identical on Fly origin + Cloudflare; `/health` 200; `/api/posts` unauth 401 application/json). Founder screenshot of "Hameed" store showed only 2 rows (logo + name + status pill + Follow). Root-cause: (a) PostCard never surfaced rating/followers despite both being in schema, (b) feed Prisma include was MISSING `city` + `postalCode` selects → that's why area row never rendered. Changes: `post.service.ts` feed include now selects `reviewCount`, `city`, `postalCode`, and `_count: { select: { followers: true } }`; `PostCard.tsx` Row 1 gets a `⭐ 4.6 (124)` chip inline after the verified tick (only when `averageRating > 0 && reviewCount ≥ 1 && !hideRatings`); Row 3's `areaText` extended to `metaLine` = `area · pincode · 2.3k followers` (renders if EITHER present); new `formatCount` helper compresses 2347→"2.3k", 12_000→"12k", 1.5M→"1.5M". Live status "Closes in 30m" already worked via existing `getLiveStatus` 60-min tier — no logic change needed. No schema migration. typecheck 0 ✅ · 133/133 tests · build ✓. **Prior:** Session 128.7 smart ranking Phase A+B LIVE (PR #118 → Fly v49). (PR [#118](https://github.com/dukanchiapp/Dukanchi-App/pull/118) → main `cafd795` → **Fly v49**; backend-only — no frontend bundle change; `/api/posts` unauth returns proper `401 application/json` so the new ranking gate is intact; `/health` 200 both Fly + Cloudflare). Founder ask "no smart logic behind posts". Audit found 5-factor scoring already existed (freshness/distance/engagement/follow/opening) but was global, not personalised. New backend ranking in `post.service.getFeed`: (Phase A) engagement = `likes + saves×2 + recentLikes×2 / 50` (saves & last-24h likes weighted 2×); followed bumped 15→20%; pinned posts +5%; diversity cap max 2 posts per store per page. (Phase B) Redis `feed:seen:{userId}` set with 7-day TTL → seen posts get `× 0.4` penalty; chat-affinity boost +5% (user's DM partners last 30d); category preference +10% (top-3 from last 50 likes); time-of-day boost +5% (IST hour-bucket × store.category heuristic). Net weights: freshness 25 + distance 15 + engagement 15 + follow 20 + category 10 + chat 5 + timeOfDay 5 + pinned 5 + opening 5 → 1.05 sum (booleans handle the slight overflow). 3-5 extra Prisma queries per fetch, all parallel-batched. typecheck 0 ✅ · 133/133 tests pass · build ✓. **Prior context:** Session 128.5 Home Feed Quick Wins LIVE (PR #116 → Fly v48; skeleton + pull-to-refresh + double-tap-like + heart-burst + haptics + empty states + silent-catch toasts). (PR [#116](https://github.com/dukanchiapp/Dukanchi-App/pull/116) → main `1e151db` → **Fly v48**; bundles `index-CCpl6vst.css` + `index-Cnl7BrhZ.js` identical on Fly + Cloudflare; `/health` 200 both; CSS keyframes (`dk-shimmer` / `dk-heart-burst` / `dk-skeleton`) + `haptics-DmP3v6nK.js` chunk with `navigator.vibrate` + `Home-Cdoh0x5M.js` chunk with Hinglish empty-state strings all confirmed in shipped output). UX-strategy bucket 1: (1) **Skeleton loaders** — new `PostCardSkeleton` mirrors the real card shape with a 1.4s shimmer (warm cream); (2) **Pull-to-refresh** — touch handlers on the Home root; arms at `scrollY=0`, eased pull, 70px threshold release fires `useFeed.refresh()` + medium haptic; rotating chevron → magenta spinner indicator; (3) **Double-tap to like** — PostCard image: 2 taps within 300ms → like (only if not already liked) + 96px magenta heart-burst (0.7s scale+fade) + medium haptic; (4) **Haptics util** — new `src/lib/haptics.ts` wraps `navigator.vibrate` (light/medium/heavy/success/error); wired into toggleLike/save/follow/share + double-tap + StoreProfile toggleLike + pull-release; (5) **Empty states** — peach tile + tab-specific icon + Hindi/Hinglish copy + gradient CTA pill; (6) **Silent-catch toasts** — fixed `StoreProfile.toggleLike` (Rule B) + `BusinessSettingsTabs.handleToggleSetting`. typecheck 0 ✅ · build ✓. **Prior context:** Session 128.3 PostCard header → mockup parity LIVE (PR #114 → Fly v47; letter-fallback logo + soft ring + magenta-ink pin + compact distance). new JS bundle `index-LIDLZlFu.js` identical on Fly origin + Cloudflare; `/health` 200 both; new bundle has 0 occurrences of `"m away"` confirming compact-distance landed). Founder screenshots: target Bright card header ("Nikhil Bhai · Open 24h · 1.6 km · Services · 📍 Bandra · 400050") vs current ("test store · ... · 📍 Kurla West"). `PostCard.tsx` avatar gains a letter fallback (no logoUrl → 52×52 gradient circle with first letter, matches mockup's "N"); bumped 46→52; heavy magenta double-ring shadow softened to a single drop; pin recoloured gray → `--b-magenta-ink` (#D11F75) + 10→11px. `Home.tsx` `getDistance` drops "away" suffix → compact `"1.6 km"`/`"320 m"` (StoreProfile pill keeps "away", deliberate). Area row already pulls `post.store.city · postalCode` — founder's "area name can be taken from profile details" already satisfied. typecheck 0 ✅ · build ✓. — Prior: Session 128.1 | 🛠️ **STORE/PROFILE MOCKUP PARITY FIXES — LIVE** (PR [#112](https://github.com/dukanchiapp/Dukanchi-App/pull/112) → main `73cc9f5` → **Fly v46**; new bundle hashes `index-Cw4Z1gZe.css` + `index-YAC98fPR.js` identical on `dukanchi-app.fly.dev` (Fly origin) AND `dukanchi.com` (Cloudflare); `/health` 200 both; `body.modal-open .app-bottom-nav{display:none!important}` CSS rule + `app-bottom-nav` JS class confirmed in shipped bundles). Visual-only (Rule 4) fixes from founder screenshots: (1) **logo-clip bug** — both `StoreProfile.tsx` + `Profile.tsx` had the logo `bottom:-28/-34` inside an `overflow:hidden` cover → clipped; fixed by un-clipping the outer cover wrapper, moving the image into its own clipped media layer, and rendering logo + distance pill outside it (`zIndex 4`); (2) **logo enlarged** (SP 84→96, Prof 72→92, white cutout border); (3) **distance pill** dark→white capsule w/ magenta-ink pin, mockup position (haversine feature already existed, only restyled); (4) **line-based bio read-more** (3-line clamp + `scrollHeight>clientHeight` measure) on both pages, replaces char-count heuristic; (5) **Direction button → blue gradient** (`#2E9BFF→#1D4ED8`) on StoreProfile + StoreInfoCard, peach info-tiles, dark-frosted cover FABs. **Legal & Privacy moved profile→Settings** (removed from both Profile views + unused import; added labelled section to `UserSettings.tsx`). **BottomNav hidden during New/Edit Post sheet** (was overlapping Publish button — body class + CSS rule). typecheck 0 (web/server/worker) ✅ · build ✓. ⚠️ Verification gap: SP/Profile are `ProtectedRoute`+backend-gated → not renderable in dev preview; founder login-gated QA still pending on device. — Prior context: 🎨 **BRIGHT DESIGN SYSTEM RE-SKIN — LIVE** (PR #110 → main `7d81f04` → **Fly v45**; supersedes the dark Futuristic v2 look from S96). Production smoke ✅ — cream `#fff7f0` bundle `index-L79VeOAa.css` confirmed on both `dukanchi-app.fly.dev` + `dukanchi.com` (Cloudflare), `/health` 200 both, no stale cache. Whole-app **visual-only** flip → warm **Bright** system (cream `#FFF7F0`, orange→magenta `#FF6B35→#FF2A8C` gradient, claymorphic tiles, Inter). Central `--f-*` token-*value* remap re-skins every consumer file at once + canonical `--b-*` tokens + `.b-clay`/`.b-clay-emoji`/`.b-tap` primitives; then per-page work (Home, Search claymorphic category grid, Map+IsoMap warm radar, Chat gradient header + legible PostRefCard, Messages, Profile, StoreProfile, Signup white-dropdown+error-banner, NotFound indigo→Bright) + shared chrome (BottomNav flat-white magenta-ink `#D11F75` active, FLocationStrip, NotificationBell, PostCard) + a **~51-hit indigo→Bright sweep** across the settings/KYC/Review cluster (9 files → **zero indigo remains**). No features/fields/API/schema/Socket.IO/auth/routing change (Rule 4). typecheck 0 (web/server/worker) · **133/133** · build ✓. NotFound+Signup confirmed Bright in preview; **8 ProtectedRoute pages** (KYCForm, ReviewModal, 6 settings tabs, Support) verified at source+build only (no backend in dev) → ⏳ founder login-gated QA pending. ⏳ **Native APK re-skin un-verified** (web/preview only; status bar/splash still dark `#060814` in capacitor.config — Bright-tone follow-up). 28 files (+596/−594), commit `087608f`. See DECISIONS.md 2026-05-30.
> Single-page snapshot. History → SESSION_LOG.md. Decisions → DECISIONS.md.
>
> **Pending:** 9 primary screens + Splash + shared-UI + retailer dashboard cluster + mockup parity v3 done. **Pilot-critical finish (from S123.5 audit):** ✅ **S124 shared UI** (Toast/ImageCropper/ProtectedRoute) · ✅ **S125 retailer dashboard cluster** (3 MIXED `--dk-`+Tailwind files → ZERO legacy palette; **flip-blocker cleared**) · ✅ **S126 design mockup parity** (Store Profile rebuilt + Messages rich rows + Map colored chips — exact match to founder mockups). Remaining: ⏳ **KYCForm** (reconcile vs S125's KycUploadForm — possible duplicate) → ⏳ **settings sub-tabs** (AccountDetailsTab/ManagePostsTab/BulkUploadTab/BusinessSettingsTabs) → ⏳ **GLOBAL `--dk-*` flip** + delete `[data-theme=light]` + delete dead AppHeader + comprehensive test. Deferred post-pilot: ManageTeamTab, CustomerDataTabs, Support, ReviewModal, NotFound. Open Opus decisions (3): shared AppHeader, Map dark-style, Map gear FAB action (mockup shows it, no action defined). RESOLVED in S126: StoreProfile gear (→ /settings for owner), conversation rich-rows backend (additive getConversations). Founder device tests pending (auth-gated): all 9 screens + **HIGH-PRIORITY Chat realtime** + Splash + toast/cropper. Founder real-device test still pending for S114 (file-pick instant + cropper UX) + S113 (client compression). Watch `dukanchiapp@gmail.com` Sentry over next 24h for: any new `postsGrid.cropperUploadNew/Edit` exceptions (signature unchanged — none expected), Gemini moderation rate (should drop post-S114), CSP `report-only` violation rate (Rule H audit signal), S109b "Image moderation rejection" + "upload.moderation.gemini_error" rates. Tier 5B remaining (auth + upload + chat E2E with test env) + Tier 5C (perf smoke) + Playwright CI integration queued. Re-enforce CSP = fresh-day task per Rule H. Checkpoint 4 (device verify): ND-D2-APK-SMOKE + browser PWA push end-to-end still pending.

## Day 1 Launch Sprint — 27 May 2026

Status: ✅ Day 1 effectively complete | **6 of 7 tasks closed** | Task 5 CSP in 24-48h Sentry monitoring window before enforce flip
Production HEAD: `050dc62` → `eda3a4d` (PR #43) → `9475c90` (PR #44) → `cd18d1a` (PR #47 npm audit fix) → `a8b64bf` (PR #70 CSP enforce, Fly v26) → `4091dbf` (PR #72 image moderation, Fly v27) → `31c5232` (PR #74 CSP connect-src data:/blob: hotfix, Fly v28) → `bd0f974` (PR #76 CSP reverted to report-only, Fly v29) → `485309f` (PR #80 client image compression, Fly v30) → `6fe89f2` (PR #82 instant file-pick + cropper polish, Fly v31) → `b15cccf` (PR #84 Futuristic v3 tokens + getLiveStatus, Fly v32) → `33d654c` (PR #86 PostCard re-skin + useClosingSoon, Fly v33) → `f7793e7` (PR #88 AppHeader+BottomNav re-skin, Fly v34) → `7f9a64e` (PR #90 Home re-skin: live bell + v3 PostCard, Fly v35) → `31a10b7` (PR #92 Store Profile re-skin, Fly v36) → `947eb13` (PR #94 Messages + Chat re-skin, Fly v37) → `dc7bb41` (PR #96 Search + Ask Nearby re-skin, Fly v38) → `b547c14` (PR #98 Map re-skin + 3D toggle, Fly v39) → `81879d1` (PR #100 Settings shell + Splash, Fly v40) → `8f26668` (PR #102 shared UI: Toast/ImageCropper/ProtectedRoute, Fly v41) → `4f37316` (PR #104 retailer dashboard cluster: RetailerDashboard/StoreFormFields/KycUploadForm/AiBioModal, Fly v42) → `b8cedc6` (PR #106 design mockup parity: Store Profile + Messages rich rows + Map chips, Fly v43) → `a3eed69` (PR #108 mockup parity polish: Open 24h label + logo/tiles + drop stats row, Fly v44) → `7d81f04` (PR #110 Bright design system whole-app re-skin, Fly v45) → `73cc9f5` (PR #112 store/profile mockup parity: logo clip + distance pill + line-based bio read-more + Legal→Settings + blue Direction + hide BottomNav on post sheet, Fly v46) → `23e326e` (PR #114 PostCard header mockup parity: letter-fallback logo + softer ring + magenta-ink pin + compact "1.6 km" distance, Fly v47) → `1e151db` (PR #116 Home feed Quick Wins: skeleton loaders + pull-to-refresh + double-tap-to-like + heart-burst + haptics + empty states + silent-catch toasts, Fly v48) → `cafd795` (PR #118 smart feed ranking Phase A+B: saves×2 + last-24h-likes×2 in engagement, follow boost 15→20%, pinned +5%, store diversity cap, Redis seen-penalty, chat affinity +5%, category preference +10%, time-of-day +5%, Fly v49) → `300caa9` (PR #120 PostCard header rating + followers + restore missing area data via city/postalCode in feed include, Fly v50) → `83cc0d7` (PR #122 GPS pin → reverse geocode auto-fills pincode/city/state via new authed `/api/geocode/reverse` endpoint chaining Nominatim + India Post, Redis-cached 7d at ~110m precision, Fly v51) → `fe816c7` (PR #124 loading overlays for logo/cover/post-crop/edit-crop/chat-image uploads via shared UploadingOverlay component, Fly v52) → **`febae67`** (PR #126 multi-color design system: semantic palette + white header + outlined orange bell + solid magenta tabs + blue verified tick + solid gradient logo tile + semantic toast colors, status-pill colours UNTOUCHED per founder constraint, Fly v53); APK signed release built locally (not on `main`)

> **Note:** SESSION_LOG has a gap between Session 97 and Session 98 (~9 days, May 18 → May 27). At least one commit landed on main during that window that is not captured in the log. Backfill candidate for a future dedicated docs catch-up session.

### Final tally (6 of 7 closed)
- ✅ **Task 1** — Test user cleanup (13 non-admin users removed from prod Neon via defensive SQL; post-count = 1 admin only)
- ✅ **Task 2** — R2 CORS production config (origins: dukanchi.com / www.dukanchi.com / dukanchi-app.fly.dev; ExposeHeaders: ETag)
- ✅ **Task 3** — VAPID Web Push rotation (recovered from 11-min outage from placeholder-paste; new public key live; PushSubscription truncated)
- ✅ **Task 4** — Sentry alert rule "Production Errors — New + Escalated" (notify dukanchiapp@gmail.com; test notification verified)
- 🟡 **Task 5** — CSP allowlist (PR #43 prep landed; reportOnly mode; enforce flip pending 24-48h monitoring window)
- ✅ **Task 6** — `npm audit fix` (PR #47, 18 → 9 vulnerabilities; HIGH `tmp` Path Traversal closed; 9 residual all firebase-admin/exceljs chain, documented as ND-T6-1 + ND-T6-2)
- ✅ **Task 7** — APK rebuild + signed release (6.7 MB `app-release.apk` + new keystore at `~/Documents/dukanchi-keys/dukanchi-release.jks` outside repo; password in Apple Notes locked; iCloud backup verified; Google Drive backup queued as ND-D2-GDRIVE-BACKUP)

### Task 5 prep (CSP allowlist)
- PR #43 — `fonts.gstatic.com` added to connect-src (Workbox SW fetch context; prior policy only had it in font-src)
- CSP remains in **reportOnly mode** — enforce flip pending 24-48h clean Sentry window
- Audit ruled out speculative origins (Razorpay / Firebase web SDK / GTM not used in browser bundle)

### UX bonus (PR #44 — PWA banners feature flag)
- Both PWA install prompts on /home (top thin + bottom orange) now gated by `VITE_SHOW_PWA_PROMPTS` env (default false/unset)
- Terser DCE confirms zero banner strings in production bundle
- N5: Vite env vars are BUILD-TIME inlined — re-enable requires rebuild + redeploy with the env set in the Docker build context

### 🚨 ND-A1 — Browser push DEAD in production
- `public/sw.js` (hand-rolled, has push handler) is **overwritten** by VitePWA-generated Workbox SW at `vite build`
- Production ships Workbox SW WITHOUT a `push` event listener — browser/PWA push silently dropped
- Native Android (Capacitor APK + FCM) **unaffected** — separate pathway via firebase-admin → @capacitor/push-notifications
- **Pilot impact:** P1 (not P0) — majority pilot users expected on APK via founder GTM
- **Fix queued for Day 2 P1 (~2 hr):** VitePWA `generateSW` → `injectManifest` + custom `src/sw.ts`

### Day 2 backlog
| Priority | Item |
|---|---|
| 🆕 **P1** | ND-A1 fix — VitePWA injectManifest + custom src/sw.ts with push handler (~2 hr) |
| 🟡 **P2** | Task 5 CSP enforce flip — after 24-48h monitoring clean (target: 2026-05-28 23:00 IST onwards; ~15 min) |
| 🟡 **P2** | **ND-D2-APK-SMOKE** — Install signed APK on real device or Pixel 8 emulator; verify launch → loads dukanchi.com → login → basic flow (~10 min) |
| ⏳ **P3** | **ND-D1-IDEIGNORE** — Add `android/.idea/` to `.gitignore`; `git rm --cached -r android/.idea/` then commit (~5 min) |
| ⏳ **P3** | **ND-D2-GDRIVE-BACKUP** — Google Drive redundancy backup for keystore + APK (~5 min) |
| Parallel | UI enhancement (Mandeep, scope TBD) |
| Deferred | **ND-D2-VERIFIED-DEV** — Google "Verified Developer" registration via Play Console (pre-Play-Store milestone; within already-planned ₹2.1k Play Console fee) |
| ~~Closed~~ | ~~Task 6 npm audit fix~~ ✅ via PR #47 |
| ~~Closed~~ | ~~Task 7 APK rebuild + signed release~~ ✅ |
| ~~Closed~~ | ~~CSP comment `PR #41` → `PR #43` typo correction~~ ✅ via PR #46 |
| 📊 Observability | Sentry frontend project separation (deferred post-pilot) |
| 🛡️ Operational | Production redundancy — 2+ Fly machines or blue-green (Series A prep, L2 follow-through) |

### Day 1 Learnings (L1–L7, full text in SESSION_LOG Session 98)
- **L1** — Anti-pattern: `<paste...>` placeholder text in shell commands → always shell-substitute
- **L2** — Single-machine production risk — bad secret = guaranteed crash loop = full outage
- **L3** — Vite env vars are BUILD-TIME inlined — re-enable requires rebuild
- **L4** — Service Worker `fetch()` → `connect-src` (NOT font-src / img-src / style-src)
- **L5** — VitePWA `generateSW` overwrites hand-rolled SW — use `injectManifest` to preserve custom handlers
- **L6** — Keystore creation MUST pair with immediate password-manager save — generate via `openssl rand -hex 20` → save FIRST → then paste into AS dialog (never type fresh)
- **L7** — Keystore folder MUST live outside git repo — `~/Documents/dukanchi-keys/` is safe; never inside `Dukanchi-App/` even if gitignored (config drift risk)

## Legal Phase A — 18 May 2026

Status: ✅ Complete (pending deploy gates)
Branch: feat/legal-phase-a
Tests: 96/96 (was 85; +11 for legal consent + DPDP coverage)

### Routes live (10 pages)
- /legal/privacy (EN + HI)
- /legal/terms (EN + HI)
- /legal/account-deletion (EN + HI)
- /legal/grievance (EN + HI)
- /legal/cookies (EN + HI)

### Integration surfaces
- Customer profile → Legal menu section
- Retailer profile → "Legal & Privacy" card at foot
- LandingPage (public/landing.html + src/pages/LandingPage.tsx) → footer Legal column
- Signup form → consent checkbox enforced + backend recorded

### Backend additions
- LegalConsent table (additive Prisma migration: 20260518120000_add_legal_consent)
- Signup controller: transactional consent recording (1 consent row per signup, atomic with user.create)
- IP_SALT env (.min(32), fail-fast in production, dev fallback only)
- Audit log line (`legal.consent.recorded`) per consent record

### Pending pre-launch
- [ ] Apply migration to production DB (`prisma migrate deploy`)
- [ ] Fill grievance officer details (name + email + phone + postal)
- [ ] Fill registered company address
- [ ] Fill jurisdiction city
- [ ] Native APK rebuild + redistribute (signup payload changed)
- [ ] Confirm PostHog retention setting

### Phase B follow-ups
- Hard-delete cron job (currently soft-delete only, GRACE_DAYS=30)
- DNT signal handling
- Children's verifiable parental consent flow
- Lawyer review of baseline content
- Static rendering for SEO

## Futuristic v2 Redesign — MERGED & LIVE (Session 96)

**Status:** ✅ Complete and deployed to production (dukanchi.com). Three PRs merged to `main`, each verified green (typecheck 0 · tests 81/81 · build ✓) and confirmed live via asset-hash change:

- **PR #17** — futuristic v2 redesign (10 phases): `src/futuristic.css` (`--f-*` tokens) + `src/components/futuristic/` primitives; restyled Home, Search, Map, StoreProfile, Chat, Messages, Profile, Login, Signup, LandingPage + shared chrome (BottomNav, RefreshButton, NotificationBell, ConversationRow, profile/*). Three.js spatial hero on the landing (CDN-loaded, graceful fallback). **View-layer only** — all data/auth/Socket.IO/Maps/CMS wiring preserved verbatim (Rule 4).
- **PR #18** — dark app shell + native chrome: shell background → deep-space dark + dropped the legacy `pb-16` (fixed a cream strip under dark pages); `capacitor.config.ts` + `App.tsx` splash/status-bar → `#060814` dark.
- **PR #19** — Home + nav polish to the founder-approved mockup: circular gold header bell, "{area} nearby" location pill, three standalone tab pills, gradient-tile active bottom-nav.

Direction: deep-space dark + frosted glass + orange→magenta gradient ("Vision-OS"). From the `dukanchi-design-system` handoff.

**Scope boundary — still cream-themed** (not in the handoff): RetailerDashboard, UserSettings, Support, NotFound, and the `BrowserModeBanner` (top install strip).

**Open follow-ups (design backlog):**
- `LandingPage.tsx` restyled but NOT routed (pre-existing orphan; live `/landing` = static `public/landing.html`) — landing strategy TBD.
- Native APK: `npm run sync:android` done; **Android Studio rebuild + on-device smoke-test pending** — web-verified only.
- Native splash PNG image still cream-era (capacitor.config splash/status-bar colours already dark).
- The 4 still-cream screens above + `BrowserModeBanner` — restyle to futuristic v2 when scoped.

## Production State
- **URL:** https://dukanchi.com (Cloudflare proxied, SSL Full Strict, TLS 1.2 min)
- **Health:** `/health` → 200 OK
- **Services:** App + Redis + Neon DB + Cloudflare R2 — all green
- **Production code:** running `origin/main` HEAD `cd18d1a` (Session 98 — Day 1 Launch Sprint, PRs #43 CSP + #44 PWA banners feature flag + #47 npm audit fix; Session 96 Futuristic v2 + Hardening Sprint Days 1-8 underneath). Task 7 signed APK (6.7 MB) built locally — not committed to repo (lives in `android/app/release/` + iCloud backup).
- **Production DB schema:** Day 2 migrations APPLIED via `psql -f` (Session 87) — User soft-delete cols + Store GIST index + Product HNSW index + cube/earthdistance extensions live.
- **Code ↔ schema ALIGNED** ✅ — Day 8 atomic merge (`28a5614`) brought production application code up to the Day 2 schema. The intentional schema-ahead-of-code gap held since Session 87 is now closed.
- **Phase 0.4 audit hardening:** 19/19 fixes deployed ✅
- **B2B2C visibility:** Fully spec-compliant ✅ (Session 76)

## Day 8 — Atomic Merge & Production Verification (Session 95)

**Merge:** `28a5614` — `hardening/sprint` → `main` via `git merge --no-ff`, 60 commits, conflict-free (`ort`). 127 files (79 modified + 48 added), +15,421 / −2,006. Husky pre-push typecheck 0 errors.

**Crisis handled:** first deploy failed healthcheck (4:13) — `JWT_REFRESH_SECRET` missing on Railway; the Day 5 strict-env guard hard-failed boot **exactly as designed**. Fixed via `openssl rand -base64 48` → Railway env. Second deploy SUCCESS. Railway auto-rollback held prod on `32f5525` throughout — **zero customer-facing downtime**.

### Pre-Flight Infrastructure — all DONE ✅
- ✅ **Branch protection on `main`** — ACTIVE (classic rule, no force-push, no deletion)
- ✅ **`CODECOV_TOKEN`** — added to GitHub Actions secrets
- ✅ **UptimeRobot** — monitoring `/health` (5-min interval, US West)
- ✅ **Sentry full stack live** — DSN runtime + `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` (`dukanchi`) / `SENTRY_PROJECT` (`node-express`) in GitHub Actions + Railway

### Production Verification — PASSED ✅
- ✅ **Rule E smoke battery 5/5 GREEN** — `/health` 200 (1.46s), health body valid JSON, `POST /api/auth/login` 400 Zod-validation (not 500), `GET /api/posts` 401 "Access denied", `GET /` SPA 200 + helmet + HSTS headers
- ✅ **Sentry release `28a5614f591e`** — 333 files, 86 source maps uploaded, 100% crash-free
- ✅ **UptimeRobot** — zero downtime through the entire ~8-hour deploy window; 100% uptime maintained

### Post-Day-8 TODOs (priority order)
- **P1** — Rotate `CODECOV_TOKEN` within 24h (token visible in a screenshot during pre-flight Action 2)
- **P2** — Update RUNBOOK §6 smoke script — Curl 3 payload uses `password`, not `otp` (login schema is phone + password only)
- **P3** — `ALLOWED_ORIGINS` env cleanup — remove `http://localhost:3000` dev default from production
- **P3** — Add CI status check (`ci`) to the `main` branch protection rule (now that `ci` runs on `main` post-merge)

## Hardening Sprint — Days 1-8 COMPLETE (live on production @ `28a5614`)

- **Day 1 (Session 86):** TypeScript strict mode + tsconfig split — 114 → 0 type errors ✅
- **Day 2 (Session 87):** DB schema migrations + minimal `/api/account/{delete,restore}` endpoints ✅
- **Day 2.5 (Session 88):** Soft-delete cascade — auth middleware gates, cache invalidation, login/signup/refresh tightening, cascade reads, search filter helper, chat write-path + socket auth security fix (ND22), background cascade + D5 atomic FCM purge, social anonymize, Vitest infrastructure, 16 smoke tests, Rule F + Opus convention codified in CLAUDE.md ✅
- **Day 3 (Session 89):** Security gaps sprint — 5 subtasks shipped to branch ✅
  - 3.1 `2a5d029` — JWT algorithm whitelist (HS256 explicit on sign + verify)
  - 3.2 `4e4428d` — Tiered body limits (1MB global / 10MB AI) + 413 JSON handler
  - 3.3 `8a0b4e8` — Production-grade upload validation (fileSize + MIME + magic bytes + filename sanitization, file-type@3.9 shim)
  - 3.4 `6b9f434` — BCRYPT_ROUNDS env var (default 12) + bump 10→12 (backwards compatible)
  - 3.5 `e554914` — Request timeout coverage (server 60s + Gemini 30s + R2 60s + Prisma 30s)
  - +5 new tests (16→21 passing) — 1 JWT whitelist + 4 bcrypt rounds
- **Day 2.6 (Session 89.5):** Upload Scope 3 extras — 2 items shipped, 1 skipped via audit, 1 cleanup forensics ✅
  - Item 1 (per-route PDF whitelist) SKIPPED — audit invalidated premise (no PDF use case exists)
  - Item 2 + ND #2 `1c69852` — Admin rate-limiter applied to /api/admin/settings/upload (10/min) + standardHeaders on uploadLimiter (retry-after compliance)
  - Item 3 `96dc7fa` — Structured logging for upload events (event tags + userId + route + persistDurationMs + Sentry on persist_failed)
  - ND #3 — R2 cleanup: 11 smoke artifacts deleted (9 from Day 2.6 + 2 stragglers from Day 3) via temp/r2-cleanup-day26.ts forensic script
  - Rule F.2 codified in CLAUDE.md — storage isolation (extends Rule F to non-DB surfaces)
- **Day 4 (Session 90):** Observability Scope 2 — backend + frontend, graceful degradation, 7 product events ✅
  - `ea42840` — Backend Sentry release tag + request-ID propagation (X-Request-Id header + Sentry scope tag) + socket-listeners.ts 9 console.* → pino structured logs
  - `c7c0ef0` — Frontend Sentry (@sentry/react, sentry-frontend.ts), PostHog (posthog-js, EU instance), 7 product events (signup, login, store_created, post_created, ai_feature_used×3, search_performed, chat_message_sent), Vite source-map upload plugin (graceful)
  - 8 NDs documented and accepted (single-package layout, missing delete UI callsite, sequential req-id, 3-env-var plugin, dev opt-out, replay off-by-default, plugin-injected release, +130KB bundle)
  - Backend `console.*`: 26 → 17 (socket-listeners now 0)
- **Day 2.7 (Session 91):** Test Coverage Sprint — integration test scaffolding + 15 new tests ✅
  - `219160f` — `src/test-helpers/` directory (5 reusable factories: app-factory, fixtures, mock-prisma, mock-redis, jwt-helpers) + 7 auth integration tests (login × 4 paths, /me × 2, /refresh Day 2.5 carve-out)
  - `ec75f0f` — 8 security integration tests (upload magic-byte + size, body limit ×2 tiers, rate-limit 429 + Retry-After, JWT HS512 reject + HS256 accept positive control, bcrypt round-trip)
  - Deps: `supertest@7.2.2` + `@types/supertest@7.2.0` (devDeps only — runtime impact 0)
  - **21 → 36 tests** (+15 = +14 spec'd + 1 bonus T13b positive control)
  - 4 NDs documented (fixture bug fixed mid-flight; JWT iat byte-identical; T13b positive control kept; rate-limit-redis bypass via MemoryStore)
  - **0 production code touched** — test-only, invariant verified
- **Day 5 (Session 92):** Refresh Token Rotation + Admin Cookie Bug Fix — Auth0/Clerk-style industry-standard flow ✅
  - `969579e` — Backend: new `JWT_REFRESH_SECRET` env, `src/lib/redis-keys.ts` (90 lines), `src/services/refreshToken.service.ts` (439 lines, 5 public functions + RefreshTokenError class), auth.controller rewrite (setAuthCookies helper fixes ND #2 admin routing), auth.middleware type+jti checks, /refresh route handles its own user-status check (Day 2.5 carve-out preserved), X-Refresh-Token header fallback for native, pinoHttp+logger redact updates
  - `e6d0608` — Frontend: `src/lib/api.ts` rewrite with silent-refresh interceptor + native localStorage path, AuthContext.tsx auth:expired event listener, Login.tsx+Signup.tsx pass refreshToken, admin-panel axios interceptor
  - `d96146f` — Tests: 6 new refresh-flow integration tests via supertest + stateful in-memory Redis simulator (T1 rotation, T2 reuse+family revoke, T3 invalid sig, T4 no token, T5 logout blacklist, T6 admin cookies regression)
  - **36 → 42 tests** (+6 = matches Q8 Option A target)
  - 14 NDs documented + accepted (D1-D14)
  - 8 manual smokes (S1-S8) PASSED live against revived Neon TEST: customer login dual-cookies, /refresh rotation, reuse detection, admin cookie routing (ND #2 regression-proof live), logout token blacklist, prod-fail guard exits, X-Refresh-Token header path
  - **Neon TEST branch revived** in pre-flight (user task — Day 2.7 follow-up resolved)

- **Day 5.1 (Session 92.1):** Native APK Smoke — T1 live-validated + 3 production bugs shipped ✅
  - `131e86f` — `fix(auth)`: CORS Allow-Headers gap for X-Refresh-Token (Day 5 Phase 4 Q6 retroactive — curl smoke missed it because curl bypasses preflight)
  - `3a9b27d` — `fix(typecheck)`: 6 strict project-config errors hidden by verification protocol gap + CLAUDE.md Rule G codified (Day 4 + Day 5 retroactive)
  - `f106024` — `fix(api)`: resolveApiBase() runtime resolution for remote-load WebView origins (latent VITE_API_URL bug — never hit by production APK; surfaced by Day 5.1 server.url smoke; permanent non-revertable production-safety improvement)
  - **T1 live-validated** on Vivo X200 device 10BECN0KCN001RU — POST /api/auth/login → 200 → 22 subsequent API requests all 200 → home feed rendered end-to-end. All API calls correctly resolved to ngrok URL via resolveApiBase().
  - **T2-T6 deferred** — already covered by Phase 5 unit tests (42/42 mocked against stateful in-memory Redis simulator). User decision per Option B (pragmatic close).
  - **CLAUDE.md Rule G** added: use `npm run typecheck` (runs both web + server project configs), never `npx tsc --noEmit` alone
  - 13 NDs documented (D17-D29). 5 follow-up backlog items captured.

- **Day 6 (Session 93):** Tooling & CI Foundation — 6 phases, 6 commits, 0 reverts, all CI green ✅
  - `99f7039` — `feat(ci)`: GitHub Actions CI (Node 22, PR + push-to-main, 4 hard gates) + Husky two-tier hooks (pre-commit lint-staged + secret scan; pre-push typecheck) + Dependabot weekly Monday IST × 3 ecosystems. Closes ND-D6-1 + ND-D6-2.
  - `e40c854` — `feat(deps)`: xlsx → exceljs migration + `npm audit fix` transitive HIGH/MODERATE. 17 vulns (7 HIGH/2 MOD/8 LOW) → **8 vulns (0/0/8 LOW)**. Closes ND-D6-6. `.xls` legacy binary support dropped (exceljs limitation).
  - `2fde985` — `feat(ci)`: vitest v8 coverage (baseline 4.30/3.00/3.39/4.81 — statements/branches/functions/lines) + Codecov upload + bundle-size PR comment (preactjs/compressed-size-action, report-only). Closes ND-D6-4 + ND-D6-5. Surfaced ND-D6-PHASE3-1 (Codecov token required — Day 8 user manual action).
  - `59a8733` — `docs(day6)`: README.md rewrite (232 lines, 11 sections, 0 AI-Studio refs) + RUNBOOK.md NEW (324 lines, 8 sections, Day 8 atomic-merge checklist live) + vite.config.ts build guard rejecting localhost VITE_API_URL in production mode. Closes ND-D6-9 (audit) + ND-D6-11 + ND-D6-EXTRA-5.
  - `f429d38` — `docs(day6)`: RUNBOOK §9 (Sentry source maps provisioning) + §10 (UptimeRobot setup) + CI workflow forwarding Sentry secrets gracefully (build still succeeds with empty creds or 401 — verified). Closes ND-D6-3 + ND-D6-10.
  - This commit — Session 93 closure (SESSION_LOG + STATUS refresh).
  - **Metrics:** 5 CI runs, 5 green, avg ~1m15s. Tests 42/42 throughout. Typecheck 0 errors throughout. Branch advanced 49 → 54 ahead of `origin/main`.
  - **Day 8 user manual actions queued** (RUNBOOK §6): `CODECOV_TOKEN` secret, Sentry source-map secrets (Railway + GitHub), UptimeRobot signup + monitor, branch protection rules on `main`.

- **Day 7 (Session 94):** Deploy Hardening + Coverage Foundation — 5 phases, 5 commits, 0 reverts, all CI green ✅
  - `1fd853a` — `docs(day7)`: RUNBOOK §7 rewritten — R2 has no native versioning (Day 6 audit assumption corrected; pilot risk LOW; protection primitives table + 3 Day 7+ backlog items). Closes ND-D7-1 with corrected understanding.
  - `4434a4b` — `fix(admin-panel)`: dev port 5173 → 5174 + `strictPort: true`. Real bug was port collision (NOT React Router) — recon downgraded severity HIGH → MEDIUM. Production routing already correct. README dual-app workflow documented. Closes ND-D7-2.
  - `64d2313` — `chore(lint)`: ESLint v9 flat + Prettier + CI report-only (`continue-on-error: true`). Baseline: 448 ESLint problems / 174 Prettier-pending. Mirrors admin-panel preset for consistency. Hard rule honored: NO `--fix` / `--write` on existing code. Closes ND-D7-3 + ND-D7-4.
  - `4e81a04` — `test(coverage)`: +39 tests across 8 files (6 service routes × 4 tests + redis-keys + storeUtils unit tests). Coverage 4.30% → **7.26% statements** / **8.82% functions** (biggest gain — controllers + middleware now exercised). vitest thresholds promoted to new baseline floor. Closes ND-D7-5 with honest gap report (target 25-30% NOT reached; gap traces to service-mock architecture + frontend deferral).
  - This commit — Session 94 closure (SESSION_LOG + STATUS refresh).
  - **Metrics:** Tests 42 → **81** (+39, +93%). 5 CI runs all green. Typecheck 0 errors throughout. Branch advanced 54 → **60 ahead of `origin/main`**.
  - **All 5 Day 7 NDs closed** (ND-D7-1 through ND-D7-5). No new NDs surfaced. All 6 Q-D7 decisions approved with defaults.

- **Day 8 (Session 95):** Atomic Merge + Production Verification — **SPRINT CLOSED** ✅
  - `28a5614` — `feat`: Hardening Sprint atomic merge — Days 1-8 (60 commits). Conflict-free `--no-ff` merge. 127 files, +15,421 / −2,006.
  - Production HEAD `32f5525` → `28a5614` — first production runtime change of the entire sprint.
  - First deploy hit a healthcheck failure (`JWT_REFRESH_SECRET` missing on Railway); the Day 5 strict-env guard caught it; fixed + redeployed in <5 min; zero downtime via Railway auto-rollback.
  - Rule E smoke 5/5 GREEN; Sentry release `28a5614f591e` verified; UptimeRobot 100% uptime.

All Days 1–8 of the Hardening Sprint are **merged to `main` and live in production** (`28a5614`).

## Active Sprint: Hardening Sprint — Days 1-8 COMPLETE (100%) ✅

**Status:** SPRINT CLOSED. `hardening/sprint` merged to `main` via atomic `--no-ff` merge (`28a5614`); production deployed + Rule E verified.

| Day | Topic | Status |
|---|---|---|
| 1 (Session 86) | TS strict mode + tsconfig split | ✅ Done, pushed |
| 2 (Session 87) | DB schema + account endpoints | ✅ Done, schema on prod, code pushed |
| 2.5 (Session 88) | Soft-delete cascade (audit + impl + tests) | ✅ Done, pushed |
| 3 (Session 89) | Security: JWT alg + body limits + upload validation + bcrypt + timeouts | ✅ Done, pushed |
| 2.6 (Session 89.5) | Upload Scope 3 extras (admin rate-limiter + structured logging) + Rule F.2 + R2 cleanup | ✅ Done, pushed |
| 4 (Session 90) | Observability — backend Sentry tightening + frontend Sentry + PostHog + 7 product events | ✅ Done, pushed |
| 2.7 (Session 91) | Test Coverage Sprint — integration scaffolding + 15 new tests (21 → 36) | ✅ Done, pushed |
| 5 (Session 92) | Auth Refinements — access/refresh split, rotation, reuse detection, server-side logout, X-Refresh-Token header for native | ✅ Done, pushed |
| 5.1 (Session 92.1) | Native APK live smoke — T1 validated on Vivo X200; +3 production fixes shipped; Rule G codified | ✅ Done, pushed |
| 6 (Session 93) | Tooling & CI Foundation — GH Actions + Husky + Dependabot + coverage + bundle monitoring + xlsx→exceljs + README/RUNBOOK rewrite + Sentry/uptime docs + build guard | ✅ Done, pushed |
| 7 (Session 94) | Deploy Hardening — R2 strategy correction + admin-panel port 5174 + ESLint v9 + Prettier + coverage ramp (42 → 81 tests; 4.30 → 7.26% statements) | ✅ Done, pushed |
| **8 (Session 95)** | **Atomic merge `hardening/sprint` → `main` (60 commits, `28a5614`) + Railway deploy + Rule E smoke 5/5 + Sentry release verified + 4 pre-flight manual actions DONE** | **✅ Done, merged + LIVE** |

**Path B decision (Session 87)** — Project has no `_prisma_migrations` table on prod or test. Migrations applied via `psql -f`. Baseline-then-track setup queued as **Day 2.7** dedicated session.

**Test infrastructure** — Vitest 4.1.6, 21 smoke tests live (user-status helpers, auth middleware, JWT whitelist, bcrypt rounds). Comprehensive coverage deferred to **Day 2.7 Test Coverage Sprint**.

## Next 3 Actions

1. **Futuristic v2 follow-ups** — redesign PRs #17/#18/#19 are merged + live. Remaining: Android Studio APK rebuild + on-device smoke-test (web-verified only); decide `LandingPage.tsx` routing; design backlog — restyle the 4 still-cream screens (RetailerDashboard / UserSettings / Support / NotFound) + `BrowserModeBanner`.

2. **Day 8+ cleanup sweeps (now via PR per branch protection):**
   - ESLint baseline cleanup (448 problems; 333 `no-explicit-any` primary) → promote CI lint to hard-gate after
   - Prettier baseline cleanup (single `npm run format:fix`, 174 files, mechanical commit, no logic change)
   - Coverage ramp continuation — service-layer unmock for posts/search/messages (+10-15pt) + frontend jsdom infra (+5-10pt)

3. **Phase 0.5 — God Tier Vision kickoff** — Week 1-2 Discovery v2 (voice + image search). Branch off fresh from `main` @ `28a5614`.

> **Note:** `main` now has branch protection (require PR). All future merges go through PRs — the Day 8 atomic merge was the last direct push.

## Phase 0.5 — God Tier Vision (8 weeks, queued after Hardening Sprint)
- Week 1-2: Discovery v2 — Voice + Image search
- Week 3-4: Retention v2 — Smart personalized feed
- Week 5-6: Trust v2 — Verified retailers, anti-spam
- Week 7-8: Pilot launch — Bandra 200 retailers

## Open Decisions / Risks
- [ ] 🚨 **ND-A1 (Day 1, Session 98)** — Browser/PWA push delivery is DEAD in production. `public/sw.js` (hand-rolled, has `push` event listener) is overwritten by VitePWA's `generateSW`-output Workbox SW at `vite build`. Native Android (Capacitor + FCM) unaffected. Fix queued as Day 2 P1: switch VitePWA to `injectManifest` + custom `src/sw.ts` (~2 hr).
- [ ] **ND-D1-DOC1 (Day 1, Session 98)** — SESSION_LOG gap between Session 97 (`0658ee5`, May 18) and Session 98 start (`050dc62`, May 27). At least one main commit landed in that ~9-day window not captured in SESSION_LOG. Backfill candidate for a dedicated docs catch-up session.
- [ ] **ND-T6-1 (Day 1, Session 98, Task 6)** — 7 of 9 residual `npm audit` moderate vulns are in the `firebase-admin` dependency chain (firebase-admin direct + @google-cloud/firestore + @google-cloud/storage + google-gax + retry-request + teeny-request + gaxios — all share vulnerable `uuid<11.1.1`). Only fix path is downgrading `firebase-admin` from `>=11.0.0` to `10.3.0` (major drop) — would break FCM native push. Awaiting upstream `firebase-admin` 12.x/13.x with patched uuid.
- [ ] **ND-T6-2 (Day 1, Session 98, Task 6)** — 2 of 9 residual `npm audit` moderate vulns are `exceljs` (direct) + transitive `uuid`. Only fix path is downgrading `exceljs` from `>=3.5.0` to `3.4.0` (major drop) — would revert the Day 6 xlsx→exceljs migration (commit `e40c854`). Awaiting upstream `exceljs` 4.x with uuid bump.
- [ ] **ND-D1-IDEIGNORE (Day 1, Session 98, Task 7)** — `android/.idea/` should be gitignored. Currently `android/.idea/misc.xml` is tracked and shows modified on every Android Studio open. Fix: `git rm --cached -r android/.idea/` + add `android/.idea/` to `.gitignore` (~5 min, Day 2 P3).
- [ ] **ND-D2-VERIFIED-DEV (Day 1, Session 98, Task 7)** — Google "Verified Developer" registration required for Play Store distribution. Android Studio build dialog flagged: "This package name (App ID) is not registered by a verified developer." Zero impact on sideload soft launch; pre-Play-Store milestone. Register via Play Console (within already-planned ₹2.1k Play Console fee).
- [ ] **ND-D2-GDRIVE-BACKUP (Day 1, Session 98, Task 7)** — Google Drive redundancy backup for keystore + APK (iCloud backup already done). Day 2 P3, ~5 min.
- [ ] **ND-D2-APK-SMOKE (Day 1, Session 98, Task 7)** — Install signed APK (6.7 MB, `android/app/release/app-release.apk`) on real Android device or Pixel 8 emulator. Verify launch → loads dukanchi.com → login → basic flow. Day 2 P2, ~10 min.
- [ ] Bandra confirmed as pilot (founder may revise)
- [ ] Railway free trial ends in ~21 days — paid plan TBD
- [ ] HSTS enable after 1 month stable production (~June 2026)
- [ ] Railway project still named "handsome-charm"
- [x] ~~`hardening/sprint` is 60 commits ahead of `origin/main`~~ ✅ MERGED at Day 8 (`28a5614`). Branch retained for now; can be archived once Day 8+ cleanup sweeps land.
- [ ] **Day 5.2 — Bundled-mode Capacitor smoke** queued (~30 min). Build APK without server.url override (production-mirror mode); exercises cross-origin X-Refresh-Token CORS path on real device. Fills the Day 5.1 D20 gap (server.url smoke was same-origin, didn't directly test prod cross-origin path).
- [x] ~~**Day 5 deploy pre-flight TODO**: Provision `JWT_REFRESH_SECRET` in Railway~~ ✅ DONE during Day 8 deploy. The `env.ts` strict guard hard-failed the first deploy boot (missing var) — **worked exactly as designed** — caught + fixed in <5 min via `openssl rand -base64 48`. Railway auto-rollback held prod on `32f5525`; zero downtime.
- [ ] **Day 5.1 follow-up session**: Native (Capacitor) APK rebuild + manual test of silent-refresh flow on a real device. Backend + frontend code is 100% testable via mocks + curl, but the full native localStorage → X-Refresh-Token → retry round-trip needs a real device.
- [ ] Neon test branch `hardening-day2-test` auto-expires May 19 — fine, served its purpose
- [x] ~~Schema-ahead-of-code state on production~~ ✅ RESOLVED — Day 8 atomic merge aligned production code with the Day 2 schema.
- [ ] Day 2.7 (baseline `_prisma_migrations` table on prod + test coverage sprint) — separate focused session
- [ ] `temp/accidental-user-snapshot-2026-05-12T13-26-19Z.json` — forensic record from Session 88. Day 8 deploy succeeded → now eligible for `rm` (gitignored; cleanup at convenience).
- [ ] Day 3 backlog flagged but deferred:
  - ~~Scope 3 upload extras~~ ✅ shipped in Day 2.6 / Session 89.5 (Items 2+3; Item 1 PDF whitelist documented as ND — no use case)
  - Admin password length floor 6 chars (admin.service.ts:70) → separate concern
  - 4 pre-existing `console.log` statements (geminiEmbeddings.ts + search.service.ts) → future logger migration
- [ ] Day 2.6 backlog:
  - Dedicated `R2_BUCKET_NAME_TEST` env to eliminate Rule F.2 cleanup burden → Day 5+/Day 2.7 candidate
  - KYC-specific rate limiter (tighter cap than 10/min upload limit, e.g., 1/day) → Day 5+ candidate
  - xlsUpload rate-limit gap (`/api/stores/:storeId/bulk-import` only has generalLimiter + per-storeId daily cap) → low-priority backlog
- [ ] Day 4 backlog:
  - pinoHttp UUID upgrade — `genReqId: () => crypto.randomUUID()` 1-line change for distributed correlation → Day 5+
  - `account_delete_requested` PostHog event — wire when UI for /api/account/delete lands (helper already imported in AuthContext)
  - Bundle size chunking — manual chunks for @sentry/react + posthog-js to reduce +130KB critical-path → Day 5+
  - 17 remaining backend `console.*` calls — `search.service` (4), `geminiEmbeddings` (4), `push.routes` (2), `message.service` (1), `socket` (1), `redis` (4 pre-logger), `env` (1 pre-logger) → focused cleanup sprint
  - Sentry session replay opt-in decision — `replaysSessionSampleRate` bump above 0 awaits privacy review
- [ ] Day 2.7 backlog (carried):
  - ~~**Neon TEST branch revival**~~ ✅ DONE — Day 5 pre-flight Session 92.
  - `tsconfig.test.json` — Vitest currently uses internal esbuild; test files don't get production-strict typecheck. Low-priority cleanup.
  - Frontend component tests (React pages + Day 4 PostHog events) — needs `@testing-library/react` + jsdom infrastructure → future frontend-focused test sprint
  - Cascade integration tests (Priority 3 from Day 2.7 audit): `/api/account/delete` + FCM purge atomicity + cross-cascade reads → future test sprint
  - Socket auth E2E tests (Priority 4): io.use + per-message defense → future test sprint
  - Test suite runtime currently ~1s — well under any threshold worth optimizing
- [ ] **Day 6 backlog (carry — Day 7 partial follow-through):**
  - **Day 8 user manual actions (RUNBOOK §6 checklist) — all still pending:**
    - `CODECOV_TOKEN` GitHub repository secret (closes ND-D6-PHASE3-1) — ~3 min via codecov.io OAuth
    - `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` in **both** Railway env + GitHub secrets (completes ND-D6-3 provisioning) — ~5 min
    - UptimeRobot signup + monitor on `https://dukanchi.com/health`, 5-min interval, 30s timeout (completes ND-D6-10 follow-through) — ~5 min
    - Branch protection rules on `main` (Q-D6-6 manual GitHub action): require PR + required check = `ci` + no force-push — ~3 min
  - ~~Admin panel routing bug~~ ✅ shipped in Day 7 Phase 2 / `4434a4b` (real cause: port collision, not router; production already correct)
  - ~~ND-D6-8 ESLint + Prettier~~ ✅ shipped in Day 7 Phase 3 / `64d2313` (report-only initially per Q-D7-4; Day 8+ cleanup sweep queued)
  - **Coverage ramp 4% → 70%** — Day 7 lifted to 7.26%; still huge gap. Day 8+ multi-sprint effort. Mitigations queued (service unmock + jsdom infra).
  - **GH Actions Node 20 deprecation** — `actions/checkout@v4` + `actions/setup-node@v4` + `actions/github-script@*` all flagged for Node 24 default by 2026-06-02; full Node 20 removal 2026-09-16. 13 months runway; cheap to migrate to `@v5` when published.
  - **ND-D6-7 Staging environment** — Neon paid branch + Railway second env + DNS subdomain. Day 7+ candidate (~2 hr). Deferred to Series A scope.
  - **ND-D6-12 Pen test** — pre-launch external engagement (Phase 0.5 candidate).
  - **5 of 6 audit EXTRAs deferred** — commitlint (EXTRA-2), PR template (EXTRA-3), temp/ cleanup audit (EXTRA-4), console.* logger migration (EXTRA-1), scripts/ audit (EXTRA-6). All Day 8+.
- [ ] **Day 7 backlog (new):**
  - **ESLint baseline cleanup sweep** (Day 8+ atomic commit) — 448 problems / 333 `no-explicit-any` + 67 `no-unused-vars` + 9 `no-empty` + 4 `no-useless-escape` + 1 `no-extra-boolean-cast`. Phased: services → controllers → lib. After cleanup, promote CI lint from `continue-on-error: true` to hard-gate.
  - **Prettier baseline cleanup sweep** (Day 8+ atomic commit) — single `npm run format:fix` touches 174 files. Mechanical commit, no logic changes.
  - **Coverage ramp continuation** — service-layer unmock for posts/search/messages → est +10-15pt statements via deeper service LOC coverage with existing 24 service tests.
  - **Frontend test infra** (Q-D7-6 deferred) — jsdom + @testing-library/react + 5-10 React page tests → est +5-10pt statements.
  - **`notification.worker.ts` test** — 121 lines at 0%; 1 dedicated test file.
  - **`bulkImport.service.ts` permanent vitest test** — 290 lines at 0%; has Day 6 unit smoke via tsx but no permanent vitest test.
  - **R2 application-level key uniqueness audit** (RUNBOOK §7 carry) — verify all upload paths use UUID-keyed paths (~15 min).
  - **R2 Bucket Lock evaluation** for `/kyc/` and `/products/` prefixes (RUNBOOK §7 carry) — ~60 min Cloudflare work.
  - **Daily R2 backup snapshot** — Series A scope (~4-6 hr).

## Stack
| Layer | Tech |
|---|---|
| Backend | Express + TS + Prisma 5.22 + Socket.IO + Vitest 4.1 |
| Frontend | React 19 + Vite + Tailwind |
| DB | Neon Postgres 17 (Singapore) + pgvector 0.8.0 + cube + earthdistance |
| Cache | Redis (Railway internal) |
| Storage | Cloudflare R2 (dukanchi-prod) |
| Hosting | Railway us-west2 (Debian-slim Dockerfile, deploys from `main`) |
| Admin | /admin-panel/ (separate Vite SPA) |
