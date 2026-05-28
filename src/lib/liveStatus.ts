/**
 * getLiveStatus — Session 115 (Futuristic v3 foundation).
 *
 * Runtime resolver for a store's visual status capsule across Home post
 * cards, Messages list rows, Chat header, Map bottom sheet, and Store
 * profile. Maps a server-computed `closingSoon` (minutes-until-close) plus
 * an optional `status` string into the design-token color palette
 * (--f-status-open / --f-status-yellow / --f-status-orange / --f-status-red).
 *
 * Color tiers (from README):
 *   - status startsWith "Closed"          → red (#FF4D6A)
 *   - closingSoon ≤ 0                     → red — "Closed"
 *   - closingSoon ≤ 15                    → red — "Closes in {n}m"
 *   - closingSoon ≤ 30                    → orange (#FF8A4D)
 *   - closingSoon ≤ 60                    → yellow (#F59E0B)
 *   - otherwise                           → green (#1FA365) using post.status / post.statusColor
 *
 * Plumbing:
 *   - Compute `closingSoon` server-side from existing `Store.closingTime`
 *     (Prisma) + Date.now(); ship as `closingSoon` field on the feed payload.
 *   - Alternatively compute client-side from `store.closingTime` on every
 *     feed refresh (the prototype does this; see README §State Management).
 *   - The post-card uses `setInterval(() => closingSoon--, 60_000)` to drive
 *     the live countdown — tier transitions happen in real time.
 *
 * Existing related util:
 *   - `getStoreStatus(openingTime, closingTime, is24Hours, workingDays)` in
 *     `src/lib/storeUtils.ts` returns the semantic 'green'/'yellow'/'red'
 *     bucket and the underlying `minutesUntilClose`. To bridge: feed
 *     `getStoreStatus(...).minutesUntilClose` into this helper's
 *     `closingSoon` field. See `liveStatusFromStore()` below.
 */

/** Color hex values — must match the --f-status-* CSS tokens in futuristic.css. */
export const LIVE_STATUS_COLORS = {
  open:   '#1FA365',
  yellow: '#F59E0B',
  orange: '#FF8A4D',
  red:    '#FF4D6A',
} as const;

export interface LiveStatusInput {
  /** Minutes until close. Positive = open. ≤0 = closed. null/undefined = unknown. */
  closingSoon?: number | null;
  /** Display label fallback when not closing soon. e.g. "Open till 10pm". */
  status?: string | null;
  /** Color fallback when not closing soon. Defaults to the open-green token. */
  statusColor?: string | null;
}

export interface LiveStatusResult {
  label: string;
  color: string;
}

/**
 * Resolve the live status for a feed-like object that already carries
 * `closingSoon`, `status`, and optionally `statusColor`. Pure / no I/O.
 */
export function getLiveStatus(post: LiveStatusInput): LiveStatusResult {
  // Any "Closed*" label is authoritative — red regardless of countdown.
  if (typeof post.status === 'string' && post.status.toLowerCase().startsWith('closed')) {
    return { label: post.status, color: LIVE_STATUS_COLORS.red };
  }

  const min = post.closingSoon;

  // No countdown signal — fall back to whatever the feed payload provided.
  if (typeof min !== 'number') {
    return {
      label: post.status ?? 'Open',
      color: post.statusColor ?? LIVE_STATUS_COLORS.open,
    };
  }

  // Negative or zero — store is closed.
  if (min <= 0) {
    return { label: 'Closed', color: LIVE_STATUS_COLORS.red };
  }

  // Tiers (≤15 red, ≤30 orange, ≤60 yellow, else open).
  if (min <= 15) return { label: `Closes in ${min}m`, color: LIVE_STATUS_COLORS.red };
  if (min <= 30) return { label: `Closes in ${min}m`, color: LIVE_STATUS_COLORS.orange };
  if (min <= 60) return { label: `Closes in ${min}m`, color: LIVE_STATUS_COLORS.yellow };

  // > 60 min until close — open.
  return {
    label: post.status ?? 'Open',
    color: post.statusColor ?? LIVE_STATUS_COLORS.open,
  };
}
