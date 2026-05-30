import type { ReactNode } from 'react';

/* ── Session 128.13 — Bright Skin Header primitive ──────────────────────────
   Ported from dukanchi-bright-skin/react-stubs/Header.jsx AS-IS.

   - bg: var(--b-grad) (yellow gradient)
   - padding: 52px 16px 0 (status-bar overlaps the top)
   - foreground: var(--b-on-grad) (DARK on the yellow gradient)
   - .b-head class adds the animated gradient-mesh sheen from bright-skin.css

   Logo tile: 40×40, radius 12, glassy chip bg, glyph "द" 20px.
   Right-side bell: optional onBell callback + unread dot.
   ─────────────────────────────────────────────────────────────────────────── */

interface BrightHeaderProps {
  title?: string;
  tagline?: string;
  onBell?: () => void;
  unread?: boolean;
  /** Optional content rendered to the right of the wordmark (sits above the bell). */
  trailing?: ReactNode;
}

export default function Header({
  title = 'Dukanchi',
  tagline = 'apna bazaar, apni dukaan',
  onBell,
  unread = false,
  trailing,
}: BrightHeaderProps) {
  return (
    <div
      className="b-head"
      style={{
        background: 'var(--b-grad)',
        // Use safe-area for native + PWA notch; fall back to 52px per the spec
        // (matches bright.html — status bar floats transparently over the gradient).
        padding: 'calc(env(safe-area-inset-top, 0px) + 52px) 16px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--b-chip-bg)',
              border: '1px solid var(--b-chip-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--b-on-grad)',
              fontWeight: 600,
              fontSize: 20,
              fontFamily: 'var(--b-display)',
            }}
            aria-hidden="true"
          >
            द
          </div>
          <div>
            <div
              style={{
                fontSize: 19,
                fontWeight: 800,
                fontFamily: 'var(--b-display)',
                color: 'var(--b-on-grad)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--b-on-grad-soft)', lineHeight: 1.1 }}>{tagline}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {trailing}
          <button
            onClick={onBell}
            className="b-tap"
            aria-label="Notifications"
            style={{
              position: 'relative',
              width: 42,
              height: 42,
              borderRadius: 14,
              background: 'var(--b-chip-bg)',
              border: '1px solid var(--b-chip-line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--b-on-grad)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unread && (
              <span
                style={{
                  position: 'absolute',
                  top: 9,
                  right: 10,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--b-red)',
                  border: '1.5px solid #fff',
                }}
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
