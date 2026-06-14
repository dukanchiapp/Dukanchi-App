import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.47 / Phase 5.3 — ask-nearby spec coverage.
 *
 * 6 module-level exports (296 LOC):
 *   - checkHourlyLimit (10/hr default; new entry → allowed; saturated → denied)
 *   - getHourlyLimitStatus (read-only inspection — never mutates the map)
 *   - sendAskNearby (bbox + Haversine + optional safeFetch-Gemini category
 *     routing + socket emit + best-effort push)
 *   - respondToAskNearby — IDOR-CRITICAL: 404 / 403 / 400 boundary gates
 *   - getMyRequests (WHERE customerId scoped)
 *   - getPendingRequests (WHERE ownerId scoped — IDOR proof)
 *
 * Philosophy: tests encode the INTENDED SPEC. If a spec test fails it
 * means a real bug exists → STOP, report it, do NOT weaken.
 */

vi.mock('../config/prisma', () => ({
  prisma: {
    store: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    askNearbyRequest: { create: vi.fn(), findMany: vi.fn() },
    askNearbyResponse: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    message: { create: vi.fn() },
  },
}));

vi.mock('../config/socket', () => ({
  getIO: vi.fn(),
}));

vi.mock('../services/push.service', () => ({
  sendPushToUser: vi.fn(),
}));

vi.mock('../lib/safeFetch', () => ({
  safeFetch: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { prisma } from '../config/prisma';
import { getIO } from '../config/socket';
import { sendPushToUser } from '../services/push.service';
import { safeFetch } from '../lib/safeFetch';
import {
  checkHourlyLimit,
  getHourlyLimitStatus,
  sendAskNearby,
  respondToAskNearby,
  getMyRequests,
  getPendingRequests,
} from '../modules/ask-nearby/ask-nearby.service';

const OWNER_A = 'owner-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OWNER_B = 'owner-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CUSTOMER_A = 'cust-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

// io mock helper — chainable .to().emit()
function setupIO() {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  vi.mocked(getIO).mockReturnValue({ to } as never);
  return { to, emit };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sendPushToUser).mockResolvedValue({ sent: 1 } as never);
});

// ── 1. checkHourlyLimit ────────────────────────────────────────────────────
describe('ask-nearby.checkHourlyLimit', () => {
  it('first call for a user → allowed:true, count:1, fresh resetAt 1h ahead', () => {
    // Unique userId so this doesn't collide with other tests sharing the map.
    const result = checkHourlyLimit('rl-test-first-call-user', 10);
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.remainingMs).toBeGreaterThan(3_599_000);
    expect(result.remainingMs).toBeLessThanOrEqual(3_600_000);
  });

  it('10 calls within the hour → allowed up to and including the 10th; 11th denied', () => {
    const userId = 'rl-test-saturate-user';
    for (let i = 1; i <= 10; i++) {
      const r = checkHourlyLimit(userId, 10);
      expect(r.allowed).toBe(true);
      expect(r.count).toBe(i);
    }
    const denied = checkHourlyLimit(userId, 10);
    expect(denied.allowed).toBe(false);
    expect(denied.count).toBe(10);  // count does NOT increment on denial
    expect(denied.remainingMs).toBeGreaterThan(0);
  });

  it('past resetAt → window resets to count:1 (independent of prior saturation)', () => {
    const userId = 'rl-test-expiry-user';
    // Saturate
    for (let i = 0; i < 10; i++) checkHourlyLimit(userId, 10);
    // Manipulate Date.now to advance past resetAt
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 3_700_000;  // 1h 1m future
      const r = checkHourlyLimit(userId, 10);
      expect(r.allowed).toBe(true);
      expect(r.count).toBe(1);  // Fresh window
    } finally {
      Date.now = realNow;
    }
  });
});

// ── 2. getHourlyLimitStatus ────────────────────────────────────────────────
describe('ask-nearby.getHourlyLimitStatus', () => {
  it('no prior entry → count:0, max:10, full 1h remainingMs (read-only)', () => {
    const result = getHourlyLimitStatus('rl-status-fresh-user', 10);
    expect(result.count).toBe(0);
    expect(result.max).toBe(10);
    expect(result.remainingMs).toBe(3_600_000);
  });

  it('read-only — does NOT mutate the rate-limit map (subsequent checkHourlyLimit still starts at 1)', () => {
    const userId = 'rl-status-noop-user';
    getHourlyLimitStatus(userId, 10);
    getHourlyLimitStatus(userId, 10);
    getHourlyLimitStatus(userId, 10);
    // The first checkHourlyLimit should still see count=1 (status calls did not increment)
    const r = checkHourlyLimit(userId, 10);
    expect(r.count).toBe(1);
  });

  it('after entry exists → reports current count + actual resetAt', () => {
    const userId = 'rl-status-mid-user';
    checkHourlyLimit(userId, 10);
    checkHourlyLimit(userId, 10);
    const status = getHourlyLimitStatus(userId, 10);
    expect(status.count).toBe(2);
    expect(status.max).toBe(10);
    expect(status.remainingMs).toBeGreaterThan(0);
  });
});

// ── 3. sendAskNearby ───────────────────────────────────────────────────────
describe('ask-nearby.sendAskNearby', () => {
  beforeEach(() => {
    // Clear GEMINI_API_KEY by default so the AI fallback branch doesn't fire
    // unless a test sets it. Use undefined-equivalent.
    delete process.env.GEMINI_API_KEY;
  });

  it('happy path: matching stores nearby → creates request + responses + emits per-owner + push (best-effort)', async () => {
    const { to, emit } = setupIO();
    // Two nearby stores, both with the requested product
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([
      { id: 'store-1', ownerId: OWNER_A, storeName: 'Shop A', latitude: 28.6, longitude: 77.2 },
      { id: 'store-2', ownerId: OWNER_B, storeName: 'Shop B', latitude: 28.61, longitude: 77.21 },
    ] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([
      { storeId: 'store-1' },
      { storeId: 'store-2' },
    ] as never);
    vi.mocked(prisma.askNearbyRequest.create).mockResolvedValueOnce({ id: 'req-1' } as never);
    vi.mocked(prisma.askNearbyResponse.createMany).mockResolvedValueOnce({ count: 2 } as never);
    vi.mocked(prisma.askNearbyResponse.findMany).mockResolvedValueOnce([
      { id: 'resp-1', storeId: 'store-1', ownerId: OWNER_A },
      { id: 'resp-2', storeId: 'store-2', ownerId: OWNER_B },
    ] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: 'Customer X' } as never);

    const result = await sendAskNearby(CUSTOMER_A, 'milk', 2, 28.6, 77.2);
    expect(result).toMatchObject({ requestId: 'req-1', sentTo: 2 });
    expect(result.storeNames).toEqual(['Shop A', 'Shop B']);
    // Per-owner socket emit
    expect(to).toHaveBeenCalledWith(OWNER_A);
    expect(to).toHaveBeenCalledWith(OWNER_B);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[0][0]).toBe('ask_nearby_request');
    // Best-effort push for both owners
    expect(sendPushToUser).toHaveBeenCalledTimes(2);
  });

  it('no nearby stores at all → returns {found:0, message} short-circuit; NO write of request', async () => {
    setupIO();
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([] as never);
    const result = await sendAskNearby(CUSTOMER_A, 'milk', 2, 28.6, 77.2);
    expect(result.found).toBe(0);
    expect(result.message).toMatch(/koi matching store nahi mila/);
    expect(prisma.askNearbyRequest.create).not.toHaveBeenCalled();
    expect(prisma.askNearbyResponse.createMany).not.toHaveBeenCalled();
  });

  it('nearby stores exist but Haversine refinement excludes all (outside true circle) → returns {found:0}', async () => {
    setupIO();
    // Bounding box returns a store, but it's far enough that Haversine excludes it
    // Bounding box: radiusKm=1 → latDelta ≈ 0.009. Set store > 1km away from (0,0)
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([
      { id: 'store-far', ownerId: OWNER_A, storeName: 'Far', latitude: 0.009, longitude: 0.009 },  // ~1.4km from (0,0)
    ] as never);
    const result = await sendAskNearby(CUSTOMER_A, 'milk', 1, 0, 0);
    expect(result.found).toBe(0);
  });

  it('nearby stores exist but no products match + Gemini not configured → returns {found:0} (no AI fallback)', async () => {
    setupIO();
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([
      { id: 'store-1', ownerId: OWNER_A, storeName: 'Shop A', latitude: 28.6, longitude: 77.2 },
    ] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    // GEMINI_API_KEY undefined from outer beforeEach
    const result = await sendAskNearby(CUSTOMER_A, 'milk', 2, 28.6, 77.2);
    expect(result.found).toBe(0);
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it('Gemini AI Category Routing — safeFetch is called with timeoutMs:5000 + retries:0 (bounded per #128.38)', async () => {
    setupIO();
    process.env.GEMINI_API_KEY = 'fake-test-key';
    vi.mocked(prisma.store.findMany)
      .mockResolvedValueOnce([
        { id: 'store-1', ownerId: OWNER_A, storeName: 'Shop A', latitude: 28.6, longitude: 77.2 },
      ] as never)
      .mockResolvedValueOnce([{ id: 'store-1' }] as never);  // categoryStores
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);  // no direct match
    // Gemini returns "Grocery"
    vi.mocked(safeFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Grocery' }] } }] }),
    } as never);
    vi.mocked(prisma.askNearbyRequest.create).mockResolvedValueOnce({ id: 'req-x' } as never);
    vi.mocked(prisma.askNearbyResponse.createMany).mockResolvedValueOnce({ count: 1 } as never);
    vi.mocked(prisma.askNearbyResponse.findMany).mockResolvedValueOnce([
      { id: 'resp-1', storeId: 'store-1', ownerId: OWNER_A },
    ] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: 'C' } as never);

    await sendAskNearby(CUSTOMER_A, 'milk', 2, 28.6, 77.2);
    // Critical: safeFetch was invoked with bounded options
    const args = vi.mocked(safeFetch).mock.calls[0];
    expect(args[2]).toMatchObject({ label: 'gemini.ask-nearby', timeoutMs: 5_000, retries: 0 });
  });

  it('Gemini safeFetch returns terminal {reason} → no AI category match + falls through gracefully (no throw)', async () => {
    setupIO();
    process.env.GEMINI_API_KEY = 'fake-test-key';
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([
      { id: 'store-1', ownerId: OWNER_A, storeName: 'Shop A', latitude: 28.6, longitude: 77.2 },
    ] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([] as never);
    // Terminal failure shape from safeFetch — {reason, attempts}
    vi.mocked(safeFetch).mockResolvedValueOnce({ reason: 'timeout', attempts: 1 } as never);

    const result = await sendAskNearby(CUSTOMER_A, 'milk', 2, 28.6, 77.2);
    // No category fallback → still no match → {found:0}
    expect(result.found).toBe(0);
    expect(prisma.askNearbyRequest.create).not.toHaveBeenCalled();
  });

  it('push notification failure is best-effort — does NOT throw or block the request flow', async () => {
    setupIO();
    vi.mocked(prisma.store.findMany).mockResolvedValueOnce([
      { id: 'store-1', ownerId: OWNER_A, storeName: 'Shop A', latitude: 28.6, longitude: 77.2 },
    ] as never);
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([{ storeId: 'store-1' }] as never);
    vi.mocked(prisma.askNearbyRequest.create).mockResolvedValueOnce({ id: 'req-1' } as never);
    vi.mocked(prisma.askNearbyResponse.createMany).mockResolvedValueOnce({ count: 1 } as never);
    vi.mocked(prisma.askNearbyResponse.findMany).mockResolvedValueOnce([
      { id: 'resp-1', storeId: 'store-1', ownerId: OWNER_A },
    ] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: 'C' } as never);
    vi.mocked(sendPushToUser).mockRejectedValueOnce(new Error('push down'));

    const result = await sendAskNearby(CUSTOMER_A, 'milk', 2, 28.6, 77.2);
    // Push failed but the request still completed.
    expect(result).toMatchObject({ requestId: 'req-1', sentTo: 1 });
  });
});

// ── 4. respondToAskNearby — IDOR-CRITICAL ──────────────────────────────────
describe('ask-nearby.respondToAskNearby (IDOR)', () => {
  it('non-existent responseId → throws 404 Not found; NO DB update', async () => {
    vi.mocked(prisma.askNearbyResponse.findUnique).mockResolvedValueOnce(null as never);
    let captured: any;
    try {
      await respondToAskNearby(OWNER_A, 'does-not-exist', 'yes');
    } catch (e: any) { captured = e; }
    expect(captured).toBeDefined();
    expect(captured.status).toBe(404);
    expect(captured.message).toMatch(/Not found/);
    expect(prisma.askNearbyResponse.update).not.toHaveBeenCalled();
  });

  it('IDOR PROOF: response.ownerId !== caller ownerId → throws 403 Forbidden; NO update, NO message creation', async () => {
    // Response belongs to OWNER_A but OWNER_B tries to respond
    vi.mocked(prisma.askNearbyResponse.findUnique).mockResolvedValueOnce({
      id: 'resp-1',
      ownerId: OWNER_A,
      status: 'pending',
      storeId: 'store-1',
      request: { customerId: CUSTOMER_A, query: 'milk' },
      store: { storeName: 'Shop A' },
    } as never);

    let captured: any;
    try {
      await respondToAskNearby(OWNER_B, 'resp-1', 'yes');  // wrong owner
    } catch (e: any) { captured = e; }
    expect(captured).toBeDefined();
    expect(captured.status).toBe(403);
    expect(captured.message).toMatch(/Forbidden/);
    // CRITICAL: zero side effects on IDOR rejection
    expect(prisma.askNearbyResponse.update).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('already responded (status !== pending) → throws 400 Already responded; no double-update', async () => {
    vi.mocked(prisma.askNearbyResponse.findUnique).mockResolvedValueOnce({
      id: 'resp-1',
      ownerId: OWNER_A,
      status: 'yes',  // already answered
      storeId: 'store-1',
      request: { customerId: CUSTOMER_A, query: 'milk' },
      store: { storeName: 'Shop A' },
    } as never);

    let captured: any;
    try {
      await respondToAskNearby(OWNER_A, 'resp-1', 'no');
    } catch (e: any) { captured = e; }
    expect(captured).toBeDefined();
    expect(captured.status).toBe(400);
    expect(prisma.askNearbyResponse.update).not.toHaveBeenCalled();
  });

  it('owner OK + answer="yes" → updates status, creates auto-message, sets conversationId, emits confirmed', async () => {
    const { to, emit } = setupIO();
    vi.mocked(prisma.askNearbyResponse.findUnique).mockResolvedValueOnce({
      id: 'resp-1',
      ownerId: OWNER_A,
      status: 'pending',
      storeId: 'store-1',
      request: { customerId: CUSTOMER_A, query: 'milk' },
      store: { storeName: 'Shop A' },
    } as never);
    vi.mocked(prisma.askNearbyResponse.update).mockResolvedValue({ id: 'resp-1' } as never);
    vi.mocked(prisma.message.create).mockResolvedValueOnce({ id: 'msg-1' } as never);

    const result = await respondToAskNearby(OWNER_A, 'resp-1', 'yes');
    expect(result).toEqual({ status: 'updated' });

    // First update: status+respondedAt
    const firstUpdateArgs = vi.mocked(prisma.askNearbyResponse.update).mock.calls[0][0] as any;
    expect(firstUpdateArgs.where).toEqual({ id: 'resp-1' });
    expect(firstUpdateArgs.data.status).toBe('yes');
    expect(firstUpdateArgs.data.respondedAt).toBeInstanceOf(Date);

    // Auto-message created from owner → customer
    const msgArgs = vi.mocked(prisma.message.create).mock.calls[0][0] as any;
    expect(msgArgs.data.senderId).toBe(OWNER_A);
    expect(msgArgs.data.receiverId).toBe(CUSTOMER_A);
    expect(msgArgs.data.message).toContain('milk');

    // Second update: conversationId = customerId
    expect(vi.mocked(prisma.askNearbyResponse.update).mock.calls).toHaveLength(2);
    const secondUpdateArgs = vi.mocked(prisma.askNearbyResponse.update).mock.calls[1][0] as any;
    expect(secondUpdateArgs.data.conversationId).toBe(CUSTOMER_A);

    // Socket emit to customer with ask_nearby_confirmed
    expect(to).toHaveBeenCalledWith(CUSTOMER_A);
    expect(emit).toHaveBeenCalledWith('ask_nearby_confirmed', expect.objectContaining({
      storeId: 'store-1',
      storeName: 'Shop A',
      conversationId: OWNER_A,
    }));
  });

  it('owner OK + answer="no" → updates status only; NO auto-message, NO socket emit', async () => {
    const { emit } = setupIO();
    vi.mocked(prisma.askNearbyResponse.findUnique).mockResolvedValueOnce({
      id: 'resp-1',
      ownerId: OWNER_A,
      status: 'pending',
      storeId: 'store-1',
      request: { customerId: CUSTOMER_A, query: 'milk' },
      store: { storeName: 'Shop A' },
    } as never);
    vi.mocked(prisma.askNearbyResponse.update).mockResolvedValue({ id: 'resp-1' } as never);

    const result = await respondToAskNearby(OWNER_A, 'resp-1', 'no');
    expect(result).toEqual({ status: 'updated' });
    expect(vi.mocked(prisma.askNearbyResponse.update).mock.calls).toHaveLength(1);
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});

// ── 5. getMyRequests — WHERE customerId scope ──────────────────────────────
describe('ask-nearby.getMyRequests (IDOR scope)', () => {
  it('WHERE clause scoped to customerId; take:10; orderBy createdAt desc', async () => {
    vi.mocked(prisma.askNearbyRequest.findMany).mockResolvedValueOnce([] as never);
    await getMyRequests(CUSTOMER_A);
    const args = vi.mocked(prisma.askNearbyRequest.findMany).mock.calls[0][0] as any;
    expect(args.where).toEqual({ customerId: CUSTOMER_A });
    expect(args.take).toBe(10);
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    // Includes responses scoped to status:'yes' (only confirmed)
    expect(args.include.responses.where).toEqual({ status: 'yes' });
  });
});

// ── 6. getPendingRequests — WHERE ownerId scope (IDOR proof) ────────────────
describe('ask-nearby.getPendingRequests (IDOR scope)', () => {
  it('WHERE clause scoped to ownerId — never cross-tenant', async () => {
    vi.mocked(prisma.askNearbyResponse.findMany).mockResolvedValueOnce([] as never);
    await getPendingRequests(OWNER_A);
    const args = vi.mocked(prisma.askNearbyResponse.findMany).mock.calls[0][0] as any;
    expect(args.where.ownerId).toBe(OWNER_A);
    // Also includes pending OR no-with-recent-respondedAt for UX
    expect(args.where.OR).toEqual(expect.arrayContaining([
      { status: 'pending' },
      expect.objectContaining({ status: 'no' }),
    ]));
    expect(args.take).toBe(10);
  });

  it('the "no, but recent" branch — respondedAt gte uses ~24h window (3,600,000 * 24 = 86,400,000 ms)', async () => {
    vi.mocked(prisma.askNearbyResponse.findMany).mockResolvedValueOnce([] as never);
    const before = Date.now();
    await getPendingRequests(OWNER_A);
    const after = Date.now();
    const args = vi.mocked(prisma.askNearbyResponse.findMany).mock.calls[0][0] as any;
    const noBranch = args.where.OR.find((c: any) => c.status === 'no');
    const gteMs = (noBranch.respondedAt.gte as Date).getTime();
    // Approx 24h ago from the moment getPendingRequests ran.
    expect(gteMs).toBeGreaterThanOrEqual(before - 24 * 60 * 60 * 1000 - 100);
    expect(gteMs).toBeLessThanOrEqual(after - 24 * 60 * 60 * 1000 + 100);
  });
});
