/**
 * LiveOrb — animated signal orb. Pulsing rings + glass core showing a live
 * count (e.g. active stores near you). Adapted from the design-system handoff.
 *
 * Keyframes (f-orb-float, f-pulse-ring) live in src/futuristic.css.
 */
interface LiveOrbProps {
  count?: number;
  label?: string;
  color?: string;
}

export function LiveOrb({
  count = 8,
  label = 'live near you',
  color = '#FF2A8C',
}: LiveOrbProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: 92,
        height: 92,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}66 0%, transparent 65%)`,
          animation: 'f-orb-float 4s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 6,
          borderRadius: '50%',
          border: `1px solid ${color}66`,
          animation: 'f-pulse-ring 2.4s ease-out infinite',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 14,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${color}88`,
          boxShadow: `0 0 24px ${color}88`,
        }}
      />
      <div style={{ position: 'relative', textAlign: 'center', color: 'white' }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          {count}
        </div>
        <div
          style={{
            fontSize: 8,
            color: 'rgba(255,255,255,0.65)',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginTop: 2,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
