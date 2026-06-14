import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type express from 'express';

/**
 * Admin module input-validation rollout (Session 128.37) — 27-route follow-up
 * to PR #185 (B1 input validation). Same Path-A pattern: central
 * validators/schemas.ts + route-level validate/validateQuery/validateParams.
 *
 * Coverage philosophy mirrors input-validation.test.ts:
 *   1. Mass-assignment regressions on the privilege-write routes
 *      (PUT /users/:id, POST /users/bulk-update, PUT /settings) —
 *      extras MUST be stripped before reaching AdminService.
 *   2. Param/query sentinels — non-UUID :id → 400 (was: pass-through
 *      to controller, then 500/404 from Prisma); limit > 100 → 400.
 *   3. Body shape sentinels on the enum-bound routes (complaints/kyc) —
 *      a forged status like "superadmin"/"approved-by-me" → 400.
 *   4. Happy paths so we know the wiring didn't break the live UI.
 *
 * No real DB / Redis (Rule F). Auth is gated by a real admin JWT (signed
 * with the test secret + cookie name `dk_admin_token`), so 401/403 flow
 * BEFORE validation — matches production.
 */

const { TEST_JWT_SECRET } = vi.hoisted(() => ({
  TEST_JWT_SECRET: 'test-jwt-secret-32-chars-long-padding',
}));

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-long-pad',
    NODE_ENV: 'test',
    BCRYPT_ROUNDS: 4,
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://localhost:6379',
    GEMINI_API_KEY: 'test-key',
  },
  getAllowedOrigins: () => ['http://localhost'],
  isNgrokOrigin: () => false,
}));

vi.mock('../config/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    teamMember: { findUnique: vi.fn() },
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    // rate-limit-redis preloads Lua scripts via SCRIPT LOAD during RedisStore
    // init (admin routes import the upload limiter via /settings/upload).
    // Returning a fake script-sha string makes that init succeed silently;
    // no test exercises .increment() so the script is never actually invoked.
    // Mirror of backend-resilience.test.ts (Session 128.30) approach.
    sendCommand: vi.fn().mockResolvedValue('test-script-sha'),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

// All admin service methods we touch in this file get stubbed — the assertion
// is purely about HTTP→schema wiring and what reaches the service, not the
// service's own behaviour (covered separately).
vi.mock('../modules/admin/admin.service', () => ({
  AdminService: {
    getStats: vi.fn(),
    getUsers: vi.fn(),
    resetPassword: vi.fn(),
    updateUser: vi.fn(),
    bulkUpdateUsers: vi.fn(),
    deleteUser: vi.fn(),
    getStores: vi.fn(),
    deleteStore: vi.fn(),
    getStoreMembers: vi.fn(),
    getStoreMemberDetails: vi.fn(),
    deleteTeamMember: vi.fn(),
    exportStores: vi.fn(),
    getReports: vi.fn(),
    deleteReport: vi.fn(),
    getChats: vi.fn(),
    getChatHistory: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getComplaints: vi.fn(),
    updateComplaint: vi.fn(),
    deleteComplaint: vi.fn(),
    getPosts: vi.fn(),
    deletePost: vi.fn(),
    getKycList: vi.fn(),
    updateKycStatus: vi.fn(),
    uploadSettingsImage: vi.fn(),
  },
}));

import { adminRoutes } from '../modules/admin/admin.routes';
import { AdminService } from '../modules/admin/admin.service';
import { makeTestApp } from '../test-helpers/app-factory';
import { signTestJWT } from '../test-helpers/jwt-helpers';
import { makeTestUser } from '../test-helpers/fixtures';
import { prisma } from '../config/prisma';

const ADMIN_ID = '00000000-0000-0000-0000-0000000000ad';
const adminJwt = () => signTestJWT({ userId: ADMIN_ID, role: 'admin' });
const validUuid = '11111111-1111-4111-8111-111111111111';

const buildApp = () => makeTestApp({ routes: { '/api/admin': adminRoutes } });

beforeEach(() => {
  vi.clearAllMocks();
  // verifyAndAttach → getUserStatus → prisma.user.findUnique → returns this
  vi.mocked(prisma.user.findUnique).mockResolvedValue(
    makeTestUser({ role: 'admin' }) as never,
  );
  // Default happy-path success body for every list/get
  vi.mocked(AdminService.getStats).mockResolvedValue({} as never);
  vi.mocked(AdminService.getUsers).mockResolvedValue({ users: [], total: 0 } as never);
  vi.mocked(AdminService.getStores).mockResolvedValue({ stores: [], total: 0 } as never);
  vi.mocked(AdminService.updateUser).mockResolvedValue({ id: validUuid } as never);
  vi.mocked(AdminService.bulkUpdateUsers).mockResolvedValue({ count: 1 } as never);
  vi.mocked(AdminService.resetPassword).mockResolvedValue({ ok: true } as never);
  vi.mocked(AdminService.updateSettings).mockResolvedValue({} as never);
  vi.mocked(AdminService.updateComplaint).mockResolvedValue({} as never);
  vi.mocked(AdminService.updateKycStatus).mockResolvedValue({} as never);
});

// ── 1. Mass-assignment regression ───────────────────────────────────────────
describe('admin mass-assignment regression', () => {
  it('PUT /api/admin/users/:id → unknown body keys (balance, kycStatus, isAdminSuperPowers) MUST NOT reach AdminService.updateUser', async () => {
    const res = await request(buildApp())
      .put(`/api/admin/users/${validUuid}`)
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({
        // valid allowlisted fields
        role: 'retailer',
        isBlocked: true,
        // ── Attack payload — every one of these would have flowed through
        // under .passthrough(). Default-strip drops them at the schema.
        balance: 999_999,
        kycStatus: 'approved',
        isAdminSuperPowers: true,
        deletedAt: null,
        passwordHash: 'pwned',
      });

    expect(res.status).toBe(200);
    expect(AdminService.updateUser).toHaveBeenCalledOnce();
    // Controller signature: updateUser(id, role, isBlocked) — only those 3
    // values must be present, in that order. No extras can sneak in.
    expect(AdminService.updateUser).toHaveBeenCalledWith(validUuid, 'retailer', true);
  });

  it('PUT /api/admin/users/:id → forged role "superadmin" rejected at schema (was: silent privilege-set)', async () => {
    const res = await request(buildApp())
      .put(`/api/admin/users/${validUuid}`)
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({ role: 'superadmin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(AdminService.updateUser).not.toHaveBeenCalled();
  });

  it('POST /api/admin/users/bulk-update → extras (forceDeletePosts, role) stripped; service receives only userIds + isBlocked', async () => {
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-update')
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({
        userIds: [validUuid],
        isBlocked: true,
        // attack extras
        forceDeletePosts: true,
        role: 'admin',
        balance: 1,
      });

    expect(res.status).toBe(200);
    expect(AdminService.bulkUpdateUsers).toHaveBeenCalledOnce();
    // Controller signature: bulkUpdateUsers(userIds, isBlocked, currentUserId)
    expect(AdminService.bulkUpdateUsers).toHaveBeenCalledWith(
      [validUuid],
      true,
      ADMIN_ID,
    );
  });

  it('PUT /api/admin/settings → unknown keys stripped; service.updateSettings called with the allowlisted object only', async () => {
    const res = await request(buildApp())
      .put('/api/admin/settings')
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({
        appName: 'Dukanchi',
        primaryColor: '#123',
        // attack extras
        ownerId: 'attacker',
        secretFlag: true,
        adminEmail: 'h@x.com',
      });

    expect(res.status).toBe(200);
    expect(AdminService.updateSettings).toHaveBeenCalledOnce();
    const arg = vi.mocked(AdminService.updateSettings).mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(arg).sort()).toEqual(['appName', 'primaryColor'].sort());
    expect(arg).not.toHaveProperty('ownerId');
    expect(arg).not.toHaveProperty('secretFlag');
  });
});

// ── 2. Param + query sentinels ──────────────────────────────────────────────
describe('admin param/query validation', () => {
  it('DELETE /api/admin/users/not-a-uuid → 400 (was: pass-through, then Prisma error)', async () => {
    const res = await request(buildApp())
      .delete('/api/admin/users/not-a-uuid')
      .set('Cookie', `dk_admin_token=${adminJwt()}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('GET /api/admin/users?limit=99999 → 400 (limit cap enforced at the schema layer)', async () => {
    const res = await request(buildApp())
      .get('/api/admin/users?limit=99999')
      .set('Cookie', `dk_admin_token=${adminJwt()}`);
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/users?role=superadmin → 400 (only 6 known roles or "all" allowed)', async () => {
    const res = await request(buildApp())
      .get('/api/admin/users?role=superadmin')
      .set('Cookie', `dk_admin_token=${adminJwt()}`);
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/users?role=all&page=2&limit=15 → 200 happy path matches live UI shape', async () => {
    const res = await request(buildApp())
      .get('/api/admin/users?role=all&page=2&limit=15&search=foo')
      .set('Cookie', `dk_admin_token=${adminJwt()}`);
    expect(res.status).toBe(200);
    expect(AdminService.getUsers).toHaveBeenCalledOnce();
  });

  it('GET /api/admin/chats/history → 400 when u1 is missing', async () => {
    const res = await request(buildApp())
      .get(`/api/admin/chats/history?u2=${validUuid}`)
      .set('Cookie', `dk_admin_token=${adminJwt()}`);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.issues)).toMatch(/u1/);
  });

  it('GET /api/admin/store-members/:storeId → 400 on non-UUID storeId', async () => {
    const res = await request(buildApp())
      .get('/api/admin/store-members/abc')
      .set('Cookie', `dk_admin_token=${adminJwt()}`);
    expect(res.status).toBe(400);
  });
});

// ── 3. Body shape sentinels (status enums + required fields) ────────────────
describe('admin body validation', () => {
  it('POST /api/admin/reset-password → 400 when newPassword < 8 chars', async () => {
    const res = await request(buildApp())
      .post('/api/admin/reset-password')
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({ userId: validUuid, newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(AdminService.resetPassword).not.toHaveBeenCalled();
  });

  it('PUT /api/admin/complaints/:id → 400 on invalid status (e.g. "lol")', async () => {
    const res = await request(buildApp())
      .put(`/api/admin/complaints/${validUuid}`)
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({ status: 'lol' });
    expect(res.status).toBe(400);
    expect(AdminService.updateComplaint).not.toHaveBeenCalled();
  });

  it('PUT /api/admin/kyc/:id → 400 when status missing (required field)', async () => {
    const res = await request(buildApp())
      .put(`/api/admin/kyc/${validUuid}`)
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({ notes: 'looks good' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.issues)).toMatch(/status/);
    expect(AdminService.updateKycStatus).not.toHaveBeenCalled();
  });

  it('PUT /api/admin/kyc/:id → 400 on forged status "fake"', async () => {
    const res = await request(buildApp())
      .put(`/api/admin/kyc/${validUuid}`)
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({ status: 'fake' });
    expect(res.status).toBe(400);
  });

  it('PUT /api/admin/kyc/:id → 200 on valid {status:"approved"} (live UI happy path)', async () => {
    const res = await request(buildApp())
      .put(`/api/admin/kyc/${validUuid}`)
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(AdminService.updateKycStatus).toHaveBeenCalledWith(validUuid, 'approved', undefined);
  });

  it('POST /api/admin/users/bulk-update → 400 when userIds is empty', async () => {
    const res = await request(buildApp())
      .post('/api/admin/users/bulk-update')
      .set('Cookie', `dk_admin_token=${adminJwt()}`)
      .send({ userIds: [], isBlocked: true });
    expect(res.status).toBe(400);
  });
});

// ── 4. Auth gate still fires BEFORE validation (defense in depth) ───────────
describe('admin auth precedence', () => {
  it('PUT /api/admin/users/:id without dk_admin_token → 401 (auth runs first, validation never reached)', async () => {
    // No cookie set — verifyAndAttach returns 401.
    const res = await request(buildApp())
      .put(`/api/admin/users/${validUuid}`)
      .send({ role: 'retailer' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/admin/users/not-a-uuid without auth → 401 (still 401, NOT 400 — validation must not leak before auth)', async () => {
    const res = await request(buildApp())
      .delete('/api/admin/users/not-a-uuid');
    expect(res.status).toBe(401);
  });
});
