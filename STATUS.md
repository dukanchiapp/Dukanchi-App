# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-09 | Session 77 | Commit: 37f5f95
> Single-page snapshot. History → SESSION_LOG.md. Decisions → DECISIONS.md.

## Production State
- **URL:** https://dukanchi.com (Cloudflare proxied, SSL Full Strict, TLS 1.2 min)
- **Health:** `/health` → 200 OK
- **Services:** App + Redis + Neon DB + Cloudflare R2 — all green
- **Phase 0.4 audit hardening:** 19/19 fixes deployed ✅
- **B2B2C visibility:** Fully spec-compliant ✅ (Session 76)

## Active Sprint: Sprint 0 — Capacitor Pre-Flight (3/4 blockers cleared)

**Track:** Android-first (iOS deferred to Sprint 5+)

**Blocker status:**
- ✅ `src/lib/api.ts` — apiFetch wrapper created (Session 77)
- ✅ `index.html` IIFE — Capacitor native bypass added (Session 77)
- ✅ CORS — `capacitor://localhost` + `http://localhost` allowed (Session 77)
- ⏳ Auth Bearer header migration — ~20 files (Session 78, next)

**Phase 0.5 — God Tier Vision (8 weeks, after Sprint 0):**
- Week 1-2: Discovery v2 — Voice + Image search
- Week 3-4: Retention v2 — Smart personalized feed
- Week 5-6: Trust v2 — Verified retailers, anti-spam
- Week 7-8: Pilot launch — Bandra 200 retailers

## Next 3 Actions
1. Session 78 — Bulk migrate all fetch() calls to apiFetch + auth refresh endpoint + AuthContext token storage
2. Session 79 — PWA install banner native hide + localStorage user cleanup
3. Sprint 1 (Session 80+) — Install Capacitor Android, generate android shell

## Open Decisions / Risks
- [ ] Bandra confirmed as pilot (founder may revise)
- [ ] Railway free trial ends in ~21 days — paid plan TBD
- [ ] HSTS enable after 1 month stable production (~June 2026)
- [ ] Railway project still named "handsome-charm"

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
