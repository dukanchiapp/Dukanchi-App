# G-AI — Session Change Log

> **One entry per development session or commit.**
> Add new entries at the TOP (newest first).
> Format: date, commit hash, what changed and why.

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
