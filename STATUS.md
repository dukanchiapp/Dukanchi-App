# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-12 | Session 87 verified | Commit: e308ded
> Single-page snapshot. History → SESSION_LOG.md. Decisions → DECISIONS.md.

## Production State
- **URL:** https://dukanchi.com (Cloudflare proxied, SSL Full Strict, TLS 1.2 min)
- **Health:** `/health` → 200 OK
- **Services:** App + Redis + Neon DB + Cloudflare R2 — all green
- **Phase 0.4 audit hardening:** 19/19 fixes deployed ✅
- **B2B2C visibility:** Fully spec-compliant ✅ (Session 76)
- **Day 1 hardening:** TypeScript strict mode + tsconfig split — deployed ✅ (Session 86)
- **Day 2 hardening (DB schema):** 3 migrations applied to production ✅ (Session 87)
  - User soft-delete columns (`deletedAt`, `deletionRequestedAt`, `deletionReason VARCHAR(500)`) + `User_deletedAt_idx`
  - `Store_location_gist_idx` (GiST + ll_to_earth via earthdistance + cube extensions)
  - `Product_embedding_hnsw_idx` (pgvector 0.8.0 HNSW + vector_cosine_ops)
  - Migration files version-controlled in `prisma/migrations/2026051216414[8-0]_*/` with `down.sql` rollbacks
- **Day 2 application code (not yet deployed):** `/api/account/delete` + `/api/account/restore` endpoints exist in `hardening/sprint` HEAD but **NOT pushed to origin** — intentional hold until Day 2.5 cascade audit completes (single deploy event)

## Active Sprint: Hardening Sprint (Day 2 of 8)

**Branch:** `hardening/sprint` @ `e308ded` — **3 commits ahead of origin, NOT pushed** (intentional)

**Day 1 (Session 86)** — TypeScript strict mode + tsconfig architecture split: ✅ COMPLETE (114 → 0 type errors)
**Day 2 (Session 87)** — DB schema hardening + minimal account endpoints: ✅ COMPLETE (migrations on prod, endpoints staged)
**Day 2.5 (next)** — Cascade query audit + auth-middleware deletedAt rejection: PENDING
**Day 3 (after 2.5)** — Security gaps (upload limits, JWT alg whitelist, body size, bcrypt rounds): PENDING

**Path B decision (Session 87)** — Project has no `_prisma_migrations` table on prod or test (historical `prisma db push` usage). Migrations applied via `psql -f` on hand-written SQL files. Baseline-then-track migration setup queued as **Day 2.7** dedicated session.

## Next 3 Actions
1. **Day 2.5 — Cascade audit + auth middleware**
   - Update `authenticateToken` middleware: reject login if `user.deletedAt <= NOW()`
   - Add `where: { deletedAt: null }` to user-facing Prisma queries (profile, chat, follows, notifications, search, admin views must explicitly include deleted)
   - Rewrite `src/modules/search/search.service.ts` radius queries to use `earth_box` + `earth_distance` so `Store_location_gist_idx` is actually consulted
2. **Push `hardening/sprint` to origin** — triggers Railway deploy. Single deploy event covers Day 2 endpoints + Day 2.5 cascade. Production smoke per Anti-Silent-Failure Rule E.
3. **Day 3 — Security hardening** — upload middleware (size + MIME whitelist), JWT `algorithms: ['HS256']` whitelist, body size limit review (currently `express.json({ limit: "50mb" })`), bcrypt rounds review (currently 10)

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
- [ ] `hardening/sprint` is 3 commits ahead of origin — intentional hold, push after Day 2.5
- [ ] Neon test branch `hardening-day2-test` auto-expires May 19 — fine, served its purpose
- [ ] Day 2.7 (baseline `_prisma_migrations` table on prod) — separate focused session, not bundled with Day 3

## Stack
| Layer | Tech |
|---|---|
| Backend | Express + TS + Prisma 5.22 + Socket.IO |
| Frontend | React 19 + Vite + Tailwind |
| DB | Neon Postgres 17 (Singapore) + pgvector |
| Storage | Cloudflare R2 (dukanchi-prod) |
| Cache | Redis (Railway internal) |
| Hosting | Railway us-west2 (Debian-slim Dockerfile) |
| Admin | /admin-panel/ (separate Vite SPA) |
