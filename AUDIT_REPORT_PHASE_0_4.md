# AUDIT REPORT — Phase 0.4 Production Audit
**Date:** 2026-05-04  
**App:** Dukanchi (B2B2C local retail discovery)  
**Deployed at:** https://dukanchi-app-production.up.railway.app  
**Stack:** Express + TypeScript + Prisma + Neon Postgres + Redis + Socket.IO + React 19 + Vite + Railway  

---

## Executive Summary — Top 5 Critical Issues

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | **IDOR: Any authenticated user can read another user's private data** (saved items, search history, locations) | HIGH | 30min |
| 2 | **Feed cache serves wrong per-user data** (likes, isOwnPost) to other users sharing the same role | HIGH | 30min |
| 3 | **ask-nearby loads ALL stores from DB into memory** on every request — unbounded growth problem | HIGH | 30min |
| 4 | **geminiEmbeddings.ts creates a second PrismaClient** — doubles Neon connection pool usage | HIGH | 5min |
| 5 | **No HEALTHCHECK in Dockerfile or Railway** — containers appear healthy before app is ready | HIGH | 5min |

---

## Findings

### 1. SECURITY

---

**SEC-001** `HIGH` — togglePin endpoint has no ownership check  
**File:** `src/modules/posts/post.service.ts:161`  
Any authenticated user can pin or unpin any post in any store. PostService.togglePin never verifies the caller owns the post.  
**Fix:** Fetch post + store, verify `store.ownerId === userId` before toggling. Pass `userId` through from PostController (which has `req.user.userId`).  
**Effort:** 30min

---

**SEC-002** `HIGH` — updateStore passes raw req.body — mass assignment risk  
**File:** `src/modules/stores/store.service.ts:37`  
`updateStore` spreads `{ ...data }` directly into `prisma.store.update`. A user can send `{ ownerId: "other-id", averageRating: 5.0, reviewCount: 9999 }` to overwrite any store column.  
**Fix:** Destructure only allowed fields in the controller before passing to service: `storeName, category, description, address, phone, latitude, longitude, openingTime, closingTime, workingDays, is24Hours, logoUrl, coverUrl, postalCode, city, state, phoneVisible, manualProductText, gstNumber, chatEnabled`.  
**Effort:** 30min

---

**SEC-003** `HIGH` — IDOR: user private endpoints don't verify caller owns the resource  
**File:** `src/modules/users/user.controller.ts:54`  
`GET /api/users/:id/saved`, `GET /api/users/:id/search-history`, `GET /api/users/:id/locations`, `GET /api/users/:id/reviews` accept an arbitrary `:id`. No check that `req.user.userId === req.params.id`. Any user can read another user's private data.  
**Fix:** Add a guard in each handler: `if (req.params.id !== req.user.userId && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });`  
**Effort:** 30min

---

**SEC-004** `HIGH` — AI endpoint accepts unlimited base64 payload  
**File:** `src/modules/ai/ai.controller.ts:29`  
`POST /api/ai/analyze-image` and `POST /api/ai/transcribe-voice` accept base64 strings up to the body parser limit of 50 MB. Single requests can exhaust memory or accumulate large Gemini API bills.  
**Fix:** Add a max-length check per field: `if (imageBase64.length > 5_000_000) return res.status(413).json({ error: 'Image too large' });`. Consider reducing the body parser limit on the `/api/ai` prefix to 10 MB.  
**Effort:** 30min

---

**SEC-005** `HIGH` — GEMINI_API_KEY not in Zod env schema — app starts silently without it  
**File:** `src/config/env.ts:6`  
`GEMINI_API_KEY` is never declared in `envSchema`. Accessed via `process.env.GEMINI_API_KEY!` (non-null assertion) in `geminiEmbeddings.ts` and `geminiVision.ts`. If absent in production, services throw or silently fail.  
**Fix:** Add `GEMINI_API_KEY: z.string().min(1)` to `envSchema`. Remove `!` assertions and use `env.GEMINI_API_KEY`.  
**Effort:** 5min

---

**SEC-006** `MEDIUM` — JWT decoded as `any` — no typed payload interface  
**File:** `src/middlewares/auth.middleware.ts:46`  
`jwt.verify` result cast as `any`. Downstream code accesses `decoded.userId`, `decoded.role`, `decoded.teamMemberId` without type safety. A crafted token can produce undefined values on sensitive checks.  
**Fix:** Define `interface JwtPayload { userId: string; role: string; teamMemberId?: string }` and cast to it. Add runtime validation of each field.  
**Effort:** 30min

---

**SEC-007** `MEDIUM` — Socket.IO CORS returns empty array if ALLOWED_ORIGINS not set in production  
**File:** `src/config/socket.ts:11`  
`getAllowedOrigins()` returns `[]` in production if `ALLOWED_ORIGINS` env var is missing — effectively blocking all WebSocket connections. Also, socket auth in `socket-listeners.ts` only checks `dk_token`, not `dk_admin_token`.  
**Fix:** Make `ALLOWED_ORIGINS` required in production env schema validation. Add `dk_admin_token` fallback in socket auth.  
**Effort:** 30min

---

**SEC-008** `MEDIUM` — File upload has no MIME type validation for local disk storage  
**File:** `src/middlewares/upload.middleware.ts:39`  
When `S3_BUCKET_NAME` is not set, local diskStorage multer has no `fileFilter`. Any file type including `.html`, `.js`, `.php` can be uploaded and served back via `express.static('/uploads')`. Enables stored XSS.  
**Fix:** Add `fileFilter` to local storage accepting only `image/jpeg, image/png, image/webp, image/gif`. Add `limits: { fileSize: 10 * 1024 * 1024 }`.  
**Effort:** 30min

---

**SEC-009** `MEDIUM` — Team member minimum password is only 4 characters  
**File:** `src/modules/team/team.service.ts:27`  
Team members are created with a 4-character minimum password. Main users require 8 characters. Team members have the same JWT access level as store owners.  
**Fix:** Increase minimum team member password to 8 characters.  
**Effort:** 5min

---

**SEC-010** `MEDIUM` — ask-nearby rate limiting is in-memory only — not distributed  
**File:** `src/modules/ask-nearby/ask-nearby.service.ts:16`  
Hourly rate limiter uses an in-memory Map. On multi-instance deployments the limit is per-process. Restarting the process resets all limits.  
**Fix:** Replace with Redis `INCR + EXPIRE` (same pattern used in `BulkImportService.checkRateLimit`).  
**Effort:** 30min

---

**SEC-011** `MEDIUM` — AI controller rate limiting is in-memory only  
**File:** `src/modules/ai/ai.controller.ts:5`  
Same problem as SEC-010. Per-user rate limits in an in-memory Map — not shared across processes or instances.  
**Fix:** Use Redis for per-user AI rate limiting.  
**Effort:** 30min

---

**SEC-012** `MEDIUM` — `credentials: 'include'` in server-side Node.js fetch calls  
**File:** `src/services/geminiEmbeddings.ts:16`  
`credentials: 'include'` is a browser-only fetch option, silently ignored in Node.js. Indicates copy-paste from browser code. No functional impact currently but signals code hygiene issue.  
**Fix:** Remove `credentials: 'include'` from all server-side fetch calls.  
**Effort:** 5min

---

**SEC-013** `LOW` — Hardcoded protected admin UUID in multiple files  
**File:** `server.ts:16` and `src/modules/admin/admin.service.ts`  
`PROTECTED_ADMIN_ID = '5cbf1a3d-e8e7-4b64-836a-58475bbbb7d9'` is hardcoded in source and visible in the public GitHub repo.  
**Fix:** Move to an env var `ADMIN_USER_ID`, or derive from `ADMIN_PHONE` at startup.  
**Effort:** 30min

---

**SEC-014** `LOW` — Logout endpoint has no CSRF protection  
**File:** `src/modules/auth/auth.controller.ts:67`  
`POST /api/auth/logout` clears auth cookies with no authentication requirement and no CSRF token. Cross-site requests can forcibly log out any user.  
**Fix:** Apply `authenticateAny` middleware to the logout route, or add a simple CSRF token check.  
**Effort:** 30min

---

**SEC-015** `LOW` — SENTRY_DSN not in env schema — production errors go unmonitored if var is missing  
**File:** `src/config/env.ts:6`  
`SENTRY_DSN` is read directly from `process.env` in `sentry.ts`, not validated by Zod. If absent, Sentry silently disables with only a `logger.warn`.  
**Fix:** Add `SENTRY_DSN: z.string().url().optional()` to `envSchema`.  
**Effort:** 5min

---

### 2. PERFORMANCE

---

**PERF-001** `HIGH` — ask-nearby loads ALL stores from DB into memory on every request  
**File:** `src/modules/ask-nearby/ask-nearby.service.ts:39`  
`sendAskNearby` calls `prisma.store.findMany()` with no `WHERE` clause — fetches every store in the DB and filters by radius in JavaScript.  
**Fix:** Use a bounding box `WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?` pre-filter before computing exact Haversine distance. The `@@index([latitude, longitude])` already exists.  
**Effort:** 30min

---

**PERF-002** `HIGH` — N+1 query: one DB write per matched store in ask-nearby loop  
**File:** `src/modules/ask-nearby/ask-nearby.service.ts:86`  
`AskNearbyResponse` records are created one at a time inside a for-loop — up to 15 sequential Postgres round-trips.  
**Fix:** Replace loop with `prisma.askNearbyResponse.createMany({ data: matched.map(store => ({ requestId, storeId: store.id, ownerId: store.ownerId })) })`.  
**Effort:** 30min

---

**PERF-003** `HIGH` — Feed fetches up to 150 posts then scores in-memory  
**File:** `src/modules/posts/post.service.ts:89`  
`getFeed` fetches `take: limit * 3` (up to 150 posts with full includes: store, product, likes, _count) then sorts in JavaScript. 3x over-fetch on every feed page load.  
**Fix:** Move scoring into SQL `ORDER BY` CASE expressions, or implement a proper feed ranking table. At minimum, reduce over-fetch multiplier and implement cursor-based pagination.  
**Effort:** 2hr

---

**PERF-004** `HIGH` — getConversations loads 500 messages and deduplicates in memory  
**File:** `src/modules/messages/message.service.ts:33`  
Fetches latest 500 messages with sender/receiver includes and deduplicates with a JavaScript Map. O(n) memory operation per API call.  
**Fix:** Use `$queryRaw` with `DISTINCT ON (conversation_pair)` to get one row per conversation at DB level.  
**Effort:** 2hr

---

**PERF-005** `HIGH` — geminiEmbeddings.ts creates a second PrismaClient instance  
**File:** `src/services/geminiEmbeddings.ts:5`  
`const prisma = new PrismaClient()` creates a second separate connection pool. Doubles Neon connection pool usage — critical with Neon's serverless connection limits.  
**Fix:** Import the shared singleton: `import { prisma } from '../config/prisma';`  
**Effort:** 5min

---

**PERF-006** `MEDIUM` — Feed cache key excludes userId — users share wrong cached feed  
**File:** `src/modules/posts/post.controller.ts:27`  
Cache key is `feed:{userRole}:p{page}:l{limit}`. Multiple users with the same role share cached feeds containing per-user like states and `isOwnPost` flags.  
**Fix:** Include `userId` in cache key: `feed:{userId}:p{page}:l{limit}`. Or separate cacheable data from per-user data.  
**Effort:** 30min

---

**PERF-007** `MEDIUM` — refreshVocabulary called on every GET /api/search/suggestions request  
**File:** `src/modules/search/search.service.ts:140`  
`refreshVocabulary(prisma)` is called inline on every suggestions request. The 5-minute guard still runs a `Date.now()` check and Set/Array operations on every call.  
**Fix:** Remove `refreshVocabulary` from the request path. The server.ts 5-minute interval is sufficient.  
**Effort:** 30min

---

**PERF-008** `MEDIUM` — Product embedding issues one raw UPDATE per product in a loop  
**File:** `src/services/geminiEmbeddings.ts:75`  
`embedProductBatch` issues one `$executeRaw UPDATE` per product sequentially. For 1000-product bulk imports: 1000 Postgres round-trips.  
**Fix:** Use a batched `UNNEST`-based UPDATE: `UPDATE "Product" SET embedding = t.emb FROM (SELECT unnest($ids::uuid[]) id, unnest($vectors::vector[]) emb) AS t WHERE "Product".id = t.id`.  
**Effort:** 2hr

---

**PERF-009** `MEDIUM` — Admin getChats fetches limit×10 messages and deduplicates in memory  
**File:** `src/modules/admin/admin.service.ts:300`  
Same pattern as PERF-004. Fetches 200 messages (20 × 10) and groups into conversations in JavaScript.  
**Fix:** Use raw SQL `DISTINCT ON` query for latest message per conversation pair.  
**Effort:** 2hr

---

**PERF-010** `LOW` — Missing pg_trgm GIN index on Product.productName, brand, description  
**File:** `prisma/schema.prisma:110`  
Search queries filter on `productName`, `brand`, `description` using `ILIKE`. No GIN trigram index. Full table scans on every search.  
**Fix:** Create GIN indexes: `CREATE INDEX idx_product_name_trgm ON "Product" USING gin (productName gin_trgm_ops)`. Add as a Prisma migration.  
**Effort:** 30min

---

**PERF-011** `LOW` — getProducts has no pagination — hardcoded take:50  
**File:** `src/modules/stores/store.service.ts:148`  
`take: 50` hardcoded with a comment "Legacy behaviour". No cursor or page support. Stores with thousands of products cannot be paginated.  
**Fix:** Add cursor-based pagination parameters (`cursor`, `limit`) to the endpoint.  
**Effort:** 30min

---

### 3. RELIABILITY / ERROR HANDLING

---

**RELIABILITY-001** `HIGH` — Notification worker emits N socket events for N followers — blocks BullMQ event loop  
**File:** `src/workers/notification.worker.ts:32`  
After bulk-creating notifications, the worker fetches ALL notifications for the post then emits a socket event per user in a for-loop. For a store with 10,000 followers: 10,000 sequential socket emits blocking the worker — causes job timeout.  
**Fix:** Pass notification data directly to socket emit inside the createMany chunk loop. Remove the separate `findMany` call. Or emit a single store-broadcast event and let clients pull.  
**Effort:** 2hr

---

**RELIABILITY-002** `HIGH` — Prisma connection pool not configured — defaults to 10 connections  
**File:** `src/config/prisma.ts:5`  
`PrismaClient` instantiated with no `connection_limit`. With BullMQ workers + main app + geminiEmbeddings (second pool), the default 10-connection pool will be exhausted under load, causing P2024 timeouts.  
**Fix:** Add `?connection_limit=5` (or appropriate value) to `DATABASE_URL`. Document in `.env.example`. Use Neon's PgBouncer pooling endpoint for the connection string.  
**Effort:** 30min

---

**RELIABILITY-003** `MEDIUM` — Graceful shutdown does not drain BullMQ worker  
**File:** `server.ts:107`  
The `shutdown` function closes HTTP, Prisma, and Redis but never calls `notificationWorker.close()`. In-flight BullMQ jobs are interrupted, potentially leaving orphaned notifications.  
**Fix:** Export `notificationWorker` from `notification.worker.ts` and call `await notificationWorker.close()` in `shutdown` before disconnecting Redis.  
**Effort:** 30min

---

**RELIABILITY-004** `MEDIUM` — Socket sendMessage silently drops messages with no client feedback  
**File:** `src/config/socket-listeners.ts:49`  
When `canChat` returns false or sender/receiver is not found, the handler does a silent return. The sender receives no error event and believes the message was sent.  
**Fix:** Emit an error event back to sender: `socket.emit('messageError', { error: 'Could not deliver message' })`.  
**Effort:** 30min

---

**RELIABILITY-005** `MEDIUM` — Health check endpoint registered twice  
**File:** `src/app.ts:101` and `src/app.ts:153`  
`GET /health` is registered on line 101 (before rate limiter) and again on line 153. The second registration is dead code.  
**Fix:** Remove the duplicate `app.get('/health', ...)` on line 153.  
**Effort:** 5min

---

**RELIABILITY-006** `MEDIUM` — createReview has no duplicate prevention  
**File:** `src/modules/misc/misc.service.ts:49`  
`MiscService.createReview` creates reviews without checking for duplicates. Users can review the same store unlimited times, inflating `averageRating`.  
**Fix:** `prisma.review.findFirst({ where: { userId, storeId } })` before creating. Throw if exists.  
**Effort:** 30min

---

**RELIABILITY-007** `LOW` — refreshVocabulary interval errors are logged but not alerted  
**File:** `server.ts:100`  
Recurring vocabulary refresh failures are swallowed with a logger.error. The server continues with stale vocabulary silently.  
**Fix:** Capture repeated failures to Sentry or increment a metric for alerting.  
**Effort:** 30min

---

### 4. BROKEN FLOWS / BUGS

---

**BUGS-001** `HIGH` — Feed cache serves wrong per-user data (duplicate of PERF-006 — critical enough for both categories)  
**File:** `src/modules/posts/post.controller.ts:27`  
Cache key `feed:{userRole}:p{page}:l{limit}` causes user B to see user A's liked status and incorrect `isOwnPost` flags.  
**Fix:** See PERF-006.  
**Effort:** 30min

---

**BUGS-002** `MEDIUM` — updateStore does not invalidate HTTP Cache-Control on store detail  
**File:** `src/modules/stores/store.controller.ts:129`  
`getStoreById` sets `Cache-Control: public, max-age=30`. `updateStore` never invalidates it. Clients (and CDNs) may serve stale store data for 30s+ after updates.  
**Fix:** Reduce `max-age` to 10s, or add `Cache-Tag: store-{id}` and purge on update. Or change to `private` caching only.  
**Effort:** 30min

---

**BUGS-003** `MEDIUM` — isUserBlocked cache not invalidated when admin blocks a user  
**File:** `src/middlewares/auth.middleware.ts:11`  
`blocked:{userId}` Redis cache has a 60s TTL. When admin blocks a user, the cache is never explicitly invalidated. The user can continue making requests for up to 60 seconds.  
**Fix:** In `AdminService.updateUser` and `bulkUpdateUsers`, call `await pubClient.del(\`blocked:${id}\`)` after updating `isBlocked`.  
**Effort:** 30min

---

**BUGS-004** `MEDIUM` — Bulk import rate limit has INCR+EXPIRE race condition  
**File:** `src/modules/stores/bulkImport.service.ts:137`  
`INCR` and `EXPIRE` are two separate commands, not atomic. If the server crashes between them, the key persists forever and future imports are permanently blocked.  
**Fix:** Use `SET key 1 EX 86400 NX` for the first write, then `INCR` for subsequent ones. Or use a Lua script.  
**Effort:** 30min

---

**BUGS-005** `LOW` — createStore spreads req.body including unexpected columns  
**File:** `src/modules/stores/store.controller.ts:52`  
`const storeData = { ...req.body, ownerId }` spreads all request body fields. New Prisma model columns added in the future may be unintentionally populated.  
**Fix:** Define an explicit allowlist DTO for store creation instead of spreading `req.body`.  
**Effort:** 30min

---

### 5. CODE QUALITY

---

**QUALITY-001** `HIGH` — admin.service.ts is 529 lines — monolithic service  
**File:** `src/modules/admin/admin.service.ts:1`  
Handles users, stores, team members, KYC, complaints, reports, chats, posts, settings, and exports in a single class. Violates single responsibility.  
**Fix:** Split into: `AdminUserService`, `AdminStoreService`, `AdminKycService`, `AdminChatService`, `AdminSettingsService`.  
**Effort:** 1day

---

**QUALITY-002** `MEDIUM` — Pervasive `data: any` in service method signatures  
**File:** `src/modules/auth/auth.service.ts:10` and ~9 other service files  
`AuthService.signup(data: any)`, `StoreService.createStore(data: any)`, `PostService.createPost(data: any)`, etc. TypeScript cannot catch field name errors or missing fields.  
**Fix:** Use `z.infer<typeof schema>` from existing Zod schemas to type all service method inputs.  
**Effort:** 2hr

---

**QUALITY-003** `MEDIUM` — console.log/warn/error used instead of pino logger in several files  
**Files:** `src/modules/search/search.service.ts:117,133,279,296`, `src/modules/stores/store.service.ts:57`, `src/config/socket-listeners.ts:49,78`  
Bypasses the structured pino logger — loses request IDs, log levels, and JSON formatting in production.  
**Fix:** Replace all `console.*` calls with `import { logger } from './lib/logger'` and use `logger.info/warn/error`.  
**Effort:** 30min

---

**QUALITY-004** `LOW` — OFFSET-based pagination on large tables  
**File:** `src/modules/admin/admin.service.ts:49` and multiple other files  
`AdminService.getUsers/getStores/getReports/etc.` and `StoreService.getStorePosts` all use `skip: (page-1)*limit`. Deep pagination requires Postgres to scan and discard all preceding rows.  
**Fix:** Migrate high-volume tables (posts, messages, notifications) to cursor-based pagination. Admin tables are lower priority.  
**Effort:** 2hr

---

**QUALITY-005** `LOW` — createPost doesn't verify the JWT user owns the storeId  
**File:** `src/modules/posts/post.service.ts:14`  
`PostService.createPost` accepts `data.storeId` without verifying the caller owns that store. A retailer can create posts for any store by sending another store's `storeId`.  
**Fix:** Fetch the store and verify `store.ownerId === jwtUser.userId` before creating the post.  
**Effort:** 30min

---

**QUALITY-006** `LOW` — storeId ownership check in createProduct can be bypassed  
**File:** `src/modules/stores/store.controller.ts:164`  
The ownership check is wrapped in `if (storeId)` — if `storeId` is omitted, the check is skipped entirely.  
**Fix:** Return 400 if `storeId` is missing rather than conditionally checking ownership.  
**Effort:** 5min

---

### 6. INFRASTRUCTURE / DEVOPS

---

**INFRA-001** `HIGH` — No HEALTHCHECK in Dockerfile  
**File:** `Dockerfile:38`  
No `HEALTHCHECK` instruction. Docker cannot detect if the app entered a broken state. The container is marked healthy immediately when the CMD process starts.  
**Fix:** Add:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```
**Effort:** 5min

---

**INFRA-002** `HIGH` — tsx used in production — TypeScript transpiled at runtime  
**File:** `Dockerfile:38`  
`CMD ["node_modules/.bin/tsx", "server.ts"]` runs TypeScript directly in production. tsx is a development tool — adds startup overhead and type errors are not caught at build time.  
**Fix:** Add an esbuild or tsc server-side build step and run `node dist/server.js` in production.  
**Effort:** 2hr

---

**INFRA-003** `MEDIUM` — .dockerignore is incomplete  
**File:** `.dockerignore:1`  
Excludes root `node_modules/` but not `admin-panel/node_modules/`, `admin-panel/dist/`, `*.log`, `.env.*`, `coverage/`, `.git/`. Bloats the Docker build context unnecessarily.  
**Fix:** Add: `admin-panel/node_modules/`, `admin-panel/dist/`, `*.log`, `.env*`, `!.env.example`, `coverage/`, `.git/`.  
**Effort:** 5min

---

**INFRA-004** `MEDIUM` — Railway healthcheck not configured in railway.json  
**File:** `railway.json:1`  
No `healthcheckPath` or `healthcheckTimeout`. Railway uses TCP connection success as readiness — fires before Express finishes loading routes and connecting Redis.  
**Fix:** Add to `railway.json`:
```json
"deploy": {
  "healthcheckPath": "/health",
  "healthcheckTimeout": 30,
  ...
}
```
**Effort:** 5min

---

**INFRA-005** `MEDIUM` — GEMINI_API_KEY and other production vars missing from .env.example  
**File:** `.env.example:1`  
`GEMINI_API_KEY`, `SENTRY_DSN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_MAILTO` are not documented in `.env.example`. New developers will miss them.  
**Fix:** Add all missing vars as empty-value placeholders to `.env.example`.  
**Effort:** 5min

---

**INFRA-006** `LOW` — No prisma migrate deploy in Dockerfile/startup  
**File:** `Dockerfile:38`  
The Dockerfile generates the Prisma client but does not run `prisma migrate deploy`. Schema changes require a manual migration step or the app starts with an outdated schema.  
**Fix:** Change CMD to:
```dockerfile
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node_modules/.bin/tsx server.ts"]
```
**Effort:** 5min

---

### 7. UX / PRODUCT GAPS

---

**UX-001** `MEDIUM` — Login/Signup forms have no loading spinner *(known issue in CLAUDE.md)*  
**File:** `src/context/AuthContext.tsx:27`  
Users see a non-responsive button or blank screen during auth operations. `AuthContext` tracks `isLoading` but the Login/Signup components don't consume it.  
**Fix:** Show a spinner in Login.tsx and Signup.tsx during form submission and while `isLoading` is true.  
**Effort:** 30min

---

**UX-002** `MEDIUM` — Silent errors on like/save/follow interactions *(known issue in CLAUDE.md)*  
**File:** `src/modules/posts/post.controller.ts:60`  
API failures for `toggleLike`, `toggleSave`, `toggleFollow` are swallowed silently on the frontend. Users get no feedback on failure. `ToastContext` is already set up.  
**Fix:** Catch errors in frontend action handlers and call `useToast()` with an error message.  
**Effort:** 30min

---

**UX-003** `LOW` — Home feed lacks cursor-based infinite scroll *(known issue in CLAUDE.md)*  
**File:** `src/modules/posts/post.service.ts:44`  
OFFSET-based pagination causes duplicate posts when new items are inserted between page fetches, and degrades at high page numbers.  
**Fix:** Implement cursor-based pagination using `createdAt` + `id` as the cursor.  
**Effort:** 2hr

---

## Summary Statistics

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 16 |
| MEDIUM | 22 |
| LOW | 14 |
| **Total** | **52** |

---

## Recommended Fix Order — Top 10 for Maximum Impact

| Priority | ID | Issue | Time |
|----------|-----|-------|------|
| 1 | PERF-005 | Import shared Prisma singleton in geminiEmbeddings.ts | 5min |
| 2 | INFRA-001 | Add HEALTHCHECK to Dockerfile | 5min |
| 3 | INFRA-004 | Add healthcheckPath to railway.json | 5min |
| 4 | SEC-005 | Add GEMINI_API_KEY to Zod env schema | 5min |
| 5 | BUGS-001 / PERF-006 | Fix feed cache key to include userId | 30min |
| 6 | SEC-003 | Add IDOR guard to user private data endpoints | 30min |
| 7 | SEC-002 | Allowlist fields in updateStore — fix mass assignment | 30min |
| 8 | BUGS-003 | Invalidate Redis blocked-user cache on admin block action | 30min |
| 9 | PERF-001 / PERF-002 | Fix ask-nearby DB load (bounding box + createMany) | 30min |
| 10 | RELIABILITY-001 | Fix notification worker N×socket-emit loop | 2hr |

**Running total for top 10: ~4 hours**

---

## Notes

- Issues marked *(known issue in CLAUDE.md)* are already tracked in the project's active issues section.
- INFRA-002 (tsx in production) is a deliberate trade-off given the current build setup — fix when stability is proven and a proper build pipeline is warranted.
- QUALITY-001 (splitting admin.service.ts) is the largest refactor — do after all critical/high issues are resolved.
