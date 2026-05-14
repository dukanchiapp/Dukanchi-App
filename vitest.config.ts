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
      // Fail floor: MIN(baseline, 60%). Aspirational: 70%.
      //
      // Baseline (Session 93, commit e40c854 + this commit):
      //   Statements 4.30% | Branches 3.00% | Functions 3.39% | Lines 4.81%
      //
      // Floors below are baseline rounded down with ~0.3-1pt safety margin —
      // prevents flaky CI failures while still catching regressions of >1pt
      // on any metric. Day 7 backlog item: ramp coverage to 70% (huge gap;
      // multi-sprint effort focused on routes/services beyond auth + refresh).
      thresholds: {
        statements: 4,
        branches: 2,
        functions: 3,
        lines: 4,
      },
    },
  },
});
