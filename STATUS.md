# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-13 | Session 89.5 closed | Branch: hardening/sprint @ Day 2.6 head (3 commits added this session, push pending) | Prod runs main @ 32f5525
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

All Days 1+2+2.5+3 committed AND pushed to `origin/hardening/sprint`. Day 2.6 (this session) committed locally — push pending.

Branch is **34 commits ahead of `origin/main`** (was 31 at start of Session 89.5; +3 this session: 2 feature + 1 docs).

## Active Sprint: Hardening Sprint (Days 1-3 + Day 2.6 of 8 — 44% complete)

**Branch:** `hardening/sprint` @ Day 2.6 head (local, unpushed)
**Deploy plan:** **Day 8 atomic merge** `hardening/sprint` → `main` → Railway redeploy + full Rule E verification

| Day | Topic | Status |
|---|---|---|
| 1 (Session 86) | TS strict mode + tsconfig split | ✅ Done, pushed |
| 2 (Session 87) | DB schema + account endpoints | ✅ Done, schema on prod, code pushed |
| 2.5 (Session 88) | Soft-delete cascade (audit + impl + tests) | ✅ Done, pushed |
| 3 (Session 89) | Security: JWT alg + body limits + upload validation + bcrypt + timeouts | ✅ Done, pushed |
| 2.6 (Session 89.5) | Upload Scope 3 extras (admin rate-limiter + structured logging) + Rule F.2 + R2 cleanup | ✅ Done, push pending |
| 4 (Next) | Observability — Sentry middleware, error handler, PostHog OR Day 2.7 test coverage sprint | ⏳ Sequencing TBD |
| 5-7 | Rate limiting deep-dive, error handling, monitoring | Planned |
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
- [ ] `hardening/sprint` is **34 commits ahead of `origin/main`** — intentional, merges at Day 8
- [ ] Neon test branch `hardening-day2-test` auto-expires May 19 — fine, served its purpose
- [ ] Schema-ahead-of-code state on production — safe (additive Day 2 migrations) until Day 8
- [ ] Day 2.7 (baseline `_prisma_migrations` table on prod + test coverage sprint) — separate focused session
- [ ] `temp/accidental-user-snapshot-2026-05-12T13-26-19Z.json` — forensic record from Session 88 incident, gitignored, keep until Day 8 deploy success then `rm`
- [ ] Day 3 backlog flagged but deferred:
  - ~~Scope 3 upload extras~~ ✅ shipped in Day 2.6 / Session 89.5 (Items 2+3; Item 1 PDF whitelist documented as ND — no use case)
  - Admin password length floor 6 chars (admin.service.ts:70) → separate concern
  - 4 pre-existing `console.log` statements (geminiEmbeddings.ts + search.service.ts) → future logger migration
- [ ] Day 2.6 backlog (new):
  - Dedicated `R2_BUCKET_NAME_TEST` env to eliminate Rule F.2 cleanup burden → Day 4+/Day 2.7 candidate
  - KYC-specific rate limiter (tighter cap than 10/min upload limit, e.g., 1/day) → Day 4+ candidate
  - xlsUpload rate-limit gap (`/api/stores/:storeId/bulk-import` only has generalLimiter + per-storeId daily cap) → low-priority backlog

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
