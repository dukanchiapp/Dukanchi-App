import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config — Session 112 (Tier 5B foundation).
 *
 * Scope tonight: **render-only smoke** for public pages (login + signup +
 * landing title) — NO form submission, NO data creation, NO auth state.
 * Auth / upload / chat E2E + CI integration deferred to a fresh-day task
 * once a test database / test JWT minting story exists (today is contained
 * post-CSP-rollback work).
 *
 * webServer:
 *   - Runs `npm run build` then `npm run preview` (Vite preview on :4173)
 *   - Backend is NOT mounted; the preview server is static-only. Tests that
 *     depend on API responses are explicitly OUT of scope here.
 *   - `reuseExistingServer: !process.env.CI` keeps local runs fast.
 *
 * Conventions:
 *   - testDir = 'e2e' (sibling of src/), testMatch '**​/*.spec.ts'
 *     → keeps vitest's `src/**​/*.test.ts` glob and this directory disjoint
 *   - Single chromium project — Firefox / WebKit added when CI lands
 *   - reporter: 'list' for terminal-friendly local output
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
