import { describe, it, expect } from 'vitest';
import { getLiveStatus, LIVE_STATUS_COLORS } from './liveStatus';

/**
 * getLiveStatus unit tests — Session 115 (Futuristic v3 foundation).
 *
 * Locks the tier boundaries (15 / 30 / 60 minutes) and the "Closed*"
 * authoritative-red rule. These thresholds are visual contract; a
 * future refactor that bumps "≤15 → red" to "≤10 → red" would shift
 * what a user sees on the post-card. Tests fail loudly on drift.
 */

describe('getLiveStatus', () => {
  describe('"Closed*" label override', () => {
    it('returns red for "Closed Today" regardless of countdown', () => {
      const r = getLiveStatus({ status: 'Closed Today', closingSoon: 999 });
      expect(r.color).toBe(LIVE_STATUS_COLORS.red);
      expect(r.label).toBe('Closed Today');
    });

    it('returns red for lowercase "closed for holidays"', () => {
      const r = getLiveStatus({ status: 'closed for holidays' });
      expect(r.color).toBe(LIVE_STATUS_COLORS.red);
      expect(r.label).toBe('closed for holidays');
    });

    it('does NOT match "Closing soon" (only startsWith "Closed")', () => {
      // "Closing" !startsWith "closed" → falls through to tier logic.
      const r = getLiveStatus({ status: 'Closing soon', closingSoon: 5 });
      expect(r.color).toBe(LIVE_STATUS_COLORS.red); // red because closingSoon ≤ 15
      expect(r.label).toBe('Closes in 5m');         // tier label, NOT pass-through
    });
  });

  describe('no closingSoon signal', () => {
    it('returns status + statusColor when both provided', () => {
      const r = getLiveStatus({ status: 'Open till 10pm', statusColor: '#abc123' });
      expect(r.label).toBe('Open till 10pm');
      expect(r.color).toBe('#abc123');
    });

    it('defaults to "Open" + open-green when nothing provided', () => {
      const r = getLiveStatus({});
      expect(r.label).toBe('Open');
      expect(r.color).toBe(LIVE_STATUS_COLORS.open);
    });

    it('treats null closingSoon as "unknown" (same as undefined)', () => {
      const r = getLiveStatus({ closingSoon: null, status: 'Open 24 Hours' });
      expect(r.label).toBe('Open 24 Hours');
      expect(r.color).toBe(LIVE_STATUS_COLORS.open);
    });
  });

  describe('closed (closingSoon ≤ 0)', () => {
    it('returns "Closed" + red on 0', () => {
      const r = getLiveStatus({ closingSoon: 0 });
      expect(r).toEqual({ label: 'Closed', color: LIVE_STATUS_COLORS.red });
    });

    it('returns "Closed" + red on negative', () => {
      const r = getLiveStatus({ closingSoon: -5 });
      expect(r).toEqual({ label: 'Closed', color: LIVE_STATUS_COLORS.red });
    });
  });

  describe('tier boundaries', () => {
    it('≤15 → red', () => {
      expect(getLiveStatus({ closingSoon: 1 })).toEqual({ label: 'Closes in 1m', color: LIVE_STATUS_COLORS.red });
      expect(getLiveStatus({ closingSoon: 15 })).toEqual({ label: 'Closes in 15m', color: LIVE_STATUS_COLORS.red });
    });

    it('16–30 → orange', () => {
      expect(getLiveStatus({ closingSoon: 16 })).toEqual({ label: 'Closes in 16m', color: LIVE_STATUS_COLORS.orange });
      expect(getLiveStatus({ closingSoon: 30 })).toEqual({ label: 'Closes in 30m', color: LIVE_STATUS_COLORS.orange });
    });

    it('31–60 → yellow', () => {
      expect(getLiveStatus({ closingSoon: 31 })).toEqual({ label: 'Closes in 31m', color: LIVE_STATUS_COLORS.yellow });
      expect(getLiveStatus({ closingSoon: 60 })).toEqual({ label: 'Closes in 60m', color: LIVE_STATUS_COLORS.yellow });
    });

    it('>60 → open-green (uses post.status if provided)', () => {
      const r = getLiveStatus({ closingSoon: 61, status: 'Open till 10pm' });
      expect(r.color).toBe(LIVE_STATUS_COLORS.open);
      expect(r.label).toBe('Open till 10pm');
    });

    it('>60 with no status falls back to literal "Open"', () => {
      const r = getLiveStatus({ closingSoon: 120 });
      expect(r.color).toBe(LIVE_STATUS_COLORS.open);
      expect(r.label).toBe('Open');
    });

    it('>60 with custom statusColor honors it', () => {
      const r = getLiveStatus({ closingSoon: 120, status: 'Open', statusColor: '#FF6B35' });
      expect(r.color).toBe('#FF6B35');
    });
  });

  describe('LIVE_STATUS_COLORS contract', () => {
    it('exposes the exact 4 hex values that match futuristic.css --f-status-* tokens', () => {
      // Drift-guard — if these change, the CSS tokens must change too.
      expect(LIVE_STATUS_COLORS.open).toBe('#1FA365');
      expect(LIVE_STATUS_COLORS.yellow).toBe('#F59E0B');
      expect(LIVE_STATUS_COLORS.orange).toBe('#FF8A4D');
      expect(LIVE_STATUS_COLORS.red).toBe('#FF4D6A');
    });
  });
});
