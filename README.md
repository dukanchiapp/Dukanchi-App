# Dukanchi

[![CI](https://github.com/dukanchiapp/Dukanchi-App/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/dukanchiapp/Dukanchi-App/actions/workflows/ci.yml)

**Hyperlocal B2B2C retail discovery for India.** Customers find nearby stores, ask "do you have X?" to multiple retailers at once, and chat to buy. Retailers manage their shopfront, product catalog, and customer conversations from a single mobile-first app.

> Live: [dukanchi.com](https://dukanchi.com) • Status: [STATUS.md](./STATUS.md) • Decisions: [DECISIONS.md](./DECISIONS.md) • Session history: [SESSION_LOG.md](./SESSION_LOG.md) • Operations: [RUNBOOK.md](./RUNBOOK.md)

---

## What is Dukanchi

Dukanchi (दुकानची) means "shopkeeper" in Marathi. The app connects two sides of the Indian local-retail market that today have no good digital meeting point:

- **Customers** discover nearby stores by category + pincode + radius. Free-text + voice + image search via Gemini embeddings (pgvector). "Ask Nearby" broadcasts a product query to retailers within a radius; replies arrive as chat threads.
- **Retailers** set up a digital storefront in minutes (KYC-gated), bulk-import their catalog from Excel/CSV with AI column mapping, post offers + new arrivals, and chat with customers in real time.

The app is mobile-first PWA + Android (Capacitor). Admin panel is a separate web SPA for the operations team (KYC review, content moderation, CMS).

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Express + TypeScript (strict), Prisma 5.22, Socket.IO, Vitest 4.1 |
| Frontend | React 19, Vite 7, TailwindCSS 4, React Router 7 |
| Database | Neon Postgres 17 (Singapore region) + pgvector 0.8 + cube + earthdistance |
| Cache & realtime | Redis (Railway internal, also used for refresh-token rotation + rate limits) |
| Storage | Cloudflare R2 (bucket `dukanchi-prod`) — uploads, KYC docs, post images |
| AI | Google Gemini (`gemini-2.5-flash` for vision/text, `text-embedding-004` for semantic search) |
| Mobile | Capacitor 8 (Android live; iOS scaffolded) |
| Hosting | Railway (us-west2, Debian-slim Docker, deploys from `main`), Cloudflare proxy |
| Observability | Sentry (backend + frontend), PostHog (EU instance) |
| CI/CD | GitHub Actions (typecheck + tests + coverage + bundle-size + build) |

---

## Quick Start (Dev)

### Prerequisites
- **Node.js 22+** (matches Railway runtime; LTS recommended)
- **npm 10+**
- **PostgreSQL 16+** locally, **or** a free [Neon](https://neon.tech) account (recommended — pgvector + cube + earthdistance extensions pre-installable)
- **Redis 7+** locally, **or** [Upstash](https://upstash.com) free tier (used for sessions, rate limits, refresh-token rotation)

### Setup
```bash
git clone https://github.com/dukanchiapp/Dukanchi-App.git
cd Dukanchi-App
npm install
cp .env.example .env
# Edit .env: at minimum set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, REDIS_URL
npx prisma generate
npx prisma db push           # for first-time setup against a fresh DB
npm run dev                  # backend on :3000, frontend on :5173
```

For the admin panel SPA:
```bash
cd admin-panel && npm install && npm run dev   # admin on :5174
```

---

## Environment Variables

`.env.example` is the authoritative list. Highlights below — required for boot are bold.

| Variable | Required? | Dev default | Production source |
|---|---|---|---|
| **`DATABASE_URL`** | ✅ Required | `postgresql://...localhost/...` | Neon connection string (Singapore branch) |
| `DATABASE_URL_TEST` | Recommended | (unset) | Neon test branch — used by Rule F write-path smokes |
| **`JWT_SECRET`** | ✅ Required | dev fallback OK | `openssl rand -base64 48` (Railway secret) |
| **`JWT_REFRESH_SECRET`** | ✅ Required in prod | dev fallback OK | `openssl rand -base64 48`, **distinct** from `JWT_SECRET` (Railway hard-fails boot if missing in prod) |
| `BCRYPT_ROUNDS` | Optional | `12` | `12` (2026 baseline; min 10, max 14) |
| **`REDIS_URL`** | ✅ Required | `redis://localhost:6379` | Railway internal Redis URL |
| `ALLOWED_ORIGINS` | Optional | `http://localhost:3000,http://localhost:5173` | Comma-sep production origins. `capacitor://localhost` + `http://localhost` (native) are hardcoded — do not add. |
| `APP_URL` | Optional | `http://localhost:3000` | `https://dukanchi.com` |
| **`VITE_API_URL`** | ✅ Required for prod | `http://localhost:3000` | `https://dukanchi.com` — **build-time guard rejects localhost in `mode=production` (ND-D6-EXTRA-5)**. `npm run build:mobile` overrides this automatically. |
| `S3_BUCKET_NAME` | Optional (R2) | (empty → local `uploads/`) | `dukanchi-prod` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Required if R2 used | (empty) | Cloudflare R2 access keys |
| `S3_ENDPOINT` | Required if R2 used | (empty) | `https://<account>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | Required if R2 used | (empty) | `https://cdn.dukanchi.com` |
| `AWS_REGION` | Optional | `auto` | `auto` (R2 ignores region but SDK requires it) |
| **`ADMIN_PHONE`** + **`ADMIN_PASSWORD`** | Required for first admin | (empty) | Set both to seed the initial admin account on boot |
| `GEMINI_API_KEY` | Required for AI features | (empty) | Google AI Studio key (model `gemini-2.5-flash`) |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional (maps page) | (empty) | GCP Maps JS API key |
| `GOOGLE_CLIENT_ID` + `VITE_GOOGLE_CLIENT_ID` | Optional (OAuth) | (empty) | GCP OAuth client IDs (must match) |
| `SENTRY_DSN` | Optional | (empty) | Backend Sentry DSN — gracefully disabled if unset |
| `VITE_SENTRY_DSN` | Optional | (empty) | Frontend Sentry DSN — separate Sentry project recommended |
| `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` | Optional (build-time) | (empty) | Source-map upload at `npm run build`. Skipped with a warning if unset. |
| `VITE_POSTHOG_KEY` | Optional | (empty) | PostHog project API key. EU host default (DPDP-friendly) |
| `VITE_POSTHOG_HOST` | Optional | `https://eu.i.posthog.com` | Same; override for US/self-hosted |
| `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_MAILTO` | Optional | (empty) | Web push notification keys |
| `NODE_ENV` | Optional | `development` | `production` on Railway |

**Never commit `.env` files.** Pre-commit hook (`scripts/precommit-checks.sh`) rejects them; CI has no env-file fallback.

---

## Build & Deploy

### Web build
```bash
npm run build              # typecheck (Rule G) + vite build (web)
npm run preview            # serve dist/ locally on :4173
```

The web build will **fail fast** if `VITE_API_URL` points to localhost in production mode (ND-D6-EXTRA-5 guard in `vite.config.ts`).

### Server build
```bash
npm run build:server       # tsc -p tsconfig.server.json → dist-server/
```
The production image runs `tsx server.ts` directly (no compile-then-run); `build:server` is for type-only verification.

### Mobile build (Capacitor / Android)
```bash
npm run build:mobile       # vite build with VITE_API_URL=https://dukanchi.com
npm run sync:android       # build:mobile + cap sync android
npm run open:android       # opens Android Studio
```

### Production deploy (Railway)
- Railway watches `main` → auto-deploy on push.
- Build runs `Dockerfile` (node:22-bookworm-slim + canvas/cairo system deps + Prisma generate + vite build).
- Healthcheck: `GET /health` → 200 OK within 30s.
- Start command: `node_modules/.bin/tsx server.ts`.
- Production uptime is monitored via UptimeRobot — see [RUNBOOK §10](./RUNBOOK.md#10-uptime-monitoring-uptimerobot) for setup.
- Sentry source maps upload at build when `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` are provisioned in Railway env — see [RUNBOOK §9](./RUNBOOK.md#9-sentry-source-maps--production-provisioning).

**Rollback + incident response: see [RUNBOOK.md](./RUNBOOK.md).**

---

## Testing

| Command | Purpose |
|---|---|
| `npm test` | Vitest one-shot — 42 unit + integration tests (~1s) |
| `npm run test:watch` | Vitest watch mode for active dev |
| `npm run test:ui` | Vitest browser UI on :51204 |
| `npm run test:coverage` | Vitest with v8 coverage; produces `coverage/lcov.info` for Codecov |
| `npm run typecheck` | **Rule G** — runs `typecheck:web` + `typecheck:server` (both per-project configs) |

**Coverage baseline (Session 93):** statements 4.30%, branches 3.00%, functions 3.39%, lines 4.81%. CI fail-floor is set just below baseline; ramp to 70% is on the Day 7+ backlog.

Tests use mocked Prisma + Redis (Rule F: tests never touch prod DB). Write-path smokes against a real DB must use `DATABASE_URL_TEST`.

---

## Mobile (Capacitor / Android)

The mobile app is the web app loaded inside Capacitor's WebView, with native plugins for camera, geolocation, push notifications, status bar, and splash screen.

```bash
npm run sync:android       # build:mobile + cap sync
npm run open:android       # opens Android Studio → Build → Generate Signed APK / Bundle
```

`capacitor.config.ts` is configured for `androidScheme: 'https'`. Any change to scheme/hostname/server.url requires a matching update to `CAPACITOR_ORIGINS` in `src/app.ts` (see [CLAUDE.md Rule C](./CLAUDE.md#rule-c--capacitor-config-changes-require-cors-audit)).

---

## Project Structure

```
.
├── src/                       Express backend + React frontend (single project)
│   ├── app.ts                 Express app factory + middleware wiring
│   ├── main.tsx               React entry point
│   ├── App.tsx                React Router setup
│   ├── modules/               DDD-style backend modules (auth, stores, products, ...)
│   ├── pages/                 React pages (Home, Search, Chat, Profile, ...)
│   ├── components/            Shared React components
│   ├── context/               React contexts (AuthContext, ...)
│   ├── lib/                   Cross-cutting backend + frontend utilities (api.ts, logger.ts, ...)
│   ├── middlewares/           Express middlewares (auth, rate-limit, security, ...)
│   ├── services/              External-service integrations (geminiVision, refreshToken, ...)
│   ├── workers/               Background workers (embedding, ...)
│   └── __tests__/             Cross-module integration tests
├── admin-panel/               Separate Vite SPA for ops team (KYC, moderation, CMS)
├── prisma/                    Prisma schema + migrations
├── validators/                Zod schemas + validate() middleware
├── scripts/                   Maintenance + setup scripts (backfillEmbeddings, seedTestData, precommit-checks.sh)
├── public/                    Static web assets (PWA manifest, icons, landing.html)
├── android/                   Capacitor Android project
├── .github/workflows/         CI workflows (ci.yml)
├── .husky/                    Git hooks (pre-commit, pre-push)
├── Dockerfile                 Production image (node:22-bookworm-slim)
├── railway.json               Railway deploy config
├── server.ts                  Production entry (Express + Socket.IO bootstrap)
├── vite.config.ts             Vite config (PWA + Sentry plugin + VITE_API_URL guard)
├── vitest.config.ts           Vitest + v8 coverage config
├── tsconfig.json              Composite root (refs app + server)
├── tsconfig.app.json          Frontend strict project config
├── tsconfig.server.json       Backend strict project config
├── CLAUDE.md                  AI workflow + Rules A–G
├── STATUS.md                  Live sprint dashboard
├── DECISIONS.md               Architecture decisions (append-only)
├── SESSION_LOG.md             Per-session history (newest first)
└── RUNBOOK.md                 Operations playbook (deploy, rollback, incidents)
```

---

## Contributing

This project uses a **two-AI workflow** documented in [CLAUDE.md](./CLAUDE.md):
- **Opus (chat)** for strategy, prompt creation, code review.
- **Claude Code** for code execution, file edits, commits, doc updates.

Sessions append to `SESSION_LOG.md` (newest first) and refresh `STATUS.md` at close.

### PR Guidelines
- Run `npm run typecheck` before commit (**Rule G** — runs both web + server configs).
- Run `npm test` — 42/42 must stay green.
- Run `npm run build` — production bundle must succeed.
- Commit message format: `feat|fix|chore|docs|test|ci(scope): short description`.
- Pre-commit hook rejects `.env` files and high-entropy secret patterns (see `scripts/precommit-checks.sh`).
- Pre-push hook re-runs `npm run typecheck` — last line of defense before remote.
- CI gates: typecheck + test:coverage + Codecov upload + build. Bundle-size is reported via PR comment but never blocks merge.

### Branch Conventions
- `main` — production. Direct push disabled; PR + green CI required (manual branch protection — see RUNBOOK).
- `hardening/sprint` — long-running hardening branch (atomic merge at Day 8).
- Feature branches: `feat/<scope>` or `fix/<scope>`. CI runs on every PR.

---

## License

TBD — license decision deferred until public launch. Until then, all rights reserved by the project owners.
