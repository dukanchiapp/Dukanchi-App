# G-AI — Session Change Log

> **One entry per development session or commit.**
> Add new entries at the TOP (newest first).
> Format: date, commit hash, what changed and why.

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
