import { useState, type CSSProperties, type ButtonHTMLAttributes, type ReactNode } from 'react';

/* ── Session 128.13 — Bright Skin Button primitive (color = function) ────────
   Ported from dukanchi-bright-skin/react-stubs/Button.jsx AS-IS — same values,
   same variants. TypeScript types added for safe consumption.

     grad      → hero / primary brand action (Ask Nearby)
     green     → positive / confirm (Follow, Send)
     blue      → communication / navigation (Chat, Directions)
     red       → destructive (Logout, Delete)
     *-soft    → tinted secondary
     out       → legacy outline (orange-on-tint) — kept for back-compat
   ─────────────────────────────────────────────────────────────────────────── */

type BrightButtonVariant = 'grad' | 'green' | 'blue' | 'red' | 'green-soft' | 'blue-soft' | 'out';

interface BrightButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BrightButtonVariant;
  children?: ReactNode;
}

const BASE: CSSProperties = {
  border: 'none',
  fontWeight: 800,
  fontFamily: 'inherit',
  cursor: 'pointer',
  borderRadius: 14,
  padding: '14px 22px',
  fontSize: 14,
  color: '#fff',
  transition: 'transform 0.16s var(--b-ease)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
};

const VARIANTS: Record<BrightButtonVariant, CSSProperties> = {
  grad:         { background: 'var(--b-grad)', color: 'var(--b-on-grad)' },
  green:        { background: 'var(--b-green)' },
  blue:         { background: 'var(--b-blue)' },
  red:          { background: 'var(--b-red)' },
  'green-soft': { background: 'var(--b-green-bg)', color: 'var(--b-green)', border: '1.5px solid var(--b-green)' },
  'blue-soft':  { background: 'var(--b-blue-bg)',  color: 'var(--b-blue)',  border: '1.5px solid var(--b-blue)' },
  out:          { background: 'var(--b-tint)',     color: 'var(--b-orange)', border: '1.5px solid var(--b-orange)' },
};

export default function Button({ variant = 'grad', children, style, onPointerDown, onPointerUp, onPointerLeave, ...rest }: BrightButtonProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      {...rest}
      onPointerDown={(e) => { setPressed(true); onPointerDown?.(e); }}
      onPointerUp={(e) => { setPressed(false); onPointerUp?.(e); }}
      onPointerLeave={(e) => { setPressed(false); onPointerLeave?.(e); }}
      style={{
        ...BASE,
        ...VARIANTS[variant],
        transform: pressed ? 'scale(0.95)' : 'none',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
