import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.42 — direct AuthService spec coverage.
 *
 * Existing HTTP-level coverage:
 *   - auth.integration.test.ts — login happy/wrong-pw/blocked/deleted_pending, /me, /refresh carve-out
 *   - auth.refresh.test.ts     — refresh rotation/reuse/no-cookie/logout/admin cookies
 *   - signup-consent.test.ts   — DPDP consent ledger, IP hashing, UA truncation, transaction atomicity
 *
 * Gaps this file fills (direct service-level spec):
 *   1. checkPhone — 0 prior tests
 *   2. signup — 3-case dup-phone branch (active / deleted_pending / deleted_expired)
 *   3. signup — bcrypt rounds sourced from env.BCRYPT_ROUNDS
 *   4. login — User-vs-TeamMember precedence (User wins even when phone also in TeamMember)
 *   5. login — opaque-error parity (wrong-pw on known-phone === unknown-phone, no error-string leak)
 *   6. login — password verify BEFORE availability check (so blocked state isn't probable via wrong-pw)
 *   7. login — TeamMember impersonates store owner (userId = ownerId, teamMemberId carried)
 *   8. issueTokenForUser — deprecated but still exported; missing-user, blocked, deleted_pending carve-out
 *
 * Philosophy: tests encode the INTENDED SPEC. If a spec test FAILS, that
 * means a real bug exists → STOP, report it, do NOT weaken the test.
 */

const { TEST_JWT_SECRET, TEST_JWT_REFRESH_SECRET } = vi.hoisted(() => ({
  TEST_JWT_SECRET: 'test-jwt-secret-32-chars-long-padding',
  TEST_JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-long-pad',
}));

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: TEST_JWT_SECRET,
    JWT_REFRESH_SECRET: TEST_JWT_REFRESH_SECRET,
    NODE_ENV: 'test',
    BCRYPT_ROUNDS: 4,  // matches the prod env contract; bcrypt encodes cost in the hash
    DATABASE_URL: 'postgresql://test',
    REDIS_URL: 'redis://localhost:6379',
    GEMINI_API_KEY: 'test-key',
    IP_SALT: 'test-ip-salt',
  },
  getAllowedOrigins: () => ['http://localhost'],
  isNgrokOrigin: () => false,
}));

vi.mock('../config/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    teamMember: { findUnique: vi.fn() },
    legalConsent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../config/redis', () => ({
  pubClient: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/refreshToken.service', () => ({
  generateRefreshToken: vi.fn(async (userId: string, role: string) => ({
    token: `refresh-token-for-${userId}-${role}`,
    jti: 'jti-stub',
  })),
}));

import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';
import { AuthService, UnavailableUserError } from '../modules/auth/auth.service';
import { generateRefreshToken } from '../services/refreshToken.service';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. checkPhone ──────────────────────────────────────────────────────────
describe('AuthService.checkPhone', () => {
  it('returns true when the phone exists on the User table', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'u1' } as never);
    expect(await AuthService.checkPhone('9999999999')).toBe(true);
    // Short-circuits — does NOT also probe teamMember once the User row is found.
    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to TeamMember when no User row matches', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({ id: 't1' } as never);
    expect(await AuthService.checkPhone('9999999999')).toBe(true);
    expect(prisma.teamMember.findUnique).toHaveBeenCalledOnce();
  });

  it('returns false when neither table has the phone', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as never);
    expect(await AuthService.checkPhone('9999999999')).toBe(false);
  });
});

// ── 2. signup — 3-case dup-phone branch (D1 30-day grace policy) ────────────
describe('AuthService.signup — dup-phone 3-case branch', () => {
  const signupArgs = {
    name: 'Test', phone: '9999999999', password: 'pw12345678', role: 'customer', location: 'X',
  };

  it('(a) active duplicate → throws "This phone number already exists"', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', phone: '9999999999', deletedAt: null,
    } as never);
    await expect(AuthService.signup(signupArgs)).rejects.toThrow('This phone number already exists');
    // No tx attempted on the dup-error path.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('(b) deleted-but-in-grace duplicate → throws UnavailableUserError("deleted_pending")', async () => {
    // Future deletedAt — still in the 30-day grace window
    const futureDeletedAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', phone: '9999999999', deletedAt: futureDeletedAt,
    } as never);

    // Single call — both instanceof + reason assertions on the same thrown error.
    let captured: unknown;
    try {
      await AuthService.signup(signupArgs);
    } catch (e) {
      captured = e;
    }
    expect(captured).toBeInstanceOf(UnavailableUserError);
    expect((captured as UnavailableUserError).unavailableReason).toBe('deleted_pending');
  });

  it('(c) past-grace duplicate → throws opaque "This phone number already exists" (hard-delete worker TODO)', async () => {
    // Past deletedAt — grace expired but the row still occupies the unique phone slot
    const pastDeletedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', phone: '9999999999', deletedAt: pastDeletedAt,
    } as never);
    await expect(AuthService.signup(signupArgs)).rejects.toThrow('This phone number already exists');
  });
});

// ── 3. signup happy path — bcrypt rounds + DPDP ledger + return shape ──────
describe('AuthService.signup — happy path', () => {
  beforeEach(() => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);  // no dup
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      // Emulate Prisma's tx — pass a stub tx with the same fn shape.
      const tx = {
        user: { create: vi.fn().mockResolvedValue({
          id: 'u1', name: 'Test', phone: '9999999999', role: 'customer',
          password: 'whatever-the-hash-is', location: 'X',
        }) },
        legalConsent: { create: vi.fn().mockResolvedValue({}) },
        fcmToken: { deleteMany: vi.fn() },
        pushSubscription: { deleteMany: vi.fn() },
      };
      return cb(tx);
    });
  });

  it('hashes the password with env.BCRYPT_ROUNDS (4 in test env)', async () => {
    const hashSpy = vi.spyOn(bcrypt, 'hash');
    await AuthService.signup({ name: 'A', phone: '9999999999', password: 'pw12345678', role: 'customer', location: 'X' });
    expect(hashSpy).toHaveBeenCalledOnce();
    const [pw, rounds] = hashSpy.mock.calls[0];
    expect(pw).toBe('pw12345678');
    // bcrypt cost factor — wired from env.BCRYPT_ROUNDS (we set 4 in test env above).
    expect(rounds).toBe(4);
    hashSpy.mockRestore();
  });

  it('returns the user (password stripped) + accessToken + refreshToken', async () => {
    const res = await AuthService.signup({ name: 'A', phone: '9999999999', password: 'pw12345678', role: 'customer', location: 'X' });
    expect(res.user).toBeDefined();
    expect((res.user as Record<string, unknown>).password).toBeUndefined();
    expect(typeof res.accessToken).toBe('string');
    expect(res.refreshToken).toBe('refresh-token-for-u1-customer');
  });
});

// ── 4. login — opaque-error parity ─────────────────────────────────────────
describe('AuthService.login — opaque-error parity (security: no probing)', () => {
  it('unknown phone → "Invalid credentials"', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as never);
    await expect(AuthService.login({ phone: '9999999999', password: 'pw12345678' })).rejects.toThrow('Invalid credentials');
  });

  it('known phone + wrong password → "Invalid credentials" (SAME string as unknown-phone — no error-string leak)', async () => {
    const realHash = await bcrypt.hash('correct-password', 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', phone: '9999999999', password: realHash, role: 'customer', isBlocked: false, deletedAt: null,
    } as never);
    await expect(AuthService.login({ phone: '9999999999', password: 'WRONG' })).rejects.toThrow('Invalid credentials');
  });

  it('SECURITY: blocked user with WRONG password → "Invalid credentials" (the wrong-pw error fires BEFORE the availability check, so attacker cannot probe block status with a wrong password)', async () => {
    const realHash = await bcrypt.hash('correct-password', 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', phone: '9999999999', password: realHash, role: 'customer', isBlocked: true, deletedAt: null,
    } as never);
    // Attacker tries wrong password → still sees opaque "Invalid credentials" — NOT a block-status leak
    await expect(AuthService.login({ phone: '9999999999', password: 'WRONG' })).rejects.toThrow('Invalid credentials');
    await expect(AuthService.login({ phone: '9999999999', password: 'WRONG' })).rejects.not.toBeInstanceOf(UnavailableUserError);
  });

  it('blocked user with CORRECT password → UnavailableUserError("blocked")', async () => {
    const realHash = await bcrypt.hash('correct-password', 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1', phone: '9999999999', password: realHash, role: 'customer', isBlocked: true, deletedAt: null,
    } as never);
    try {
      await AuthService.login({ phone: '9999999999', password: 'correct-password' });
      throw new Error('expected UnavailableUserError');
    } catch (e) {
      expect(e).toBeInstanceOf(UnavailableUserError);
      expect((e as UnavailableUserError).unavailableReason).toBe('blocked');
    }
  });
});

// ── 5. login — User-vs-TeamMember precedence ───────────────────────────────
describe('AuthService.login — User table wins when phone is in BOTH tables', () => {
  it('User row wins; teamMember.findUnique is NEVER even called', async () => {
    const realHash = await bcrypt.hash('user-password', 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', phone: '9999999999', password: realHash, role: 'customer', isBlocked: false, deletedAt: null,
    } as never);
    const res = await AuthService.login({ phone: '9999999999', password: 'user-password' });
    expect(res.user).toBeDefined();
    expect((res as Record<string, unknown>).isTeamMember).toBeUndefined();
    // The hijack-prevention guarantee: when User row exists, TeamMember table is NOT consulted at all.
    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });
});

// ── 6. login — TeamMember path impersonates store owner ────────────────────
describe('AuthService.login — TeamMember path', () => {
  it('valid team-member credentials → access token impersonates store owner (userId=ownerId, teamMemberId carried)', async () => {
    const realHash = await bcrypt.hash('team-password', 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);  // no User match
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
      id: 'tm1', phone: '9999999999', passwordHash: realHash,
      store: {
        ownerId: 'owner-id-aaaa',
        owner: {
          id: 'owner-id-aaaa', name: 'Owner', role: 'retailer',
          password: 'opaque', isBlocked: false, deletedAt: null,
        },
      },
    } as never);

    const res = await AuthService.login({ phone: '9999999999', password: 'team-password' });
    expect((res as Record<string, unknown>).isTeamMember).toBe(true);
    expect(res.user).toMatchObject({ id: 'owner-id-aaaa', role: 'retailer' });
    expect(generateRefreshToken).toHaveBeenCalledWith('owner-id-aaaa', 'retailer', expect.objectContaining({ teamMemberId: 'tm1' }));
  });

  it('team-member login where the STORE OWNER is blocked → UnavailableUserError("blocked") (the team member is gated by owner availability)', async () => {
    const realHash = await bcrypt.hash('team-password', 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
      id: 'tm1', phone: '9999999999', passwordHash: realHash,
      store: { ownerId: 'owner-id', owner: { id: 'owner-id', role: 'retailer', isBlocked: true, deletedAt: null } },
    } as never);
    try {
      await AuthService.login({ phone: '9999999999', password: 'team-password' });
      throw new Error('expected UnavailableUserError');
    } catch (e) {
      expect(e).toBeInstanceOf(UnavailableUserError);
      expect((e as UnavailableUserError).unavailableReason).toBe('blocked');
    }
  });
});

// ── 7. issueTokenForUser (deprecated; still exported) ──────────────────────
describe('AuthService.issueTokenForUser (deprecated)', () => {
  it('returns null when the user does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    expect(await AuthService.issueTokenForUser('missing-id')).toBeNull();
  });

  it('returns null for a blocked user (no carve-out)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', role: 'customer', isBlocked: true, deletedAt: null,
    } as never);
    expect(await AuthService.issueTokenForUser('u1')).toBeNull();
  });

  it('returns null for a deleted_pending user WITHOUT the carve-out', async () => {
    const futureDeletedAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', role: 'customer', isBlocked: false, deletedAt: futureDeletedAt,
    } as never);
    expect(await AuthService.issueTokenForUser('u1')).toBeNull();
  });

  it('issues a token for a deleted_pending user WITH acceptDeletedPending:true (the /restore + /refresh carve-out)', async () => {
    const futureDeletedAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', role: 'customer', isBlocked: false, deletedAt: futureDeletedAt,
    } as never);
    const token = await AuthService.issueTokenForUser('u1', { acceptDeletedPending: true });
    expect(typeof token).toBe('string');
    expect(token).not.toBe('');
  });

  it('happy path: issues a token for an available user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      id: 'u1', role: 'customer', isBlocked: false, deletedAt: null,
    } as never);
    const token = await AuthService.issueTokenForUser('u1');
    expect(typeof token).toBe('string');
  });
});
