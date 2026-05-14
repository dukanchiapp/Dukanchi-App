// Dukanchi root ESLint flat config — Day 7 / Session 94 / Phase 3.
//
// Closes ND-D7-3 (no root ESLint) + ND-D7-4 (no CI lint gate).
//
// Stack mirrors admin-panel/eslint.config.js for consistency:
//   - @eslint/js recommended
//   - typescript-eslint recommended
//   - react-hooks (flat) recommended
//   - react-refresh (vite preset)
//   - eslint-config-prettier (LAST — turns off ESLint stylistic rules
//     that conflict with Prettier; Prettier owns formatting, ESLint
//     owns correctness)
//
// CI runs `npm run lint` with `continue-on-error: true` (Q-D7-4 approved
// report-only initially). Promote to gating in Day 8+ once baseline is
// cleaned. Per Phase 3 hard gate: this config does NOT auto-fix or
// re-format the existing codebase. Cleanup is a separate sweep.
//
// admin-panel/ retains its own eslint.config.js (not affected by this
// root config — the `ignores` list below excludes it).
//
// Type-aware linting is INTENTIONALLY OFF (no parserOptions.project) —
// `npm run typecheck` already runs strict TS project configs (Rule G).
// Avoiding type-aware ESLint keeps lint runtime sub-second and matches
// admin-panel's posture.

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // Files / directories ESLint should never visit.
  globalIgnores([
    'node_modules/**',
    'dist/**',
    'dist-server/**',
    'build/**',
    'coverage/**',
    'admin-panel/**', // has its own eslint.config.js
    'android/**',
    'public/**',
    'prisma/migrations/**',
    'temp/**', // gitignored scratchpads
    'scripts/precommit-checks.sh', // shell script, not JS
    '.husky/**',
    '.claude/**', // Claude Code worktrees — contain stale repo snapshots
    '.code-review-graph/**',
    '*.min.js',
  ]),

  // Source code: TypeScript + TSX across both frontend (DOM) and backend (Node).
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettierConfig, // MUST be last
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser, // frontend pages + components
        ...globals.node, // server.ts, src/app.ts, modules/, services/
        ...globals.es2024,
      },
    },
    rules: {
      // Day 7 baseline: keep severity as defaults from extended configs.
      // The Phase 3 hard gate forbids tuning rules to mask warnings —
      // surface them honestly; promote to errors in Day 8+ sweep.
    },
  },

  // CommonJS scripts (e.g., scripts/generateIcons.cjs) — turn off
  // `no-require-imports` for these only.
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'commonjs',
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
