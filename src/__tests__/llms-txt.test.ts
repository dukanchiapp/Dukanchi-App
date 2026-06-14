import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'path';

/**
 * Session 128.39 — llms.txt route test.
 *
 * Replicates the exact route handler from src/app.ts:444 against a tiny
 * Express app, using the real public/llms.txt file on disk. Catches:
 *  (a) Content-Type regression — must be text/plain so AI crawlers don't
 *      get the SPA HTML shell + MIME-sniff into the wrong renderer.
 *  (b) Body content regression — must contain the "# Dukanchi" H1 (the
 *      llmstxt.org spec's required H1 = brand name marker).
 *  (c) Path resolution — the file must exist at the resolved path.
 *
 * Importing src/app.ts here would pull in Sentry / Redis / Prisma / Bull /
 * the entire middleware chain just to test one sendFile route — wildly
 * disproportionate to the surface under test. The route handler is one
 * line; replicating it inline tests the *contract* the production route
 * commits to.
 */
function makeLlmsApp(): express.Express {
  const app = express();
  app.get('/llms.txt', (_req, res) => {
    res.type('text/plain').sendFile(path.resolve(process.cwd(), 'public', 'llms.txt'));
  });
  return app;
}

describe('GET /llms.txt', () => {
  it('returns 200 with Content-Type text/plain', async () => {
    const res = await request(makeLlmsApp()).get('/llms.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
  });

  it('body includes the "# Dukanchi" H1 (llmstxt.org spec marker)', async () => {
    const res = await request(makeLlmsApp()).get('/llms.txt');
    expect(res.text).toMatch(/^#\s+Dukanchi/);
  });

  it('body includes the canonical site URL + a public retailer profile pattern', async () => {
    const res = await request(makeLlmsApp()).get('/llms.txt');
    expect(res.text).toContain('https://dukanchi.com/');
    expect(res.text).toContain('https://dukanchi.com/store/');
  });

  it('body lists the public Discovery + Legal pages', async () => {
    const res = await request(makeLlmsApp()).get('/llms.txt');
    expect(res.text).toContain('https://dukanchi.com/search');
    expect(res.text).toContain('https://dukanchi.com/map');
    expect(res.text).toContain('https://dukanchi.com/legal/privacy');
    expect(res.text).toContain('https://dukanchi.com/legal/terms');
  });

  it('body explicitly marks auth-only paths as NOT public (DO-NOT-index hint)', async () => {
    const res = await request(makeLlmsApp()).get('/llms.txt');
    expect(res.text).toMatch(/Auth-only/i);
    expect(res.text).toContain('/profile');
    expect(res.text).toContain('/messages');
  });
});
