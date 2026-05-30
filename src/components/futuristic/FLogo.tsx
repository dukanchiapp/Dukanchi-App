/**
 * FLogo — Dukanchi futuristic (v2) logo. Glass tile with gradient द glyph.
 * Adapted from the design-system handoff (futuristic/components.jsx).
 */
interface FLogoProps {
  size?: number;
  glow?: boolean;
}

export function FLogo({ size = 36, glow = true }: FLogoProps) {
  // Session 128.8: solid gradient tile (was a translucent frosted-glass tile
  // designed for the old deep-space skin — washed out on white surfaces). The
  // logo is now an "app icon": orange→magenta gradient, white "द", soft warm
  // shadow when glow=true. Works on ANY background surface.
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'linear-gradient(135deg, #FF6B35 0%, #FF2A8C 100%)',
        boxShadow: glow
          ? '0 4px 14px rgba(255,107,53,0.30), 0 2px 6px rgba(255,42,140,0.22)'
          : '0 2px 6px rgba(255,42,140,0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'relative',
          color: '#fff',
          fontSize: size * 0.52,
          fontWeight: 700,
          lineHeight: 1,
          textShadow: '0 1px 2px rgba(0,0,0,0.20)',
        }}
      >
        द
      </span>
    </div>
  );
}
