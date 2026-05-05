# Architecture Decision Log (ADRs)

> Why we chose what. Append-only. Newest at top.
> Format: date | decision | reason | alternatives rejected

---

## 2026-05-05 — Phase 0.5 strategic foundation
- **Customer-first strategy:** Marketplaces have chicken-egg problem; in India hyperlocal, customer demand pulls retailers (low-tech dukandar onboards only when forced by demand). Verdict: customer-first, retailer follows.
- **Discovery as wedge:** Speed/Trust/Convenience all matter, but Discovery is the 10x improvement — no current solution does it: Google Maps doesn't show products, JustDial is dead, WhatsApp is noise. Trust/Speed/Convenience layer on top.
- **AI feature priority sequence:** Voice + Image search (Phase 1) → Smart feed (Phase 2) → Trust (Phase 3) → Predictive availability (Phase 6+, post-scale).
- **Pilot: Bandra, Mumbai:** Affluent + varied retail mix + English/Hindi bilingual user base.
- **Revisit if:** First 200 retailers onboard at <80% conversion → reconsider locality choice.

---

## 2026-05-03 — Hosting: Railway (chose) over Render/Fly/AWS
- **Why:** Fast deploys, $5 trial, simple Dockerfile builder, native Redis, GitHub auto-deploy
- **Rejected:** Render (slow cold starts), Fly (steep config), AWS (overkill, billing risk)
- **Revisit if:** Bills exceed $50/mo or need Indian region

## 2026-05-03 — Storage: Cloudflare R2 over AWS S3
- **Why:** Zero egress fees critical for image-heavy app; S3-compatible API
- **Rejected:** S3 (egress charges), Backblaze B2 (less integration)

## 2026-05-03 — DB: Neon Postgres over Supabase/RDS
- **Why:** Serverless Postgres, branching, pgvector built-in, generous free tier, Singapore region for India latency
- **Rejected:** Supabase (heavier stack), RDS (cost + complexity)

## 2026-05-03 — Docker: Debian-slim over Alpine
- **Why:** Prisma + OpenSSL compatibility issues on Alpine
- **Rejected:** Alpine (smaller but Prisma binary mismatch)

## 2026-04-30 — Frontend: React 19 + Vite (kept from initial bootstrap)
- **Why:** Came from Google AI Studio scaffold; modern, fast HMR
- **Revisit if:** Need SSR/SEO (would migrate to Next.js)

## 2026-04-28 — Auth: HttpOnly cookies over localStorage tokens
- **Why:** XSS protection, stricter security posture
- **Rejected:** localStorage (vulnerable to XSS exfil)
