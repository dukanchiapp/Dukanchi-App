import { describe, it, expect } from 'vitest';
import { nextClosingSoon, CLOSING_SOON_FLOOR } from './useClosingSoon';

/**
 * useClosingSoon logic tests — Session 116 (Futuristic re-skin).
 *
 * vitest here runs node-only (no RTL/jsdom), so we test the pure one-minute
 * step `nextClosingSoon` that the hook wraps. This locks the decrement +
 * floor + null-passthrough contract that drives the live status capsule's
 * color tiers (getLiveStatus: red ≤15 / orange ≤30 / yellow ≤60). The
 * timer/reset/cleanup wiring is standard React idiom verified via typecheck
 * + manual dev render.
 */

describe('nextClosingSoon', () => {
  it('passes null through (no countdown)', () => {
    expect(nextClosingSoon(null)).toBeNull();
  });

  it('decrements a positive value by 1', () => {
    expect(nextClosingSoon(42)).toBe(41);
    expect(nextClosingSoon(1)).toBe(0);
  });

  it('crosses zero into negatives (drives getLiveStatus "Closed")', () => {
    expect(nextClosingSoon(0)).toBe(-1);
  });

  it('floors at CLOSING_SOON_FLOOR (-5) — no runaway negatives', () => {
    expect(nextClosingSoon(-5)).toBe(-5);
    expect(nextClosingSoon(-4)).toBe(-5);
    expect(CLOSING_SOON_FLOOR).toBe(-5);
  });

  it('repeated application converges to the floor', () => {
    let m: number | null = 3;
    for (let i = 0; i < 20; i++) m = nextClosingSoon(m);
    expect(m).toBe(-5);
  });

  it('tier-boundary walk (60 → ... → 0) matches getLiveStatus expectations', () => {
    // 60 yellow, 30 orange, 15 red, 0 closed — these are the values the
    // capsule color flips on as the countdown ticks down.
    expect(nextClosingSoon(61)).toBe(60); // enters yellow tier
    expect(nextClosingSoon(31)).toBe(30); // enters orange tier
    expect(nextClosingSoon(16)).toBe(15); // enters red tier
  });
});
