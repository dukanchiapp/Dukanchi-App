# Dukanchi — Live Status Dashboard

> Last updated: 2026-05-06 | Session 76 | Commit: cd82969
> Single-page snapshot. History → SESSION_LOG.md. Decisions → DECISIONS.md.

## Production State
- **URL:** https://dukanchi.com (Cloudflare proxied, SSL Full Strict, TLS 1.2 min)
- **Health:** `/health` → 200 OK
- **Services:** App + Redis + Neon DB + Cloudflare R2 — all green
- **Phase 0.4 audit hardening:** 19/19 fixes deployed ✅
- **B2B2C visibility:** Fully spec-compliant ✅ (Session 76 — canChat, store/feed/search/profile role filters)

## Active Sprint: Phase 0.5 — God Tier Vision (8 weeks)

**Strategic foundation:**
- Primary user: Customer-first (retailer follows organically)
- Wedge: Discovery (10x improvement vs Google Maps / JustDial / WhatsApp)
- Pilot: Bandra, Mumbai — affluent, varied retail mix, bilingual
- 6-month outcome: Pilot proven, Series A ready

**8-week roadmap:**
- Week 1-2: Discovery v2 — Voice + Image search — NEXT
- Week 3-4: Retention v2 — Smart personalized feed
- Week 5-6: Trust v2 — Verified retailers, anti-spam
- Week 7-8: Pilot launch — Bandra 200 retailers

## Next 3 Actions
1. Phase 1 kickoff — repo audit (existing voice/image infra) + build plan
2. Bandra pilot logistics — budget, team, retailer onboarding playbook
3. Railway paid plan decision (~24 days trial left)

## Open Decisions / Risks
- [ ] Bandra confirmed as pilot (founder may revise)
- [ ] Railway free trial ends in ~24 days — paid plan TBD
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
