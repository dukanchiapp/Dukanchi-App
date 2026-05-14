# Dukanchi — Operations Runbook

> Operational playbook for deploys, rollbacks, and incident response.
> Pair with [STATUS.md](./STATUS.md) (live state) and [SESSION_LOG.md](./SESSION_LOG.md) (history).
> Established Day 6 Phase 4 / Session 93 to close **ND-D6-11** (no rollback procedure documented).

---

## 1. Deploy Process

### Pipeline at a glance
```
git push origin main
        │
        ▼
GitHub Actions ci.yml      ─── typecheck + tests + coverage + build
        │  (PR gate; push to main runs the same checks)
        ▼
Railway webhook            ─── builds Dockerfile (Debian-slim, Node 22)
        │
        ▼
Docker build (~4-6 min)    ─── npm ci → prisma generate → vite build
        │
        ▼
Container start            ─── tsx server.ts (PID 1)
        │
        ▼
Healthcheck                ─── GET /health → 200 within 30s
        │
        ▼
Cloudflare proxy           ─── dukanchi.com (Full Strict SSL, TLS 1.2 min)
```

### Expected timings
- **CI workflow:** 1m to 1m30s (depends on cache hit)
- **Railway build + push:** 4–6 min (Docker cold start; subsequent builds use layer cache)
- **Healthcheck pass:** within 30s of container start
- **Total push-to-live:** ~6–8 min in steady state

### What to watch in the Railway dashboard
- **Deploy logs** — Vite build success, Prisma client generated for `debian-openssl-3.0.x`
- **Runtime logs** — `[pinoHttp] listening on port 3000`, no Redis/Prisma boot errors
- **Healthcheck** — green tick within 30s; if it fails twice Railway rolls back automatically (via `restartPolicyMaxRetries: 10` in `railway.json`)

---

## 2. Rollback Procedure (Railway)

**Use when:** Production is broken after a deploy and a hotfix is more than 10 min away.

### Steps
1. Open Railway dashboard → **handsome-charm** project → **Production** environment.
2. Navigate to **Deployments** tab. The most recent successful deploy will be the second-most-recent row (the broken one is the top).
3. Hover the previous green deploy → **⋯ menu → Redeploy**.
4. Confirm. Railway re-uses the existing Docker image (no rebuild) — rollback completes in **~30–60 seconds**.
5. Verify via:
   ```bash
   curl -s -i https://dukanchi.com/health | head -5
   curl -s https://dukanchi.com/api/auth/me -H "Cookie: $(cat /tmp/test-cookie)" | jq .
   ```
6. **Announce in the team channel** with rollback timestamp + rolled-back-from commit SHA.

### Estimated MTTR
- Decision to redeploy: 1–2 min (status check + comms)
- Railway redeploy: ~30–60s
- Cloudflare cache invalidation (if HTML/CSS edge-cached): 1–2 min
- **Total: ~3–5 min from "rollback now" to verified-green.**

### When to rollback vs hotfix
| Situation | Action |
|---|---|
| Site down / 5xx > 5% / auth broken | **Roll back immediately.** Fix forward later. |
| One feature broken; rest works | Hotfix-forward if < 30 min, else rollback. |
| Slow regression (latency, not failures) | Hotfix-forward (rollback risks losing in-flight schema migrations). |
| Schema-breaking migration deployed | **Stop. Do not rollback Railway** — it will run with old code against new schema. Use database rollback path (§3). |

---

## 3. Database Rollback (Neon)

**Use when:** A Prisma migration or `psql -f` patch broke the production schema.

### Neon point-in-time recovery (PITR)
- **Available:** 7 days of PITR on the free tier; longer on paid plans.
- **Granularity:** any second within the retention window.
- **Cost:** restoring to a new branch is free; reads on the restored branch are normal compute.

### Steps
1. Neon dashboard → project **dukanchi** → **Branches** tab.
2. Click **Create branch** → **Branch from a point in time**.
3. Pick the target timestamp (just **before** the bad migration ran — check Railway deploy timestamps).
4. Name the new branch `recovery-<YYYYMMDD-HHMM>`.
5. Copy the **connection string** from the new branch.
6. In Railway → **Variables** → set `DATABASE_URL` to the recovery branch connection string.
7. Railway auto-redeploys with the rolled-back DB. Verify `/health` + a smoke endpoint.
8. **After verification:** in Neon, promote the recovery branch to primary (or copy data back as needed).

### When to use
- Schema migration ran but corrupted/dropped data
- Migration completed but app code can't read the new schema (state mismatch)
- A bad `UPDATE` / `DELETE` ran against prod via `psql`

### When NOT to use
- App bug that doesn't touch schema → use Railway rollback (§2)
- Single-row data correction → manual `UPDATE` is safer

### Project precedent
Day 2 schema migrations (User soft-delete cols, Store GIST index, Product HNSW, cube + earthdistance extensions) were applied via `psql -f` directly. The project does **not** yet have a `_prisma_migrations` table (Path B decision, Session 87). Day 2.7 backlog tracks moving to `prisma migrate deploy` so future migrations land transactionally.

---

## 4. Incident Response Checklist

### Severity matrix
| Sev | Definition | Response time | Comms |
|---|---|---|---|
| **P0** | Site down, auth broken, data loss in progress | < 5 min | Founder + all online team |
| **P1** | Critical feature broken (chat/search/post), > 10% users affected | < 30 min | Team channel |
| **P2** | Single feature degraded, cosmetic bugs, low-traffic-path errors | Next business day | Issue tracker |
| **P3** | Optimization / polish | When convenient | Backlog |

### First 5 minutes (P0)
1. **Confirm scope** — `curl https://dukanchi.com/health` + spot-check 2-3 API endpoints
2. **Check Sentry** — error rate spike? Specific exception class?
3. **Check Railway** — recent deploys? Healthcheck failing? OOM? Container restarts?
4. **Check Neon** — connection saturation? Slow queries dashboard?
5. **Check Cloudflare** — origin error rate? DNS / SSL? WAF blocking?

### Decision tree
```
Is /health responding?
├─ NO  → Railway dashboard → recent deploy? → §2 rollback
│        Otherwise → Railway logs → container start error
└─ YES → which endpoint(s) failing?
         ├─ /api/auth/*       → §5 "Auth refresh loop"
         ├─ /api/search       → §5 "Search latency"
         ├─ DB error in Sentry → §5 "Database connection exhaustion"
         └─ Frontend errors    → Vite build artifacts on CDN? Source map upload? Sentry frontend project?
```

### Postmortem template
Open a new entry at the top of `SESSION_LOG.md`:
```
YYYY-MM-DD — Incident NN (short title)
- Sev: P0/P1/P2
- Detected at: HH:MM IST via <Sentry alert | user report | metric>
- Rolled back at: HH:MM IST (commit SHA before → SHA after)
- Recovery confirmed: HH:MM IST
- Total downtime: NN minutes
- Root cause: <1-line>
- Contributing factors: <bullets>
- Action items: <bullets, link to spawned issues>
- Lessons:
```

---

## 5. Common Failure Modes

### Railway deploy fails
- **Symptom:** Push to `main` → deploy log shows red, no new container running.
- **First checks:**
  - Did `npm ci` fail? → likely missing dep in `package.json` or version conflict
  - Did `prisma generate` fail? → check `binaryTargets` includes `debian-openssl-3.0.x` (line 4 of `prisma/schema.prisma`)
  - Did `vite build` fail? → typecheck error or `[ND-D6-EXTRA-5]` localhost guard (set `VITE_API_URL` in Railway env)
- **Resolution:** Fix locally → `git push` → new deploy. Production stays on the previous green container.

### Sentry error spike
- **Symptom:** Sentry email/Slack alert, dashboard shows > 50 events/hr for a single issue.
- **Triage:**
  - **What** — exception class + stack trace + offending file
  - **Who** — affected user count (Sentry shows distinct users)
  - **When** — first seen + frequency (continuous? spike?)
  - **Where** — backend or frontend Sentry project?
- **If new deploy correlates → §2 rollback.**
- **Otherwise:** open hotfix branch, add a regression test, ship within session.

### Auth refresh loop (clients silently logging out)
- **Symptom:** Users report being booted to /login mid-session; Sentry shows `RefreshTokenError` cluster.
- **First check:** Does Railway have `JWT_REFRESH_SECRET` set, and does it match what the prod tokens were signed with?
- **If `JWT_REFRESH_SECRET` was rotated:** all existing refresh tokens are invalid by design. Either accept the one-time logout, or rotate via the `setAuthCookies` helper's documented zero-downtime path (Day 5 / Session 92).
- **If parity should hold but doesn't:** check that `auth.middleware.ts` is reading the env via `env.JWT_REFRESH_SECRET` (parsed once at boot — Railway env change requires a restart).

### Database connection exhaustion
- **Symptom:** Sentry shows `PrismaClientKnownRequestError` with code `P1001` (timeout) or `P1017` (server closed connection).
- **First check:** Neon dashboard → **Compute** → active connections. Free-tier cap is 10 concurrent.
- **Resolution paths:**
  - **Short term:** restart the Railway container to drop idle connections.
  - **Mid term:** lower Prisma `connection_limit` in `DATABASE_URL` query string from `10` to `5`; or use Neon's pgbouncer endpoint.
  - **Long term:** upgrade Neon to a paid tier with higher cap.

### Redis unavailable
- **Symptom:** Backend logs show `[redis] connection refused`; refresh tokens, rate limits, and Socket.IO clustering degrade.
- **Graceful degradation in place:**
  - Rate limits → in-memory fallback (`MemoryStore`) — works for single-instance Railway, breaks at horizontal scale.
  - Refresh tokens → service throws; clients silently log out via `/refresh` 401.
- **Resolution:** restart the Railway Redis service. If persistent, contact Railway support.

### Frontend bundle stale on user devices
- **Symptom:** Users report old UI / "Refresh, Cmd-Shift-R doesn't help."
- **Cause:** PWA service worker (`vite-plugin-pwa`) cached an old bundle.
- **Resolution:** users with the next session will auto-update (`registerType: 'autoUpdate'`). For an emergency cache bust, bump `manifest.json` version + redeploy → forces SW skip-waiting on next visit.

---

## 6. Day 8 Atomic Merge Checklist

The `hardening/sprint` branch lands on `main` as one atomic merge after Days 1–7 complete. **All items below MUST be checked before the merge.**

### Pre-merge env var provisioning (Railway dashboard)
- [ ] `JWT_REFRESH_SECRET` set (`openssl rand -base64 48`, distinct from `JWT_SECRET`). Boot hard-fails in prod if unset (Day 5 verified live in S7 smoke).
- [ ] `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` set if you want source-map upload at build time. Optional — frontend Sentry still works without, just minified stack traces.
- [ ] `CODECOV_TOKEN` set as a **GitHub repository secret** (not Railway) — closes ND-D6-9. Without it Codecov upload returns "Token required — not valid tokenless upload" and CI is green-but-no-data.
- [ ] All other variables in [README Environment Variables table](./README.md#environment-variables) confirmed in Railway prod env.

### Branch protection rules (manual GitHub setup — Q-D6-6)
- [ ] Settings → Branches → Add rule for `main`
- [ ] **Require a pull request before merging** (no direct push)
- [ ] **Require status checks to pass** → check `ci` (NOT `bundle-size` — that's report-only)
- [ ] **Require branches to be up to date before merging** ✓
- [ ] **Do not allow bypassing the above settings** ✓
- [ ] **No force push** (enforced)

### Smoke test sequence post-deploy (Rule E)
After `git push origin main` and Railway redeploy completes (sleep 90s minimum):
```bash
# 1. Healthcheck
curl -s -i https://dukanchi.com/health | head -5

# 2. SPA root
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://dukanchi.com/

# 3. CORS preflight (web origin)
curl -s -i -X OPTIONS https://dukanchi.com/api/auth/login \
  -H "Origin: https://dukanchi.com" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin

# 4. CORS preflight (native origin)
curl -s -i -X OPTIONS https://dukanchi.com/api/auth/login \
  -H "Origin: capacitor://localhost" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin

# 5. JSON content on a known route (not SPA fallback)
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" https://dukanchi.com/api/pincode/400050
```
All five must return expected codes (200 / 200 application/json / `access-control-allow-origin: https://dukanchi.com` / `access-control-allow-origin: capacitor://localhost` / 200 application/json).

### Rollback trigger thresholds
| Metric | Threshold | Action |
|---|---|---|
| `/health` non-200 for > 60s | Hard | Immediate rollback (§2) |
| Sentry error rate | > 10× pre-deploy baseline within 5 min | Immediate rollback |
| 5xx response rate | > 1% sustained | Immediate rollback |
| Critical-path latency (login, search, /me) | > 3× p50 baseline | Investigate first; rollback if root cause unclear within 10 min |

---

## 7. R2 Versioning Status

**Status: UNKNOWN** as of Day 6 audit (Area 11). The `dukanchi-prod` R2 bucket may or may not have versioning enabled.

**Risk:** Without versioning, an accidental delete or overwrite of a user upload is unrecoverable.

**Day 7 backlog action:**
- [ ] Cloudflare dashboard → R2 → `dukanchi-prod` → Settings → Object Versioning → confirm status
- [ ] If disabled, enable versioning + 30-day retention policy
- [ ] Document final state in this section

---

## 8. Useful Commands

### Railway CLI
```bash
railway login
railway link                           # link to handsome-charm project
railway logs                           # tail prod container logs
railway logs --filter="error"          # only error-level lines
railway run npm test                   # run a command with prod env (DANGER — use sparingly)
railway variables                      # list configured env vars (values masked)
```

### Prisma — `db push` vs `migrate deploy`
- **`prisma db push`** — applies schema changes directly without creating a migration. Fast for prototyping; **never use in production**. The project currently uses this for dev (Path B, Session 87).
- **`prisma migrate deploy`** — applies committed migrations transactionally. **Required for production once `_prisma_migrations` table exists.** Day 2.7 backlog covers wiring this up.
- **`prisma generate`** — regenerates the typed client. Runs automatically on `npm install`; also runs inside the Dockerfile during Railway build.

### Neon — connection string switching for test branches
```bash
# Local dev — primary branch (default in .env)
DATABASE_URL="postgresql://...neondb?sslmode=require"

# Local dev — test branch for write-path smokes (Rule F)
DATABASE_URL_TEST="postgresql://...test-neondb?sslmode=require"

# Run dev server against test branch
DATABASE_URL=$DATABASE_URL_TEST npm run dev
```

The Neon `hardening-day2-test` branch was provisioned for Day 5+; can be re-created from the Neon dashboard if expired.

### Local R2 cleanup (when forensic cleanup is needed)
See `temp/r2-cleanup-day26.ts` (gitignored) for the pattern. Uses `@aws-sdk/client-s3 DeleteObjectsCommand`. Origin: Session 89.5 cleanup of 11 placeholder JPEGs that leaked into prod during local smoke tests (Rule F.2 codified post-incident).

### Quick log tailing during incidents
```bash
# Backend logs (Railway)
railway logs --follow

# Recent CI runs
gh run list --branch main --limit 5
gh run watch <run-id>

# Production curl battery (run after every backend deploy — Rule E)
sleep 90 && curl -s -i https://dukanchi.com/health | head -5
```

---

## Changelog

| Date | Session | Change |
|---|---|---|
| 2026-05-14 | Session 93 / Day 6 Phase 4 | Initial RUNBOOK created. Closes ND-D6-11. |
