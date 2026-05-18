import { describe, it, expect } from 'vitest';
import { isPublicPath } from './publicRoutes';

/**
 * Guards the public-route allow-list. A regression here would re-break the
 * DPDP requirement that legal docs are readable before signup — the exact
 * bug this config was added to fix.
 */
describe('isPublicPath', () => {
  it('treats every /legal/* document as public (readable pre-signup)', () => {
    for (const p of [
      '/legal/privacy',
      '/legal/terms',
      '/legal/account-deletion',
      '/legal/grievance',
      '/legal/cookies',
    ]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it('treats the auth pages as public', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/signup')).toBe(true);
  });

  it('does NOT make authenticated app routes public', () => {
    for (const p of ['/', '/profile', '/map', '/messages', '/retailer/dashboard', '/settings', '/store/abc']) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it('the /legal/ prefix does not false-match similar paths', () => {
    expect(isPublicPath('/legal')).toBe(false);     // no index route exists
    expect(isPublicPath('/legalish')).toBe(false);  // not a /legal/ child
  });
});
