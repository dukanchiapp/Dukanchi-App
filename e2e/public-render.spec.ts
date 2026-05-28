import { test, expect } from '@playwright/test';

/**
 * Public-page render smoke — Session 112 (Tier 5B foundation).
 *
 * Pure render + presence + visibility assertions on PUBLIC routes (no auth,
 * no DB, no form submission, no data creation). Catches the class of bug
 * that vitest-supertest cannot — selectors disappearing under a refactor,
 * client-side JS failing to mount, hot CDN dependency disappearing,
 * service-worker breakage on initial install, etc.
 *
 * The 2026-05-28 CSP enforce incident (S108→S110→S111) is exactly the kind
 * of bug class a Playwright render would have surfaced before deploy:
 * data: connect-src violation would have aborted the upload page's JS-side
 * fetch and the page would have rendered without the working input — a
 * real-browser assertion would have failed.
 *
 * Selectors locked against current code:
 *   - HTML title: "Dukanchi — Apna Bazaar, Apni Dukaan" (index.html:7)
 *   - /login: h1 "Wapas aagaye!", input[placeholder="Phone number"],
 *     input[placeholder="Password"], submit button containing "Log In",
 *     "Sign up" link → /signup
 *   - /signup: h1 "Shuru karte hain!", submit button containing "Sign Up"
 *
 * Out of scope (deferred to fresh-day work with test env):
 *   - Form submission paths (need test DB)
 *   - Authenticated routes (need JWT minting)
 *   - Upload pipeline (needs R2 mock or test bucket)
 *   - Chat/Socket.IO round-trips (needs test redis)
 */

test.describe('Public render smoke', () => {
  // index.html ships a pre-React guard that redirects browser visitors from
  // any non-/landing app route to /landing (the static public/landing.html
  // shell). Setting `dk-browser-mode = '1'` BEFORE any page script runs hits
  // the "Browser-mode user" branch and keeps the SPA mounted on /login,
  // /signup, etc. This matches how the production app behaves after a user
  // taps the "continue in browser" affordance.
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      try {
        localStorage.setItem('dk-browser-mode', '1');
      } catch {
        /* localStorage unavailable in iframes — no-op */
      }
    });
  });

  test('login page renders with phone, password, submit, signup link', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status(), 'login page HTTP status').toBeLessThan(400);

    // Title is set in index.html and inherited by every SPA route.
    await expect(page).toHaveTitle(/Dukanchi/);

    // Hindi heading proves the LoginPage component mounted (not a 404 fallback
    // and not a blank white screen because JS failed to execute).
    await expect(page.getByRole('heading', { name: /Wapas aagaye/i })).toBeVisible();

    // The two form inputs that take user-typed credentials.
    const phoneInput = page.getByPlaceholder('Phone number');
    const passwordInput = page.getByPlaceholder('Password');
    await expect(phoneInput).toBeVisible();
    await expect(phoneInput).toHaveAttribute('type', 'tel');
    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Submit button — text varies between idle ("Log In") and submitting
    // ("Logging in..."), so match on the idle string (render smoke = idle state).
    await expect(
      page.getByRole('button', { name: /Log In/i }),
    ).toBeVisible();

    // Cross-route nav target — confirms the public signup path is reachable
    // from login without auth gates.
    const signupLink = page.getByRole('link', { name: /Sign up/i });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute('href', /\/signup/);
  });

  test('signup page renders with signup heading and submit button', async ({ page }) => {
    const response = await page.goto('/signup');
    expect(response?.status(), 'signup page HTTP status').toBeLessThan(400);

    await expect(page).toHaveTitle(/Dukanchi/);

    // Hindi heading from src/pages/Signup.tsx — proves the component mounted.
    await expect(page.getByRole('heading', { name: /Shuru karte hain/i })).toBeVisible();

    // Sign Up submit button (idle state).
    await expect(
      page.getByRole('button', { name: /Sign Up/i }),
    ).toBeVisible();
  });
});
