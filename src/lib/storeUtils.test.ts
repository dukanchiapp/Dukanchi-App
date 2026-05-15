import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStoreStatus, statusColor } from './storeUtils';

/**
 * storeUtils — Day 7 / Session 94 / Phase 4 / quick-win unit tests.
 *
 * Pure time-math + label/color resolution. Time-dependent branches use
 * vi.setSystemTime() so tests are deterministic.
 */

describe('lib/storeUtils', () => {
  describe('statusColor', () => {
    it('maps green/yellow/red to brand hex values', () => {
      expect(statusColor('green')).toBe('#10B981');
      expect(statusColor('yellow')).toBe('#F59E0B');
      expect(statusColor('red')).toBe('#EF4444');
    });
  });

  describe('getStoreStatus', () => {
    beforeEach(() => {
      // Pin time to a Wednesday 10:00 AM IST-flavoured.
      // (UTC works fine — getHours() uses local time but in CI/dev it's
      //  consistent enough for these branch checks.)
      vi.useFakeTimers();
      // Wednesday 2026-05-13 10:00 — pick a weekday so workingDays default
      // path doesn't reject.
      vi.setSystemTime(new Date('2026-05-13T10:00:00'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "Closed Today" with red when workingDays excludes today', () => {
      // 2026-05-13 = Wednesday → today === 'Wed'
      // workingDays is supplied as a comma/string blob; we just need !includes('Wed')
      const status = getStoreStatus('09:00', '21:00', false, 'Mon,Tue,Thu,Fri');
      expect(status).toEqual({ isOpen: false, label: 'Closed Today', color: 'red' });
    });

    it('returns "Open 24 Hours" when is24Hours flag set', () => {
      const status = getStoreStatus(undefined, undefined, true);
      expect(status).toEqual({ isOpen: true, label: 'Open 24 Hours', color: 'green' });
    });

    it('returns null when openingTime + closingTime both missing (no 24h flag)', () => {
      expect(getStoreStatus()).toBeNull();
      expect(getStoreStatus('09:00')).toBeNull();
    });

    it('returns "Open · Closes at 9:00 PM" when within hours and >1hr left', () => {
      // 10:00 AM, store open 9:00-21:00 → 11 hrs left → green
      const status = getStoreStatus('09:00', '21:00', false);
      expect(status?.isOpen).toBe(true);
      expect(status?.color).toBe('green');
      expect(status?.label).toMatch(/Closes at 9:00 PM/);
    });

    it('returns yellow "Closing in N min" when ≤60 mins remain', () => {
      // Move clock to 8:30 PM — 30 min before 9 PM close.
      vi.setSystemTime(new Date('2026-05-13T20:30:00'));
      const status = getStoreStatus('09:00', '21:00', false);
      expect(status?.isOpen).toBe(true);
      expect(status?.color).toBe('yellow');
      expect(status?.minutesUntilClose).toBe(30);
      expect(status?.label).toMatch(/Closing in 30 mins/);
    });

    it('returns red "Closed · Opens at 9:00 AM" outside hours', () => {
      // 6 AM — store closed.
      vi.setSystemTime(new Date('2026-05-13T06:00:00'));
      const status = getStoreStatus('09:00', '21:00', false);
      expect(status?.isOpen).toBe(false);
      expect(status?.color).toBe('red');
      expect(status?.label).toMatch(/Opens at 9:00 AM/);
    });

    it('handles overnight hours correctly (close < open, e.g., 22:00-04:00)', () => {
      // 2 AM — store open until 4 AM after opening at 10 PM previous day.
      vi.setSystemTime(new Date('2026-05-13T02:00:00'));
      const status = getStoreStatus('22:00', '04:00', false);
      expect(status?.isOpen).toBe(true);
    });
  });
});
