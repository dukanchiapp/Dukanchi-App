import { describe, it, expect } from 'vitest';
import {
  REFRESH_TOKEN_TTL_SECONDS,
  ACCESS_TOKEN_TTL_SECONDS,
  rtActiveKey,
  rtBlacklistKey,
  rtFamilyKey,
  accessBlacklistKey,
} from './redis-keys';

/**
 * Redis key helpers — Day 7 / Session 94 / Phase 4 / quick-win unit tests.
 *
 * Pure-function helpers. Pin the on-the-wire key strings + TTL constants —
 * if any change unintentionally, every existing Redis entry written under
 * the old prefix becomes orphaned. These tests catch that class of regression.
 */
describe('lib/redis-keys', () => {
  describe('TTL constants', () => {
    it('REFRESH_TOKEN_TTL_SECONDS = 30 days', () => {
      expect(REFRESH_TOKEN_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
      expect(REFRESH_TOKEN_TTL_SECONDS).toBe(2_592_000);
    });

    it('ACCESS_TOKEN_TTL_SECONDS = 15 minutes', () => {
      expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
      expect(ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    });

    it('access TTL is much shorter than refresh TTL (security invariant)', () => {
      // Industry-standard ratio is ~100x. We're at 2592000/900 = 2880x; that's fine.
      expect(REFRESH_TOKEN_TTL_SECONDS / ACCESS_TOKEN_TTL_SECONDS).toBeGreaterThan(100);
    });
  });

  describe('key formatters', () => {
    const USER = '00000000-0000-0000-0000-000000000001';
    const JTI = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const FAM = '11111111-2222-3333-4444-555555555555';

    it('rtActiveKey embeds userId AND jti so cross-user jti collisions can never share a key', () => {
      expect(rtActiveKey(USER, JTI)).toBe(`rt:active:${USER}:${JTI}`);
    });

    it('rtBlacklistKey is keyed by jti only — any user presenting that jti must be rejected', () => {
      expect(rtBlacklistKey(JTI)).toBe(`rt:blacklist:${JTI}`);
    });

    it('rtFamilyKey is keyed by family id so SMEMBERS gives the full rotation chain', () => {
      expect(rtFamilyKey(FAM)).toBe(`rt:family:${FAM}`);
    });

    it('accessBlacklistKey uses access: prefix (NOT rt:) so the two surfaces never collide', () => {
      expect(accessBlacklistKey(JTI)).toBe(`access:blacklist:${JTI}`);
      // Defense-in-depth: confirm the rt: and access: prefixes are disjoint.
      expect(accessBlacklistKey(JTI)).not.toContain('rt:');
    });
  });
});
