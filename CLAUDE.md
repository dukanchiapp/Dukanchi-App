# DUKANCHI — Claude Code Context

## Session Workflow Protocol

**Two-AI workflow:**
- **Opus (chat):** Strategy, brainstorming, prompt creation, code review
- **Claude Code (VS Code):** Code execution, file edits, commits, doc updates

**Every new Opus thread, user pastes:**
```
Read STATUS.md from repo:
https://github.com/dukanchiapp/Dukanchi-App/blob/main/STATUS.md
Today's goal: [1 line]
```

**Quick status files:**
- `STATUS.md` — current sprint, live state, next actions (update each session)
- `DECISIONS.md` — architecture decisions, append-only
- `SESSION_LOG.md` — full history, one entry per session

**Every Claude Code session END must:**
1. Append new entry to TOP of SESSION_LOG.md (after H1):
   `YYYY-MM-DD — Session N (short title)`
   - File: change + reason
   - Commit hash if any
   - tsc --noEmit result
2. Refresh ALL sections of STATUS.md:
   - "Last updated" line (date + session # + commit)
   - Move done items, update Next 3 Actions, refresh Blockers
3. If big architecture decision made → append to DECISIONS.md
4. Commit: `git add -A && git commit -m "docs: session N — <title>"`

**Communication style:** Hindi/Hinglish formal "aap". No "tu/tera". Short, point-wise.

## Project
- App: Dukanchi — B2B2C local retail discovery (India)
- Stack: Express + TypeScript + Prisma + PostgreSQL + pgvector + Redis + Socket.IO + React 19 + Vite + Tailwind
- Structure: DDD modules in src/modules/, React pages in src/pages/, components in src/components/
- Admin panel: separate Vite app in admin-panel/
- GitHub: dukanchiapp/Dukanchi-App

## Rules (follow always)
1. Run npx tsc --noEmit before every commit
2. Update SESSION_LOG.md at top after every session
3. Never hardcode secrets — always use process.env
4. Never break existing chat, search, or auth
5. Mobile-first UI only — no desktop-only layouts
6. Commit format: "feat/fix/chore: short description"
7. Push to origin main after every completed task
8. Ask before creating new Prisma models — check schema first

## Anti-Silent-Failure Rules (mandatory checks)

These rules exist because we shipped 3 silent-failure bugs (sessions 78e, 78f, 80c) where frontend `.catch(()=>{})` swallowed real backend mismatches. Every Claude Code session that touches backend routes, frontend `apiFetch` calls, CORS, or `capacitor.config.ts` MUST run these checks before commit. Skipping them is not optional.

### Rule A — Frontend ↔ backend URL parity audit

After ANY change to `src/app.ts` route mounts OR any new/renamed `apiFetch('/api/...')` call in `src/`:

1. List every unique frontend API path:
   ```bash
   grep -rhoE "apiFetch\([\`\"'][^\`\"',)]+" src/ --include="*.tsx" --include="*.ts" \
     | sed "s/apiFetch([\"\`']/  /" | sort -u
   ```
2. List every backend `/api` mount:
   ```bash
   grep -E "app.use\(['\"]/api" src/app.ts
   ```
3. For each non-trivial frontend path, run a production curl OPTIONS or GET to confirm the route returns JSON (not HTML SPA fallback):
   ```bash
   curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://dukanchi.com<PATH>
   ```
   - `200 application/json` or `401 application/json` → real route exists ✅
   - `200 text/html` → SPA fallback, route is broken ❌ FIX before commit

### Rule B — Forbidden silent error swallowing

Never write `.catch(() => {})` or `.catch(() => null)` on user-initiated API calls. Pre-commit grep:

```bash
grep -rn "\.catch(.*=>\s*{\s*}" src/ --include="*.tsx" --include="*.ts"
```

If a silent catch is legitimately needed (fire-and-forget analytics), add a comment explaining WHY and log to `console.error` before swallowing. No comment = treat as a bug.

### Rule C — Capacitor config changes require CORS audit

If you change `server.androidScheme`, `server.iosScheme`, `server.hostname`, or `server.url` in `capacitor.config.ts`, you MUST update `CAPACITOR_ORIGINS` in `src/app.ts` to match:

| Config | Origin to allow |
|---|---|
| `androidScheme: 'http'`  | `http://localhost` |
| `androidScheme: 'https'` | `https://localhost` |
| `iosScheme: 'capacitor'` | `capacitor://localhost` |
| `server.hostname: 'foo'` | `https://foo` or `http://foo` |

Verify post-deploy:
```bash
curl -s -i -X OPTIONS https://dukanchi.com/api/auth/login \
  -H "Origin: <expected-origin>" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
```

### Rule D — Native-only changes get a native smoke test note

If a change affects `src/lib/api.ts`, `src/context/AuthContext.tsx`, Socket.IO connection options, or any `if (isNative())` block, the SESSION_LOG entry MUST include either:
- "Native APK smoke test confirmed by founder ✅" OR
- "Native APK rebuild + manual test pending"

Web-only verification is insufficient for these change classes.

### Rule E — Production curl smoke test after backend deploy

Whenever a session pushes a backend behavior change (routes, CORS, middleware, auth), the session is NOT complete until at least one production curl confirms the deploy landed. Railway takes 60-90 seconds.

```bash
sleep 90
curl -s -i <production-endpoint> | head -5
```

If still failing after a second attempt, STOP and report — don't claim the session succeeded.

### Rule F — Local Smoke Test Isolation

Local backend smoke tests (`npm run dev`) MUST use `DATABASE_URL_TEST` when testing any write-path endpoint (signup, login that mints token, account/delete, account/restore, any POST/PATCH/DELETE).

- Mechanism: `DATABASE_URL=$DATABASE_URL_TEST npm run dev`
- Production endpoint is ONLY tested via curl after Railway redeploy, never from local code
- For pure read-only / auth-rejection smokes (T1 wrong-creds, T3 no-auth), default `DATABASE_URL` is acceptable but discouraged
- Pre-flight check before any write-path smoke: confirm endpoint host matches test branch

Origin: Session 88 / Day 2.5 — a smoke-test signup against the local dev server (connected to prod via main `.env`) accidentally created a `Test` user on production. Forensic cleanup landed via 5 safeguards; rule codified here to prevent recurrence.

### Rule F.2 — Storage Isolation

Rule F's principle (TEST vs PROD separation for write-path smokes) extends to non-DB storage backends. Currently `R2_BUCKET_NAME` (and the four AWS_* credentials) are shared between TEST and PROD in `.env`. Any local smoke test that exercises an upload-write path (POST `/api/upload`, POST `/api/admin/settings/upload`, etc.) WILL create real objects in the production R2 bucket.

Until storage backends are separated, write-path upload smokes follow one of:

- **(a) Use a dedicated test bucket env** — set `R2_BUCKET_NAME_TEST` and have the smoke runner export it as `R2_BUCKET_NAME` for the duration of the smoke. Preferred long-term — eliminates cleanup burden entirely. (Day 4+/Day 2.7 candidate to wire up.)
- **(b) Accept artifact creation + clean up explicitly** — run the smoke, capture the storage keys returned in response bodies, delete them via `@aws-sdk/client-s3 DeleteObjectsCommand` before commit. Today's precedent (Session 89.5).
- **(c) Skip the smoke** — for write-path tests that would create artifacts when no test bucket is available AND no explicit cleanup is planned, skip the smoke and document the gap.

The minimum acceptable bar is (b): smoke-then-cleanup-before-commit. (a) is preferred; (c) is the fallback when neither is feasible. Silent leakage into the prod bucket — discovering it days later — is NOT acceptable.

Origin: Session 89.5 / Day 2.6 — 9 placeholder JPEGs (Day 2.6 Item 2 rate-limit burst smoke) + 2 stragglers (Day 3 Subtask 3.3 smoke T1 + T5) leaked into the prod `dukanchi-prod` R2 bucket. Cleaned forensically via a one-off `temp/r2-cleanup-day26.ts` script; rule codified here to prevent recurrence on the storage surface.

## Two-AI Workflow — Response Conventions

### Opus Summary Convention

When Claude Code's output for a step would exceed ~30 lines, default to a "Summary for Opus" block at the end of the response:
- 4-6 bullet points covering: (a) what's done, (b) decisions made, (c) deviations/surprises with NDXX numbers, (d) Phase E queue impact, (e) what's pending approval
- Full details (diffs, file contents) remain in the body — the summary is a TL;DR for the strategic loop (Opus chat) to catch up without parsing the whole message

Reduces token usage + cognitive load on the strategic loop without losing fidelity.

### Vitest Conventions

When using `vi.mock()` with values referenced from outside the factory, wrap them in `vi.hoisted(() => ({...}))`. Top-level `const` causes hoisting reference errors because `vi.mock` is hoisted before regular const initialization.

Example:
```ts
const { TEST_JWT_SECRET } = vi.hoisted(() => ({
  TEST_JWT_SECRET: "test-jwt-secret-32-chars-long-padding",
}));
vi.mock("../config/env", () => ({
  env: { JWT_SECRET: TEST_JWT_SECRET },
}));
```

Origin: Session 88 / ND27 — first vitest test (`auth.middleware.test.ts`) failed on a top-level `const TEST_JWT_SECRET` used inside a `vi.mock` factory.

## Key File Map
- All routes registered: src/app.ts
- Auth middleware: src/middleware/auth.ts
- Gemini AI services: src/services/geminiVision.ts
- Search logic: src/modules/search/search.service.ts
- Socket setup: src/lib/socket.ts
- DB schema: prisma/schema.prisma
- Frontend auth: src/context/AuthContext.tsx
- Store utils (timing): src/lib/storeUtils.ts

## Current Stack Versions
- @google/genai: ^1.50.1 (use model: "gemini-2.5-flash")
- Prisma: check package.json
- Node: 22+

## Gemini Rules
- Always use model: "gemini-2.5-flash" (not gemini-2.0-flash, not gemini-1.5-flash-latest)
- Embeddings model: "text-embedding-004"
- Strip markdown from responses before JSON.parse

## Active Issues (update this section as things get fixed)
- Home feed needs infinite scroll / cursor-based pagination
- Silent catch {} blocks on frontend interactions (like/save/follow) — should show toast on error
- Login/Signup forms need visible loading spinner

## Completed Features
- JWT httpOnly cookies auth
- Zod validation on all routes
- Smart search (pgvector + Gemini embeddings)
- Bulk Excel import with AI column mapping
- Store open/closed timing status
- AI Photo-to-Post (geminiVision.ts)
- AI Voice-to-Post (geminiVision.ts)
- AI Store Description modal
- Ask Nearby (radius search, Yes/No availability, auto chat)
- Landing Page CMS (admin editable, DB-backed, fallback defaults)
- Static HTML Landing Page (public/landing.html, served by Express GET /landing, data-content CMS fetch)
- PWA (manifest, service worker, 8 icon sizes, install prompt banner, offline cache)
- Smart PWA install button (pre-install branding overlay, standalone redirect, appinstalled → auto /signup)
