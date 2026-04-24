# G-AI — Session Logs

> **Keep this file updated** at the end of each development session to track major milestones, completed tasks, and architectural decisions.

---

## Session: April 24, 2026 — Smart Semantic Search & UI Enhancements

### 1. Smart Semantic Search (Gemini + pgvector)
- Integrated `pgvector` into the PostgreSQL database via Prisma for vector embeddings (`ivfflat` index).
- Created a two-layer search architecture:
  - **Layer A (Alias Dictionary)**: Instantly expands queries using a local synonym map (e.g., `ps5` ↔ `playstation`).
  - **Layer B (Semantic Fallback)**: Uses Google Gemini (`gemini-embedding-2`, 768 dimensions) to perform cosine distance semantic searches if keyword search returns few results.
- Added background job/hook to autonomously generate embeddings on product creation.
- Built a backfill script (`scripts/seedTestData.ts` / `scripts/backfillEmbeddings.ts`) to populate embeddings for test data.

### 2. Fuzzy Spell Correction & Autocomplete
- Built `fuzzySearch.ts` utilizing Levenshtein distance for typo correction.
- Automated a 5-minute background process to refresh the search vocabulary from the database.
- Created `/api/search/suggestions` endpoint for real-time autocomplete.
- Updated frontend (`Search.tsx`) with an interactive suggestions dropdown and a "Showing results for..." spell-correction banner.

### 3. Category-Aware Filtering
- Built `categoryInference.ts` to map search terms to specific categories (Electronics, Food, Beauty, Fashion, Grocery).
- Integrated with Gemini for AI-driven category extraction.
- Completely isolated cross-category noise (e.g., searching "phone" strictly returns Electronics, preventing Food matches).

### 4. Map Bottom Sheet Redesign
- Redesigned the "Stores near you" panel in `Map.tsx` into a modern, upward-expanding bottom sheet.
- Added horizontal scrolling store profile cards in the collapsed state.
- Refined the expanded state with a pinned top header, scrollable white container, and removed arbitrary rank numbers.

### 5. Housekeeping
- Configured `.gitignore` to exclude local `uploads/` directory to prevent binary bloat in version control.
- Created robust test data environment with `npm run seed:test`.

### 6. Sentry Error Tracking Integration
- Installed `@sentry/node` and created `instrument.ts` configuration.
- Configured the Sentry Express error handler in `server.ts` before other error middlewares.
- Verified tracking end-to-end via an intentional throw in a `/debug-sentry` endpoint.
## Session: 2026-04-24 22:56:52
- Completed Phase 4 & Phase 5 of the Domain-Driven Design (DDD) migration.
- Extracted Admin, Team, Notifications, and Misc domains into src/modules/.
- Extracted BullMQ workers into src/workers/.
- Extracted Socket.io logic into src/config/socket-listeners.ts.
- Replaced the monolithic server.ts with a lightweight entry point connecting all routers in src/app.ts.
- Verified compilation with tsc --noEmit (Exit code 0).
- System is fully modularized and testable.
