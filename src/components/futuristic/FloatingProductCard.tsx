/**
 * FloatingProductCard — CSS-3D rotating product card with bright gradient fill.
 * Used on the futuristic (v2) store profile. Adapted from the design-system
 * handoff (futuristic/components.jsx).
 *
 * Keyframe (f-tilt-3d) lives in src/futuristic.css.
 */
export interface FloatingProduct {
  /** A CSS background value — image url() or gradient. */
  image?: string;
  tag?: string;
  name?: string;
}

interface FloatingProductCardProps {
  product?: FloatingProduct;
  size?: number;
}

export function FloatingProductCard({
  product,
  size = 220,
}: FloatingProductCardProps) {
  return (
    <div
      style={{
        width: size,
        height: size * 1.3,
        perspective: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '78%',
          height: '78%',
          borderRadius: 24,
          background:
            product?.image || 'linear-gradient(135deg, #FF6B35 0%, #FF2A8C 100%)',
          animation: 'f-tilt-3d 6s ease-in-out infinite',
          transformStyle: 'preserve-3d',
          boxShadow:
            '0 30px 60px rgba(255,42,140,0.35), 0 0 60px rgba(255,107,53,0.25)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.30) 0%, transparent 50%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            color: 'white',
          }}
        >
          <div
            style={{
              fontSize: 10,
              opacity: 0.7,
              fontWeight: 600,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            {product?.tag || 'New arrival'}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              marginTop: 2,
              letterSpacing: '-0.02em',
            }}
          >
            {product?.name || 'PS5 Console'}
          </div>
        </div>
      </div>
    </div>
  );
}
