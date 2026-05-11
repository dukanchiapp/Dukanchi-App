# Architecture Decision Log (ADRs)

> Why we chose what. Append-only. Newest at top.
> Format: date | decision | reason | alternatives rejected

---

## 2026-05-11 — Dual-stack push (Web Push + FCM), not replacement
- **Decision:** Keep existing Web Push (VAPID + webpush npm) and ADD FCM as a parallel channel for native Android users. `sendPushToUser()` fans out to both via `Promise.allSettled`.
- **Rationale:** Web/PWA users (current production) keep working unchanged. Native APK users get proper Android system notifications (FCM). No platform left behind — graceful degradation if either service fails. Future iOS support also goes through FCM, same dispatch path.
- **Trade-off accepted:** Slightly more DB rows per user (PushSubscription + FcmToken) and parallel API calls to two services. Acceptable for the platform coverage gain.
- **Future cleanup option:** Could migrate Web Push to FCM Web SDK too, unifying under FCM. Not doing now — VAPID works, why risk breakage before pilot.

---

## 2026-05-11 — Camera plugin deferred from Session 81 to 82+
- **Decision:** `@capacitor/camera` not installed in Session 81.
- **Rationale:** Existing 9 file-input sites use `<input type="file" accept="image/*" capture="environment">` which Capacitor WebView already handles via native Android intent. These ALREADY trigger the native camera picker. Switching to `@capacitor/camera` API requires rewriting all 9 sites with risk of breaking working features. Marginal gain is not worth the risk before pilot launch.
- **When to revisit:** Session 82 (dedicated migration with full regression test), or when features need non-input camera access (e.g. live product scanning).

---

## 2026-05-10 — Capacitor mode: bundled (not server.url)
- **Decision:** Bundle `dist/` into APK. WebView loads from `https://localhost` (NOT `https://dukanchi.com` via `server.url`).
- **Rationale:** App-store reviewers flag thin WebView wrappers. Bundled = real offline via existing service worker. Native plugins authenticate reliably with own scheme origin. `window.Capacitor` detection already wired in `src/lib/api.ts`.
- **Trade-off accepted:** Web bundle ships in every APK — even small CSS tweak = Play Store update. Live update plugin can mitigate later if needed.
- **LOCKED:** `appId = com.dukanchi.app` — PERMANENT post-Play-Store launch. Cannot change after first release.

---

## 2026-05-10 — HTTP cache policy for /api routes
- **Decision:** All `/api/*` endpoints respond with `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` by default. The 4 endpoints that benefit from short-lived caching (stores list, misc trending) explicitly override via `res.set` in their controllers and continue to cache.
- **Rationale:** Browser ETag revalidation served stale empty bodies for conversations/messages/notifications when new data arrived. Hard refresh was the only user-visible mitigation, unacceptable for a chat app. Express default weak ETag is suitable for static documents, not for dynamic JSON APIs. Bandwidth cost of disabling caching is negligible — API responses are small.
- **Implementation:** Single middleware mounted on `/api` after the rate limiter, before domain route handlers. Express last-write-wins on response headers preserves intentional cache overrides in controllers.
- **Future:** If specific GET endpoints get hot enough to merit caching, do it explicitly in the controller (like stores and misc already do). Avoid blanket caching on dynamic endpoints.

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
