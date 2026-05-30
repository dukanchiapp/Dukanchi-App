import type { CSSProperties } from 'react';

/* ── Session 128.13 — Bright Skin StatusPill primitive ──────────────────────
   Ported from dukanchi-bright-skin/react-stubs/StatusPill.jsx AS-IS.

   status tier mapping (matches the existing 4-tier liveStatus logic):
     open    → green   (Open / Open till HH:MM PM)
     soon    → amber   (Closes in 31–60 min)
     orange  → orange  (Closes in 16–30 min)
     closed  → red     (Closes in ≤15 min OR any "Closed*")
     info    → blue    (informational use)

   The dot breathes for `open` / `soon`. `info` also breathes per
   bright-skin.css. The breathe keyframe is in bright-skin.css.
   ─────────────────────────────────────────────────────────────────────────── */

export type BrightStatus = 'open' | 'soon' | 'orange' | 'closed' | 'info';

interface BrightStatusPillProps {
  status?: BrightStatus;
  label: string;
}

const MAP: Record<BrightStatus, { color: string; bg: string }> = {
  open:   { color: 'var(--b-green)', bg: 'var(--b-green-bg)' },
  soon:   { color: 'var(--b-amber)', bg: '#FEF6E0' },
  orange: { color: '#FB7A1E',        bg: '#FFF0E2' },
  closed: { color: 'var(--b-red)',   bg: 'var(--b-red-bg)' },
  info:   { color: 'var(--b-blue)',  bg: 'var(--b-blue-bg)' },
};

const wrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  fontWeight: 700,
  padding: '2px 8px',
  borderRadius: 9999,
  letterSpacing: '-0.01em',
};

export default function StatusPill({ status = 'open', label }: BrightStatusPillProps) {
  const s = MAP[status] || MAP.open;
  const breathe = status === 'open' || status === 'soon';
  return (
    <span style={{ ...wrap, color: s.color, background: s.bg }}>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'currentColor',
          animation: breathe ? 'b-breathe 2.2s ease-in-out infinite' : 'none',
        }}
      />
      {label}
    </span>
  );
}
