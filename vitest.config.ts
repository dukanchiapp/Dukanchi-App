import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest config — established Day 2.5 (Session 88).
 *
 * Scope tonight: 3 critical smoke tests against the soft-delete cascade.
 * Comprehensive coverage (cascade integration, socket auth, D5 atomicity,
 * /restore + /refresh end-to-end) is deferred to a dedicated Day 2.7
 * "Test Coverage Sprint" — see SESSION_LOG Session 88.
 *
 * Conventions:
 *   - Tests are colocated with source as `<file>.test.ts`
 *   - Globals are OFF — explicit `import { describe, it, expect, vi }` from "vitest"
 *   - Runs against `node` environment (backend tests; no DOM)
 *   - No DB in tests — mock prisma + Redis (Rule F: tests never touch prod DB)
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    // Tests are excluded from tsconfig.server.json's include list. Vitest
    // handles its own TS via esbuild internally — typecheck runs separately
    // for production code via `npm run typecheck`. Future Day 2.7 work may
    // add `tsconfig.test.json` for explicit test typechecking.
  },
});
