/**
 * FLogo — Dukanchi futuristic (v2) logo. Glass tile with gradient द glyph.
 * Adapted from the design-system handoff (futuristic/components.jsx).
 */
interface FLogoProps {
  size?: number;
  glow?: boolean;
}

export function FLogo({ size = 36, glow = true }: FLogoProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.22)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: glow
          ? '0 0 24px rgba(255,107,53,0.50), inset 0 1px 0 rgba(255,255,255,0.35)'
          : 'inset 0 1px 0 rgba(255,255,255,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -2,
          background:
            'linear-gradient(135deg, rgba(255,107,53,0.45), rgba(255,42,140,0.45))',
          opacity: 0.55,
        }}
      />
      <span
        style={{
          position: 'relative',
          color: 'white',
          fontSize: size * 0.5,
          fontWeight: 600,
          lineHeight: 1,
          textShadow: '0 0 12px rgba(255,107,53,0.7)',
        }}
      >
        द
      </span>
    </div>
  );
}
