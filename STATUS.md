# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-05 | Session 75 | Commit: TBD
> Single-page snapshot. History → SESSION_LOG.md. Decisions → DECISIONS.md.

## Production State
- **URL:** https://dukanchi-app-production.up.railway.app (LIVE)
- **Custom domain:** dukanchi.com (Cloudflare proxied, SSL active)
- **Health:** `/health` → 200 OK
- **Services:** App + Redis + Neon DB + Cloudflare R2 — all green
- **Last deploy:** Session 75 — Phase 0.4 audit complete (UX-002 toasts)
- **Hardening:** Phase 0.4 audit — 19/19 fixes deployed ✅

## Active Sprint
**Phase 0.4 — Production Hardening — ✅ COMPLETE**
- Batch 1: Quick wins (7 fixes) — Sessions 70-71 — DONE
- Batch 2: Security Critical (5 fixes) — Session 72 — DONE
- Batch 3: Performance (3 fixes + INFRA-005 bonus) — Session 73 — DONE
- Batch 4: Reliability (3 fixes) — Session 74 — DONE
- Batch 5: UX Polish (1 fix applied; UX-001 already shipped) — Session 75 — DONE

**Phase 0.5 — TBD (pending discussion)**

## Next 3 Actions
1. Define Phase 0.5 sprint goals (discuss with Opus — feature work vs. infra vs. growth)
2. Railway paid plan decision (~24 days left on trial)
3. HSTS enable — schedule for 1 month after stable production (~June 2026)

## Open Blockers / Risks
- [ ] Phase 0.5 goals not yet defined
- [ ] Railway free trial ends in ~24 days — paid plan TBD
- [ ] Railway project still named "handsome-charm"
- [ ] HSTS not yet enabled (intentional — wait 1 month)

## Stack
| Layer | Tech |
|---|---|
| Backend | Express + TS + Prisma 5.22 + Socket.IO |
| Frontend | React 19 + Vite + Tailwind |
| DB | Neon Postgres 17 (Singapore) + pgvector |
| Storage | Cloudflare R2 (dukanchi-prod) |
| Cache | Redis (Railway internal) |
| Hosting | Railway us-west2 (Debian-slim Dockerfile) |
| Admin | /admin-panel/ (separate Vite SPA, served at /admin-panel/) |
