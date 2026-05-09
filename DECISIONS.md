# Architecture Decision Log (ADRs)

> Why we chose what. Append-only. Newest at top.
> Format: date | decision | reason | alternatives rejected

---

## 2026-05-10 — Web socket reconnection strategy
- **Decision:** On Socket.IO reconnect, frontend refetches the relevant data slice via existing REST endpoints rather than implementing a server-side missed-events queue.
- **Rationale:** Server-side missed-events queue requires per-socket pending buffers, TTL handling, and replay logic — significant complexity. Refetch via existing REST is one extra round-trip per reconnect (cheap compared to WebSocket teardown/setup itself). The user-visible delay is bounded (foreground → reconnect → refetch typically <2s total). Sprint 2 FCM push will preempt this for native — phone wakes BEFORE reconnect happens, so this code path becomes a fallback.
- **Trade-off accepted:** Slightly more REST traffic on reconnects. At current scale (hundreds of users) non-issue. At 100k+ users, revisit with a per-room "since cursor" pattern.
- **Visibility wakeup:** Added explicit `visibilitychange` listener that calls `socket.connect()` when tab returns to foreground. Belt-and-suspenders with Socket.IO auto-reconnection — mobile Safari particularly benefits from this nudge.

---

## 2026-05-09 — Auth dual-mode (cookie + Bearer token)
- **Decision:** Auth flow supports both httpOnly cookie (web/PWA) and Authorization Bearer header (Capacitor native) simultaneously. Backend returns JWT in JSON body of login/signup additionally to setting cookie.
- **Rationale:** iOS WKWebView has known issues with cross-origin httpOnly cookies. Android Capacitor WebView origin is `http://localhost` — different from `https://dukanchi.com` — cookie `SameSite=None+Secure` constraints make this fragile. Bearer header is the platform-standard auth for native mobile. Backend middleware already supported Bearer fallback.
- **Trade-off accepted:** localStorage on native is less secure than httpOnly cookie. Mitigations: 7-day token expiry, `/api/auth/refresh` endpoint for rotation, app is wrapped (no foreign JS injection surface).
- **Future:** When iOS launches, evaluate `@capacitor/secure-storage-plugin` for token storage (Keychain on iOS, EncryptedSharedPreferences on Android) instead of plain localStorage.

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
