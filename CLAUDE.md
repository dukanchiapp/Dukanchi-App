# DUKANCHI — Claude Code Context

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
