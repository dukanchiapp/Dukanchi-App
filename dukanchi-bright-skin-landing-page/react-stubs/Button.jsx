// Button.jsx — function-colored buttons (color = meaning)
//  grad  → hero / primary brand action (Ask Nearby)
//  green → positive / confirm (Follow, Send)
//  blue  → communication / navigation (Chat, Directions)
//  red   → destructive (Logout, Delete)
//  *-soft variants = tinted secondary
import React from 'react';

const BASE = {
  border: 'none', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
  borderRadius: 14, padding: '14px 22px', fontSize: 14, color: '#fff',
  transition: 'transform 0.16s var(--b-ease)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
};

const VARIANTS = {
  grad:       { background: 'var(--b-grad)', color: 'var(--b-on-grad)' },
  green:      { background: 'var(--b-green)' },
  blue:       { background: 'var(--b-blue)' },
  red:        { background: 'var(--b-red)' },
  'green-soft': { background: 'var(--b-green-bg)', color: 'var(--b-green)', border: '1.5px solid var(--b-green)' },
  'blue-soft':  { background: 'var(--b-blue-bg)',  color: 'var(--b-blue)',  border: '1.5px solid var(--b-blue)' },
  out:        { background: 'var(--b-tint)', color: 'var(--b-orange)', border: '1.5px solid var(--b-orange)' },
};

export default function Button({ variant = 'grad', children, style, ...rest }) {
  const [pressed, setPressed] = React.useState(false);
  return (
    <button
      {...rest}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...BASE, ...VARIANTS[variant],
        transform: pressed ? 'scale(0.95)' : 'none',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
