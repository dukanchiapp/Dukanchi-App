# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-16 | Session 95 closed | **Hardening Sprint Days 1-8 COMPLETE** — atomically merged to main + deployed | Prod runs main @ 28a5614
> Single-page snapshot. History → SESSION_LOG.md. Decisions → DECISIONS.md.

## Production State
- **URL:** https://dukanchi.com (Cloudflare proxied, SSL Full Strict, TLS 1.2 min)
- **Health:** `/health` → 200 OK
- **Services:** App + Redis + Neon DB + Cloudflare R2 — all green
- **Production code:** running `origin/main` HEAD `28a5614` (Session 95 — Hardening Sprint atomic merge, Days 1-8)
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

1. **Post-Day-8 hygiene** — see "Post-Day-8 TODOs" above. **P1 (rotate `CODECOV_TOKEN` within 24h) is time-sensitive**; P2/P3 are at-convenience.

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
