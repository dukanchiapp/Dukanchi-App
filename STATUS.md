# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-12 | Session 88 closed | Branch: hardening/sprint @ a363fd6 (pushed) | Prod runs main @ 32f5525
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

All committed to `origin/hardening/sprint` (pushed). Branch is **24 commits ahead of `origin/main`**.

## Active Sprint: Hardening Sprint (Days 1-2.5 of 8 — 31% complete)

**Branch:** `hardening/sprint` @ `a363fd6` (matches origin)
**Deploy plan:** **Day 8 atomic merge** `hardening/sprint` → `main` → Railway redeploy + full Rule E verification

| Day | Topic | Status |
|---|---|---|
| 1 (Session 86) | TS strict mode + tsconfig split | ✅ Done, in branch |
| 2 (Session 87) | DB schema + account endpoints | ✅ Done, schema on prod, code in branch |
| 2.5 (Session 88) | Soft-delete cascade (audit + impl + tests) | ✅ Done, in branch |
| 3 (Next) | Security: JWT alg, bcrypt, body limit, upload limits, timeouts | ⏳ PENDING |
| 4-7 | TBD (rate limiting, error handling, monitoring, observability) | Planned |
| 8 | Atomic merge to main + production deploy + verification | Planned |

**Path B decision (Session 87)** — Project has no `_prisma_migrations` table on prod or test (historical `prisma db push` usage). Migrations applied via `psql -f` on hand-written SQL files. Baseline-then-track migration setup queued as **Day 2.7** dedicated session.

**Test infrastructure (Session 88)** — Vitest installed, 16 smoke tests live (user-status helpers + auth middleware). Comprehensive coverage deferred to **Day 2.7 Test Coverage Sprint**.

## Next 3 Actions
1. **Day 3 — Security hardening** (next session, fresh prompt below)
   - Upload middleware: file size cap + MIME whitelist
   - JWT algorithm whitelist (lock to `HS256`, reject `none`)
   - Body size limit review (`express.json({ limit: "50mb" })` is likely too generous)
   - bcrypt rounds review (currently 10)
   - Request timeouts (Express has no default)
2. **Day 2.7 — Test Coverage Sprint** (focused session)
   - Cascade integration tests, D5 atomicity, socket auth E2E, fixtures, CI wiring
3. **Day 8 — Atomic merge + deploy** (after Days 3-7 complete)
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
- [ ] `hardening/sprint` is 24 commits ahead of `origin/main` — intentional, merges at Day 8
- [ ] Neon test branch `hardening-day2-test` auto-expires May 19 — fine, served its purpose
- [ ] Schema-ahead-of-code state on production — safe (additive Day 2 migrations) until Day 8
- [ ] Day 2.7 (baseline `_prisma_migrations` table on prod + test coverage sprint) — separate focused session
- [ ] `temp/accidental-user-snapshot-2026-05-12T13-26-19Z.json` — forensic record from Session 88 incident, gitignored, keep until Day 8 deploy success then `rm`

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
