import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest config — established Day 2.5 (Session 88); coverage added Day 6
 * Phase 3 (Session 93).
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
 *
 * Coverage (Day 6 Phase 3 / ND-D6-4):
 *   - Provider: v8 (built-in Node coverage; no instrumentation rewrite).
 *   - Reporters: text (console), html (browseable), lcov (Codecov), json-summary
 *     (machine-readable for STATUS.md updates).
 *   - Thresholds: fail floor set at MIN(baseline, 60%) to prevent CI breakage
 *     on day-one. Aspirational target = 70% (Q-D6-1 locked). Day 7 backlog
 *     item: ramp coverage to 70%.
 *   - Excludes: scripts/, validators/, *.config.*, server.ts boot, instrument.ts,
 *     migration scripts, type-only files, dist/build artifacts.
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

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",

      // Scope: only src/ production code. Tests, scripts, validators
      // (schema-only), config files, and boot entry points are excluded.
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/__tests__/**",
        "src/test-helpers/**",
        "src/**/*.d.ts",
        "src/main.tsx", // React bootstrap — not unit-testable
        "src/vite-env.d.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/coverage/**",
        "**/*.config.*",
      ],

      // Thresholds — Day 6 Phase 3 baseline-driven (Q-D6-1).
      // Fail floor: MIN(baseline, target). Aspirational: 70%.
      //
      // Baselines:
      //   Day 6 close (Session 93, 42 tests):
      //     Statements 4.30% | Branches 3.00% | Functions 3.39% | Lines 4.81%
      //   Day 7 close (Session 94, +39 tests = 81 total):
      //     Statements 7.26% | Branches 4.54% | Functions 8.82% | Lines 7.99%
      //
      // Day 7 target was 25-30% statements (Q-D7-5 breadth-first scope).
      // Actual jump was smaller (~3pt) because route-level integration tests
      // with service mocks exercise controllers + middleware but not
      // service-layer business logic (where most LOC live). Day 8+ backlog:
      // unmock service layer for posts/search/messages OR add jsdom + RTL
      // for frontend React pages (the ~1500 uncovered lines of biggest
      // potential gain).
      //
      // Floors below are baseline rounded down with ~0.3-1pt safety margin.
      thresholds: {
        statements: 7,
        branches: 4,
        functions: 8,
        lines: 7,
      },
    },
  },
});
