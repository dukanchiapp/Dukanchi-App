# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-14 | Session 92.1 closed | Branch: hardening/sprint @ Day 5.1 head (4 commits added this session, push pending) | Prod runs main @ 32f5525
> Single-page snapshot. History → SESSION_LOG.md. Decisions → DECISIONS.md.

## Production State
- **URL:** https://dukanchi.com (Cloudflare proxied, SSL Full Strict, TLS 1.2 min)
- **Health:** `/health` → 200 OK
- **Services:** App + Redis + Neon DB + Cloudflare R2 — all green
- **Production code:** running `origin/main` HEAD `32f5525` (Session 85 — Sentry production-grade)
- **Production DB schema:** Day 2 migrations APPLIED via `psql -f` (Session 87) — User soft-delete cols + Store GIST index + Product HNSW index + cube/earthdistance extensions live. **Additive schema, safe with older code.**
- **Production application code is BEHIND the schema**: Session 85 code doesn't reference any of Day 2's new columns/indexes. Intentional state until Day 8 atomic merge.
- **Phase 0.4 audit hardening:** 19/19 fixes deployed ✅
- **B2B2C visibility:** Fully spec-compliant ✅ (Session 76)

## Hardening sprint code (on `hardening/sprint`, NOT yet on production)

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

All Days 1+2+2.5+3+2.6+4+2.7+5 committed AND pushed to `origin/hardening/sprint`. Day 5.1 (this session) committed locally — push pending.

Branch is **49 commits ahead of `origin/main`** (was 45 at start of Session 92.1; +4 this session: 3 production fix + 1 docs).

## Active Sprint: Hardening Sprint (Days 1-4 + 2.6 + 2.7 of 8 — 69% complete)

**Branch:** `hardening/sprint` @ Day 2.7 head (local, unpushed)
**Deploy plan:** **Day 8 atomic merge** `hardening/sprint` → `main` → Railway redeploy + full Rule E verification

| Day | Topic | Status |
|---|---|---|
| 1 (Session 86) | TS strict mode + tsconfig split | ✅ Done, pushed |
| 2 (Session 87) | DB schema + account endpoints | ✅ Done, schema on prod, code pushed |
| 2.5 (Session 88) | Soft-delete cascade (audit + impl + tests) | ✅ Done, pushed |
| 3 (Session 89) | Security: JWT alg + body limits + upload validation + bcrypt + timeouts | ✅ Done, pushed |
| 2.6 (Session 89.5) | Upload Scope 3 extras (admin rate-limiter + structured logging) + Rule F.2 + R2 cleanup | ✅ Done, pushed |
| 4 (Session 90) | Observability — backend Sentry tightening + frontend Sentry + PostHog + 7 product events | ✅ Done, pushed |
| 2.7 (Session 91) | Test Coverage Sprint — integration scaffolding + 15 new tests (21 → 36) | ✅ Done, push pending |
| 5 (Next) | Auth Refinements — access/refresh split, rotation, reuse detection, server-side logout, CSRF | ⏳ Pending; **REQUIRES Neon TEST branch revival first** |
| 6-7 | Remaining sprint days (CI/Docker is Day 6, perf/UX Day 7) | Planned |
| 8 | Atomic merge to main + production deploy + verification | Planned |

**Path B decision (Session 87)** — Project has no `_prisma_migrations` table on prod or test. Migrations applied via `psql -f`. Baseline-then-track setup queued as **Day 2.7** dedicated session.

**Test infrastructure** — Vitest 4.1.6, 21 smoke tests live (user-status helpers, auth middleware, JWT whitelist, bcrypt rounds). Comprehensive coverage deferred to **Day 2.7 Test Coverage Sprint**.

## Next 3 Actions

1. **Day 4 sequencing decision** (next session prompt — starter template at `temp/day-4-starter-prompt.md`)
   - **Candidate A (recommended) — Day 4 Observability:** Sentry middleware tightening, error handler unification, PostHog wiring (frontend product analytics queued). Recommended first because Sentry is already partially configured (Session 85 production-grade base), so this is the natural extension and lowest-friction next step.
   - **Candidate B — Day 2.6 Scope 3 upload extras:** per-route MIME tightening, admin-only PDF whitelist, S6 rate-limiter
   - **Candidate C — Day 2.7 Test Coverage Sprint:** cascade integration tests, socket auth E2E, D5 atomicity, fixtures, CI wiring

2. **Day 5-7 — Remaining sprint days** (sequencing depends on Day 4 choice)

3. **Day 8 — Atomic merge + deploy** (after Days 4-7 complete)
   - `git checkout main && git merge hardening/sprint --no-ff && git push origin main`
   - Railway auto-redeploys; full Rule E curl battery on production
   - Sentry + Railway log spot-check
   - Cleanup `temp/accidental-user-snapshot-*.json` after green deploy

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
- [ ] `hardening/sprint` is **49 commits ahead of `origin/main`** — intentional, merges at Day 8
- [ ] **Day 5.2 — Bundled-mode Capacitor smoke** queued (~30 min). Build APK without server.url override (production-mirror mode); exercises cross-origin X-Refresh-Token CORS path on real device. Fills the Day 5.1 D20 gap (server.url smoke was same-origin, didn't directly test prod cross-origin path).
- [ ] **Day 5 deploy pre-flight TODO**: Provision `JWT_REFRESH_SECRET` in Railway dashboard before Day 8 merge. Generate via `openssl rand -base64 48`. Server hard-fails boot in production if still using the dev fallback (env.ts post-parse guard, verified live in S7 smoke).
- [ ] **Day 5.1 follow-up session**: Native (Capacitor) APK rebuild + manual test of silent-refresh flow on a real device. Backend + frontend code is 100% testable via mocks + curl, but the full native localStorage → X-Refresh-Token → retry round-trip needs a real device.
- [ ] Neon test branch `hardening-day2-test` auto-expires May 19 — fine, served its purpose
- [ ] Schema-ahead-of-code state on production — safe (additive Day 2 migrations) until Day 8
- [ ] Day 2.7 (baseline `_prisma_migrations` table on prod + test coverage sprint) — separate focused session
- [ ] `temp/accidental-user-snapshot-2026-05-12T13-26-19Z.json` — forensic record from Session 88 incident, gitignored, keep until Day 8 deploy success then `rm`
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
- [ ] Day 2.7 backlog (new):
  - **Neon TEST branch revival** — `hardening-day2-test` unreachable per Phase D boot smoke. 5-min Neon dashboard task. **BLOCKS Day 5 DB-dependent smokes.**
  - `tsconfig.test.json` — Vitest currently uses internal esbuild; test files don't get production-strict typecheck. Low-priority cleanup.
  - Frontend component tests (React pages + Day 4 PostHog events) — needs `@testing-library/react` + jsdom infrastructure → future frontend-focused test sprint
  - Cascade integration tests (Priority 3 from Day 2.7 audit): `/api/account/delete` + FCM purge atomicity + cross-cascade reads → future test sprint
  - Socket auth E2E tests (Priority 4): io.use + per-message defense → future test sprint
  - Test suite runtime currently ~1s — well under any threshold worth optimizing

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
