import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Session 128.48 — CSP regression guard for places.googleapis.com.
 *
 * Founder verified v112 (Phase-1 CSP enforce) → "Choose location" autocomplete
 * returned ZERO_RESULTS for valid queries. Root cause: Google Places
 * Autocomplete makes background fetches to `places.googleapis.com`, but the
 * CSP enforce only allowed `maps.googleapis.com` + `maps.gstatic.com`. The
 * new host was silently blocked.
 *
 * This test asserts the OBSERVABLE source contract: both `scriptSrc` and
 * `connectSrc` in `src/app.ts` must include `places.googleapis.com`. If a
 * future refactor removes the entry, this test fires before the regression
 * ships to prod.
 *
 * Pattern note: source-text scan (not import) mirrors `csp-enforce.test.ts`'s
 * deliberate avoidance of booting the full Express pipeline (Sentry / Redis /
 * Prisma init) just to verify directive contents.
 */

const APP_SOURCE = readFileSync(join(__dirname, '..', 'app.ts'), 'utf8');

function extractDirective(name: string): string {
  const re = new RegExp(`${name}:\\s*\\[([\\s\\S]*?)\\]`);
  const match = APP_SOURCE.match(re);
  if (!match) throw new Error(`Could not locate \`${name}\` directive in src/app.ts — did the CSP block move?`);
  return match[1];
}

describe('CSP directives — places.googleapis.com regression guard', () => {
  it('scriptSrc includes https://places.googleapis.com (Places library + sub-scripts)', () => {
    const scriptSrcBody = extractDirective('scriptSrc');
    expect(scriptSrcBody).toContain('https://places.googleapis.com');
  });

  it('connectSrc includes https://places.googleapis.com (AutocompleteService XHR + PlacesService.getDetails fetch)', () => {
    const connectSrcBody = extractDirective('connectSrc');
    expect(connectSrcBody).toContain('https://places.googleapis.com');
  });

  it('the existing maps.googleapis.com entries are preserved (regression safety net for the Maps SDK callsites)', () => {
    expect(extractDirective('scriptSrc')).toContain('https://maps.googleapis.com');
    expect(extractDirective('connectSrc')).toContain('https://maps.googleapis.com');
  });
});
