/**
 * IsoMap — pure CSS-3D pseudo-isometric map of nearby stores.
 * No WebGL — uses `perspective` + `transformStyle: preserve-3d`.
 * Adapted from the design-system handoff (futuristic/components.jsx).
 *
 * Keyframe (f-pulse-ring) lives in src/futuristic.css.
 */

export interface IsoMapStore {
  id: string | number;
  /** Percentage position on the grid. */
  x: number;
  y: number;
  /** Pylon height factor. */
  h: number;
  label: string;
  color?: string;
}

interface IsoMapProps {
  stores: IsoMapStore[];
  onSelect?: (store: IsoMapStore) => void;
  focused?: string | number;
  accent?: string;
}

export function IsoMap({
  stores,
  onSelect,
  focused,
  accent = 'var(--b-magenta-ink)',
}: IsoMapProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        perspective: 1400,
        perspectiveOrigin: '50% 30%',
        background:
          'radial-gradient(ellipse at 50% 65%, rgba(66, 133, 244, 0.12) 0%, transparent 55%), radial-gradient(ellipse at 30% 30%, rgba(162, 89, 255, 0.1) 0%, transparent 50%), linear-gradient(160deg, #1f2227 0%, #15171a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transform: 'rotateX(56deg) rotateZ(-12deg) translateY(20%)',
        }}
      >
        {/* Grid floor */}
        <div
          style={{
            position: 'absolute',
            left: '-20%',
            right: '-20%',
            top: '-20%',
            bottom: '-20%',
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage:
              'radial-gradient(ellipse at center, black 35%, transparent 70%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at center, black 35%, transparent 70%)',
          }}
        />
        {/* Shop pylons */}
        {stores.map((s) => {
          const isFocused = focused === s.id;
          const color = s.color || accent;
          return (
            <div
              key={s.id}
              onClick={() => onSelect?.(s)}
              style={{
                position: 'absolute',
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: 26,
                height: 26,
                transformStyle: 'preserve-3d',
                transform: `translate(-50%, -50%) rotateX(-56deg) rotateZ(12deg) translateZ(${s.h * 1.5}px)`,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 6,
                  background: `linear-gradient(135deg, ${color}, ${color}88)`,
                  boxShadow: `0 0 24px ${color}AA, 0 16px 32px rgba(0,0,0,0.6)`,
                  border: isFocused ? '2px solid white' : `1px solid ${color}`,
                  transform: isFocused ? 'scale(1.4)' : 'scale(1)',
                  transition: 'transform 320ms var(--f-ease-spring)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 11,
                }}
              >
                {s.label}
              </div>
            </div>
          );
        })}
        {/* User pulse — center */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 32,
            height: 32,
            transformStyle: 'preserve-3d',
            transform: 'translate(-50%, -50%) rotateX(-56deg) rotateZ(12deg)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: -16,
              borderRadius: '50%',
              border: '1.5px solid var(--b-magenta-ink)',
              animation: 'f-pulse-ring 2.4s ease-out infinite',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              border: '1.5px solid var(--b-magenta-ink)',
              animation: 'f-pulse-ring 2.4s ease-out infinite',
              animationDelay: '0.8s',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'var(--b-magenta-ink)',
              boxShadow: 'var(--b-elev-card)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
