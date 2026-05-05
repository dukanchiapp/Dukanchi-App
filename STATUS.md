# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-05 | Session 72 | Commit: TBD
> Single-page snapshot. History → SESSION_LOG.md. Decisions → DECISIONS.md.

## Production State
- **URL:** https://dukanchi-app-production.up.railway.app (LIVE)
- **Custom domain:** dukanchi.com (Cloudflare migration in progress)
- **Health:** `/health` → 200 OK
- **Services:** App + Redis + Neon DB + Cloudflare R2 — all green
- **Last deploy:** Session 72 — Security Batch 2 (5 fixes)

## Active Sprint
**Phase 0.4 — Production Hardening (Audit Report)**
- Batch 1: Quick wins (7 fixes) — Sessions 70-71 — DONE
- Batch 2: Security Critical (5 fixes) — Session 72 — DONE
- Cloudflare migration — DNS in progress
- Batch 3: Performance — next

## Next 3 Actions
1. Cloudflare DNS finish — verify dukanchi.com proxies, SSL active
2. Audit Batch 3: Performance (PERF-001/002, RELIABILITY-002)
3. Audit Batch 4: Reliability (RELIABILITY-001/003/006)

## Open Blockers / Risks
- [ ] Cloudflare DNS propagation pending
- [ ] Railway free trial ends in ~28 days — paid plan TBD
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

## Pending Roadmap (Audit batches)
- Batch 2: Security Critical (~1 hr)
- Batch 3: Performance (~1.5 hr)
- Batch 4: Reliability (~1.5 hr)
- Batch 5: UX Polish (~1 hr)
