import { useState, useEffect } from 'react';

/** Floor a countdown can't drop below — a just-closed store reads "Closed". */
export const CLOSING_SOON_FLOOR = -5;

/**
 * Pure one-minute step for the closing-soon countdown. Exported so the
 * decrement/floor/null contract is unit-testable without a DOM renderer
 * (vitest here runs node-only — no RTL/jsdom). The hook below is a thin
 * timer wrapper around this.
 *   - null/undefined → stays null (no countdown)
 *   - number → max(FLOOR, m - 1)
 */
export function nextClosingSoon(m: number | null): number | null {
  if (m == null) return m;
  return Math.max(CLOSING_SOON_FLOOR, m - 1);
}

/**
 * useClosingSoon — Session 116 (Futuristic re-skin).
 *
 * Drives the live "Closes in {n}m" countdown on the post-card / store status
 * capsule. Given an initial minutes-until-close value, it ticks once per
 * minute and decrements, so the getLiveStatus() color tier (red ≤15 /
 * orange ≤30 / yellow ≤60) transitions in real time without a feed refetch.
 *
 * Contract:
 *   - `initialMinutes === null/undefined` → no countdown; returns null and
 *     starts no timer (open-not-closing-soon or no hours data).
 *   - Otherwise → returns the live-decrementing value, floored at -5 (so a
 *     store that just closed reads "Closed" via getLiveStatus, and we stop
 *     decrementing into absurd negatives).
 *   - ONE interval per hook instance; cleared on unmount AND whenever
 *     `initialMinutes` changes (a feed refresh handing down a fresh value
 *     resets the timer rather than stacking a second one).
 *
 * Usage:
 *   const status = getStoreStatus(openingTime, closingTime, is24Hours, workingDays);
 *   const closingSoon = useClosingSoon(status?.minutesUntilClose ?? null);
 *   const live = getLiveStatus({ closingSoon, status: status?.label ?? null });
 */
export function useClosingSoon(initialMinutes: number | null): number | null {
  const [minutes, setMinutes] = useState<number | null>(initialMinutes);

  useEffect(() => {
    // Reset to the latest server-provided value on every change.
    setMinutes(initialMinutes);

    // No countdown when there's no numeric starting point.
    if (typeof initialMinutes !== 'number') return;

    const id = setInterval(() => {
      setMinutes(nextClosingSoon);
    }, 60_000);

    return () => clearInterval(id);
  }, [initialMinutes]);

  return minutes;
}
