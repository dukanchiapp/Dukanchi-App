import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * safeFetch unit tests (Session 128.38).
 *
 * Mocks `logger.warn` + Sentry.captureMessage to assert breadcrumbs fire on
 * terminal failure. Uses real timers — the helper's deadline math is short
 * enough (≤ 50ms in these tests) that wall-clock waits are fine; vitest's
 * fake-timer setup makes the global fetch + AbortController interaction
 * brittle.
 */

const sentryCalls: Array<{ message: string; tags: Record<string, string> }> = [];
const loggerCalls: Array<{ level: string; obj: Record<string, unknown> }> = [];

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn((message: string, opts: { tags: Record<string, string> }) => {
    sentryCalls.push({ message, tags: opts.tags });
  }),
  captureException: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    warn: vi.fn((obj: Record<string, unknown>, _msg: string) => loggerCalls.push({ level: 'warn', obj })),
    info: vi.fn(), error: vi.fn(), debug: vi.fn(),
  },
}));

import { safeFetch, withDeadline, DeadlineExceededError } from '../lib/safeFetch';

beforeEach(() => {
  sentryCalls.length = 0;
  loggerCalls.length = 0;
  vi.restoreAllMocks();
});

// Helper: replace globalThis.fetch for the duration of one test.
function withFetch(impl: typeof fetch, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => { globalThis.fetch = original; });
}

describe('safeFetch — happy path', () => {
  it('returns the Response on a fast 200', async () => {
    await withFetch(
      vi.fn().mockResolvedValue(new Response('ok', { status: 200 })) as unknown as typeof fetch,
      async () => {
        const res = await safeFetch('https://x/y', undefined, { label: 'test.happy', timeoutMs: 100 });
        expect('reason' in res).toBe(false);
        expect((res as Response).status).toBe(200);
        // No Sentry / no warn on the success path.
        expect(sentryCalls).toHaveLength(0);
        expect(loggerCalls).toHaveLength(0);
      },
    );
  });
});

describe('safeFetch — timeout', () => {
  it('aborts after timeoutMs + returns {ok:false, reason:"timeout"} + emits Sentry breadcrumb', async () => {
    // Fetch that hangs forever unless its signal aborts.
    const fakeFetch = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    await withFetch(fakeFetch as unknown as typeof fetch, async () => {
      const t0 = Date.now();
      const res = await safeFetch('https://x/hang', undefined, { label: 'test.timeout', timeoutMs: 50 });
      const elapsed = Date.now() - t0;

      // Discriminate the error union.
      expect('reason' in res).toBe(true);
      if (!('reason' in res)) throw new Error('expected error union');
      expect(res.reason).toBe('timeout');
      expect(res.attempts).toBe(1);
      expect(res.label).toBe('test.timeout');

      // Wall-clock fired within a generous envelope around the 50ms deadline.
      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(500);

      // Breadcrumb + Sentry message both fired with the supplied label.
      expect(sentryCalls).toHaveLength(1);
      expect(sentryCalls[0].message).toBe('safeFetch.test.timeout.timeout');
      expect(sentryCalls[0].tags).toMatchObject({ component: 'safeFetch', label: 'test.timeout', reason: 'timeout' });
      expect(loggerCalls).toHaveLength(1);
      expect(loggerCalls[0].obj).toMatchObject({ reason: 'timeout', label: 'test.timeout' });
    });
  });
});

describe('safeFetch — retry on 5xx', () => {
  it('retries up to `retries` times on 503, then returns the http-error union', async () => {
    let calls = 0;
    const fakeFetch = vi.fn(async () => {
      calls++;
      return new Response('boom', { status: 503 });
    });
    await withFetch(fakeFetch as unknown as typeof fetch, async () => {
      const res = await safeFetch('https://x/flaky', undefined, {
        label: 'test.5xx',
        timeoutMs: 200,
        retries: 2,
        backoffMs: [5, 10],
      });
      expect(calls).toBe(3); // 1 + 2 retries
      expect('reason' in res).toBe(true);
      if (!('reason' in res)) throw new Error('expected error union');
      expect(res.reason).toBe('http');
      expect(res.status).toBe(503);
      expect(res.attempts).toBe(3);
      expect(sentryCalls).toHaveLength(1);
    });
  });

  it('does NOT retry on 400 (4xx is terminal) + does NOT emit Sentry (caller error, not infra)', async () => {
    let calls = 0;
    const fakeFetch = vi.fn(async () => { calls++; return new Response('bad', { status: 400 }); });
    await withFetch(fakeFetch as unknown as typeof fetch, async () => {
      const res = await safeFetch('https://x/bad', undefined, { label: 'test.4xx', retries: 5 });
      expect(calls).toBe(1);
      expect('reason' in res).toBe(true);
      expect(sentryCalls).toHaveLength(0); // 4xx is silent — not an infra issue.
    });
  });
});

describe('withDeadline', () => {
  it('returns the underlying value when it resolves before the deadline', async () => {
    const val = await withDeadline(Promise.resolve('done'), 100, 'test.fast');
    expect(val).toBe('done');
    expect(sentryCalls).toHaveLength(0);
  });

  it('throws DeadlineExceededError after `ms` + emits Sentry breadcrumb', async () => {
    const hangs = new Promise<string>(() => { /* never resolves */ });
    await expect(withDeadline(hangs, 30, 'test.deadline')).rejects.toBeInstanceOf(DeadlineExceededError);
    expect(sentryCalls).toHaveLength(1);
    expect(sentryCalls[0].message).toBe('withDeadline.test.deadline.exceeded');
    expect(sentryCalls[0].tags.label).toBe('test.deadline');
  });
});
