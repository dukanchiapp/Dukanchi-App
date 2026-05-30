/**
 * FLogo — Dukanchi futuristic (v2) logo. Glass tile with gradient द glyph.
 * Adapted from the design-system handoff (futuristic/components.jsx).
 */
interface FLogoProps {
  size?: number;
  glow?: boolean;
}

export function FLogo({ size = 36, glow = true }: FLogoProps) {
  // Session 128.9 — Blinkit-style yellow app-icon tile. Subtle vertical
  // gradient (top-light → bottom-dark) plus an inner top highlight gives a 3D
  // "tactile button" feel. Dark "द" on yellow = high-contrast Blinkit
  // signature. Works on ANY background surface.
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'linear-gradient(180deg, #FFD75A 0%, #F8CB46 55%, #E6B92E 100%)',
        boxShadow: glow
          ? '0 4px 14px rgba(248,203,70,0.45), 0 2px 6px rgba(230,185,46,0.30), inset 0 1px 0 rgba(255,255,255,0.55)'
          : '0 2px 6px rgba(230,185,46,0.30), inset 0 1px 0 rgba(255,255,255,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Specular highlight — soft white sheen on the top half. Adds the
          "3D button" feel without going skeuomorphic. */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />
      <span
        style={{
          position: 'relative',
          color: '#1A1A1A',
          fontSize: size * 0.52,
          fontWeight: 800,
          lineHeight: 1,
          textShadow: '0 1px 0 rgba(255,255,255,0.45)',
        }}
      >
        द
      </span>
    </div>
  );
}
