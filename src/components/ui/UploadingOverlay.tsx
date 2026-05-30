import type { CSSProperties } from 'react';

/* ── Session 128.7 — Shared upload/AI loading overlay ────────────────────────
   Drop this absolutely-positioned overlay INSIDE any image preview, logo tile,
   cover frame, KYC tile, or chat-image thumbnail to give the user immediate
   visual feedback during background uploads. Designed so the parent doesn't
   need its own `position: relative` (we set it via inline styles).

   Props:
     - label    optional bottom text ("Uploading photo…" / "AI soch raha hai…")
     - size     spinner ring diameter in px (default 28)
     - radius   matches the parent's borderRadius so the dim layer doesn't
                bleed past rounded corners (default 'inherit')

   Spinner uses Tailwind's animate-spin keyframe — the same one we already use
   in Login/Signup/Chat send button, so visual language stays consistent. */

interface UploadingOverlayProps {
  label?: string;
  size?: number;
  radius?: number | string;
}

export function UploadingOverlay({ label = 'Uploading…', size = 28, radius = 'inherit' }: UploadingOverlayProps) {
  const wrap: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 8,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    borderRadius: radius,
    zIndex: 5,
    pointerEvents: 'all',
  };

  const ring: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `${Math.max(2, Math.round(size / 12))}px solid rgba(255,255,255,0.30)`,
    borderTopColor: '#fff',
  };

  return (
    <div style={wrap} role="status" aria-live="polite" aria-label={label}>
      <div className="animate-spin" style={ring} />
      {label && (
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 0.2, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
          {label}
        </span>
      )}
    </div>
  );
}
