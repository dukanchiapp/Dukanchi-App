import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Session 128.43 / Phase 4.2 — TeamService spec coverage.
 *
 * IDOR-CRITICAL service. The owner-only boundary is the security marquee:
 *   - getTeamMembers: owner of THIS store only — other-store access DENIED
 *   - addTeamMember:  owner only — team-member impersonation tokens DENIED
 *   - removeTeamMember: owner only — team-member tokens BLANKET-deny BEFORE
 *     the existence check (no info leak about whether the id exists)
 *
 * Also encodes business rules:
 *   - Max 3 team members per store
 *   - Password min 4 chars (NOT 8 — that's customer signup)
 *   - Duplicate phone rejected pre-create
 *
 * Philosophy: tests encode the INTENDED SPEC. If a spec test fails it
 * means a real bug exists → STOP, report it as POTENTIAL IDOR BUG FOUND,
 * do NOT weaken.
 */

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-32-chars-long-padding',
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
    store: { findUnique: vi.fn() },
    teamMember: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';
import { TeamService } from '../modules/team/team.service';

const OWNER_ID = 'owner-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_USER_ID = 'other-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const STORE_ID = 'store-cccc-cccc-cccc-cccccccccccc';
const MEMBER_ID = 'mem-dddd-dddd-dddd-dddddddddddd';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. getTeamMembers — IDOR matrix ─────────────────────────────────────────
describe('TeamService.getTeamMembers — IDOR-critical owner-only gate', () => {
  it('OWNER of the store → succeeds (returns the member list)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    vi.mocked(prisma.teamMember.findMany).mockResolvedValueOnce([
      { id: 'm1', phone: '9999999991', name: 'Alice', role: 'member', createdAt: new Date() },
    ] as never);
    const members = await TeamService.getTeamMembers(STORE_ID, OWNER_ID);
    expect(members).toHaveLength(1);
    expect(members[0].phone).toBe('9999999991');
  });

  it('IDOR: another user (NOT the owner) → throws "Only the owner can manage the team"; teamMember.findMany is NEVER called', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    await expect(TeamService.getTeamMembers(STORE_ID, OTHER_USER_ID)).rejects.toThrow('Only the owner can manage the team');
    // The list query must NOT run if authorization failed.
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
  });

  it('IDOR: store does not exist → throws "Only the owner can manage the team" (same message — no existence oracle)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce(null as never);
    await expect(TeamService.getTeamMembers(STORE_ID, OWNER_ID)).rejects.toThrow('Only the owner can manage the team');
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
  });

  it('IDOR: team-member impersonation token (teamMemberId set) → DENIED even when the underlying user IS the owner (team members cannot view the team list)', async () => {
    // The user JWT is the OWNER's userId — but the token carries a teamMemberId,
    // meaning a team-member logged in with this token (login.ts impersonates the owner).
    // The service still rejects.
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    await expect(TeamService.getTeamMembers(STORE_ID, OWNER_ID, 'team-member-id')).rejects.toThrow('Only the owner can manage the team');
    expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
  });
});

// ── 2. addTeamMember — IDOR + business rules ────────────────────────────────
describe('TeamService.addTeamMember — IDOR-critical owner-only gate', () => {
  const VALID_BODY = { phone: '9999999992', password: 'pw1234', storeId: STORE_ID, name: 'Bob' };

  it('OWNER adds a team member → hashed password + create called with the right fields', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    vi.mocked(prisma.teamMember.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.teamMember.create).mockResolvedValueOnce({
      id: 'new-mem', phone: '9999999992', name: 'Bob', role: 'member', createdAt: new Date(),
    } as never);

    const result = await TeamService.addTeamMember(VALID_BODY, OWNER_ID);

    expect(result.phone).toBe('9999999992');
    expect(prisma.teamMember.create).toHaveBeenCalledOnce();
    const args = vi.mocked(prisma.teamMember.create).mock.calls[0][0] as any;
    expect(args.data.phone).toBe('9999999992');
    expect(args.data.storeId).toBe(STORE_ID);
    expect(args.data.role).toBe('member');  // role is always 'member' — service-set, not client-supplied
    expect(typeof args.data.passwordHash).toBe('string');
    // bcrypt cost factor matches env.BCRYPT_ROUNDS (test env = 4 — the hash prefix encodes it).
    expect(args.data.passwordHash.startsWith('$2b$04$') || args.data.passwordHash.startsWith('$2a$04$')).toBe(true);
  });

  it('default name "Team Member" when name is omitted (service-supplied, not client-controlled)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    vi.mocked(prisma.teamMember.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.teamMember.create).mockResolvedValueOnce({} as never);
    await TeamService.addTeamMember({ phone: '9999999993', password: 'pw1234', storeId: STORE_ID }, OWNER_ID);
    expect((vi.mocked(prisma.teamMember.create).mock.calls[0][0] as any).data.name).toBe('Team Member');
  });

  it('IDOR: non-owner adding to a store they don\'t own → throws "Only the owner can add team members"; NO write attempted', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    await expect(TeamService.addTeamMember(VALID_BODY, OTHER_USER_ID)).rejects.toThrow('Only the owner can add team members');
    expect(prisma.teamMember.create).not.toHaveBeenCalled();
  });

  it('IDOR: team-member impersonation token → DENIED (only the actual owner adds, not a member with a logged-in session)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    await expect(TeamService.addTeamMember(VALID_BODY, OWNER_ID, 'tm-id')).rejects.toThrow('Only the owner can add team members');
    expect(prisma.teamMember.create).not.toHaveBeenCalled();
  });

  it('IDOR: store does not exist → "Only the owner can add team members" (same message — no existence oracle)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce(null as never);
    await expect(TeamService.addTeamMember(VALID_BODY, OWNER_ID)).rejects.toThrow('Only the owner can add team members');
  });

  it('rejects missing phone with "Phone and password are required"', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    await expect(TeamService.addTeamMember({ password: 'pw1234', storeId: STORE_ID }, OWNER_ID))
      .rejects.toThrow('Phone and password are required');
    expect(prisma.teamMember.create).not.toHaveBeenCalled();
  });

  it('rejects missing password with "Phone and password are required"', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    await expect(TeamService.addTeamMember({ phone: '9999999992', storeId: STORE_ID }, OWNER_ID))
      .rejects.toThrow('Phone and password are required');
  });

  it('rejects a password under 4 chars (the team-member-account floor, distinct from customer signup which is 8)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    await expect(TeamService.addTeamMember({ phone: '9999999992', password: 'abc', storeId: STORE_ID }, OWNER_ID))
      .rejects.toThrow('Password must be at least 4 characters');
  });

  it('accepts a password exactly at the 4-char floor (boundary)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    vi.mocked(prisma.teamMember.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.teamMember.create).mockResolvedValueOnce({} as never);
    await expect(TeamService.addTeamMember({ phone: '9999999992', password: 'abcd', storeId: STORE_ID }, OWNER_ID))
      .resolves.toBeDefined();
  });

  it('rejects when the per-store cap of 3 team members would be exceeded', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    vi.mocked(prisma.teamMember.count).mockResolvedValueOnce(3 as never);  // already at cap
    await expect(TeamService.addTeamMember(VALID_BODY, OWNER_ID))
      .rejects.toThrow('Maximum 3 team members allowed per store');
    expect(prisma.teamMember.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate phone (team-member already exists with this number)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    vi.mocked(prisma.teamMember.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({ id: 'existing', phone: '9999999992' } as never);
    await expect(TeamService.addTeamMember(VALID_BODY, OWNER_ID))
      .rejects.toThrow('A team member with this phone number already exists');
    expect(prisma.teamMember.create).not.toHaveBeenCalled();
  });

  it('the stored passwordHash actually verifies via bcrypt.compare (round-trip)', async () => {
    vi.mocked(prisma.store.findUnique).mockResolvedValueOnce({ id: STORE_ID, ownerId: OWNER_ID } as never);
    vi.mocked(prisma.teamMember.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as never);
    vi.mocked(prisma.teamMember.create).mockResolvedValueOnce({} as never);
    await TeamService.addTeamMember({ phone: '9999999992', password: 'pw1234', storeId: STORE_ID }, OWNER_ID);
    const writtenHash = (vi.mocked(prisma.teamMember.create).mock.calls[0][0] as any).data.passwordHash;
    expect(await bcrypt.compare('pw1234', writtenHash)).toBe(true);
    expect(await bcrypt.compare('wrong', writtenHash)).toBe(false);
  });
});

// ── 3. removeTeamMember — IDOR + blanket team-member deny ──────────────────
describe('TeamService.removeTeamMember — IDOR-critical owner-only gate', () => {
  it('OWNER removing a member of their own store → succeeds', async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
      id: MEMBER_ID, storeId: STORE_ID, store: { id: STORE_ID, ownerId: OWNER_ID },
    } as never);
    vi.mocked(prisma.teamMember.delete).mockResolvedValueOnce({ id: MEMBER_ID } as never);
    const result = await TeamService.removeTeamMember(MEMBER_ID, OWNER_ID);
    expect(result).toEqual({ success: true });
    expect(prisma.teamMember.delete).toHaveBeenCalledWith({ where: { id: MEMBER_ID } });
  });

  it('IDOR: another user removing a member from a store they don\'t own → "Only the owner can remove team members"', async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce({
      id: MEMBER_ID, storeId: STORE_ID, store: { id: STORE_ID, ownerId: OWNER_ID },
    } as never);
    await expect(TeamService.removeTeamMember(MEMBER_ID, OTHER_USER_ID))
      .rejects.toThrow('Only the owner can remove team members');
    expect(prisma.teamMember.delete).not.toHaveBeenCalled();
  });

  it('IDOR: TEAM MEMBER token (teamMemberId set) → BLANKET DENY ("Team members cannot remove other members") BEFORE the existence check, so a team member cannot probe whether a target id exists', async () => {
    // CRITICAL: the teamMemberId gate at source line 54 fires BEFORE the
    // findUnique at line 56. This means a team-member token gets the SAME
    // error regardless of whether the target id exists — no info leak.
    await expect(TeamService.removeTeamMember(MEMBER_ID, OWNER_ID, 'team-member-id'))
      .rejects.toThrow('Team members cannot remove other members');
    // Existence check (findUnique) must NOT have run.
    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.teamMember.delete).not.toHaveBeenCalled();
  });

  it('IDOR: team member cannot remove themselves either (same blanket deny — service-layer rule is teamMemberId-set = always deny)', async () => {
    // Even if the targeted id IS this team member's own id — still denied at the service layer.
    await expect(TeamService.removeTeamMember('team-member-id', OWNER_ID, 'team-member-id'))
      .rejects.toThrow('Team members cannot remove other members');
    expect(prisma.teamMember.findUnique).not.toHaveBeenCalled();
  });

  it('non-existent target id → "Team member not found"', async () => {
    vi.mocked(prisma.teamMember.findUnique).mockResolvedValueOnce(null as never);
    await expect(TeamService.removeTeamMember(MEMBER_ID, OWNER_ID))
      .rejects.toThrow('Team member not found');
  });
});
