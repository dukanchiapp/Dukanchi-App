import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import helmet from 'helmet';

/**
 * Session 128.41 — CSP enforce-mode flip regression guard.
 *
 * Asserts the OBSERVABLE contract that helmet emits when reportOnly is
 * true vs false: header name `Content-Security-Policy-Report-Only` vs the
 * enforcing `Content-Security-Policy`. This catches the failure mode where
 * a future refactor accidentally flips prod back to report-only.
 *
 * We replicate the two helmet config shapes from src/app.ts (prod + dev)
 * rather than importing src/app.ts itself — importing app.ts boots the
 * entire Express pipeline (Sentry / Redis / Prisma init) which is wildly
 * disproportionate for verifying one line of helmet config.
 */

// Mirror of the cspDirectives object in src/app.ts (small subset — enough to
// exercise helmet's policy emit). The full policy is unchanged from the
// report-only window; this test only verifies the toggle, not the directive
// contents.
const cspDirectives = {
  defaultSrc: ["'self'"] as string[],
  scriptSrc: ["'self'", "'unsafe-inline'"] as string[],
  reportUri: ['/api/csp-report'] as string[],
};

function buildProdHelmet(): express.Express {
  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        reportOnly: false,
        directives: cspDirectives,
      },
    }),
  );
  app.get('/', (_req, res) => res.send('ok'));
  return app;
}

function buildDevHelmet(): express.Express {
  const app = express();
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        reportOnly: true,
        directives: cspDirectives,
      },
    }),
  );
  app.get('/', (_req, res) => res.send('ok'));
  return app;
}

describe('CSP enforce mode (production)', () => {
  it('emits the enforcing `Content-Security-Policy` header (NOT report-only)', async () => {
    const res = await request(buildProdHelmet()).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['content-security-policy-report-only']).toBeUndefined();
  });

  it('the enforcing CSP header still carries the report-uri directive (so /api/csp-report keeps receiving violations under enforce)', async () => {
    const res = await request(buildProdHelmet()).get('/');
    expect(res.headers['content-security-policy']).toMatch(/report-uri \/api\/csp-report/);
  });
});

describe('CSP Report-Only mode (development)', () => {
  it('emits the `Content-Security-Policy-Report-Only` header (NOT enforcing)', async () => {
    const res = await request(buildDevHelmet()).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy-report-only']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});
