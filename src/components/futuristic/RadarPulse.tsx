/**
 * RadarPulse — concentric pulsing rings + sweep beam + shop dots.
 * The signature visual for "Ask Nearby" in the futuristic (v2) direction.
 * Adapted from the design-system handoff (futuristic/components.jsx).
 *
 * Keyframes (f-pulse-ring, f-spin-slow, f-glow-pulse) live in src/futuristic.css.
 */
import { useMemo } from 'react';

interface RadarPulseProps {
  size?: number;
  color?: string;
  shopCount?: number;
}

export function RadarPulse({
  size = 240,
  color = '#FF2A8C',
  shopCount = 8,
}: RadarPulseProps) {
  const shops = useMemo(
    () =>
      Array.from({ length: shopCount }, (_, i) => {
        const ang = (i / shopCount) * Math.PI * 2 + Math.random() * 0.4;
        const r = 0.32 + Math.random() * 0.4;
        return {
          x: 50 + Math.cos(ang) * r * 50,
          y: 50 + Math.sin(ang) * r * 50,
          delay: Math.random() * 2,
        };
      }),
    [shopCount],
  );

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `1px solid ${color}99`,
            animation: 'f-pulse-ring 3.2s ease-out infinite',
            animationDelay: `${i * 1.06}s`,
          }}
        />
      ))}
      <span
        style={{
          position: 'absolute',
          inset: '12%',
          borderRadius: '50%',
          border: `1px solid ${color}33`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: '32%',
          borderRadius: '50%',
          border: `1px solid ${color}33`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: '52%',
          borderRadius: '50%',
          border: `1px solid ${color}33`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `conic-gradient(from 0deg, transparent 0deg, ${color}66 20deg, transparent 60deg, transparent 360deg)`,
          animation: 'f-spin-slow 4s linear infinite',
          mixBlendMode: 'screen',
        }}
      />
      {shops.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 12px ${color}, 0 0 24px ${color}88`,
            animation: 'f-glow-pulse 2.4s ease-in-out infinite',
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'white',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 16px white, 0 0 32px #FF6B35',
        }}
      />
    </div>
  );
}
