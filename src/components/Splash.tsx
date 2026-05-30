import { FLogo } from './futuristic/FLogo';

/**
 * Splash — Futuristic v3 boot screen (Session 123).
 *
 * Rendered by App's BootGate WHILE AuthContext.isLoading is true — i.e. for
 * the real duration of the initial `/api/auth/me` network check (resolves via
 * AuthProvider's `.finally`, always terminates). NOT a fake timer: it's gated
 * on actual auth/hydration state, so it shows for exactly as long as the boot
 * really takes, then unmounts when the app is ready.
 *
 * Deep-space aurora bg + 64px gradient logo tile + magenta orbiting loader
 * ring + wordmark + "Made in India 🇮🇳".
 */
export default function Splash() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--f-bg-deep)',
        backgroundImage: 'var(--f-page-bg)',
        fontFamily: 'var(--f-font)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          animation: 'f-fade-up 0.6s var(--f-ease)',
        }}
      >
        {/* Logo tile + orbiting magenta loader ring */}
        <div style={{ position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'var(--b-magenta-ink)',
              borderRightColor: 'rgba(199,126,0,0.30)',
              animation: 'f-spin-slow 1.2s linear infinite',
            }}
          />
          <span
            style={{
              position: 'absolute',
              inset: 6,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(199,126,0,0.18), transparent 70%)',
            }}
          />
          <FLogo size={64} />
        </div>

        {/* Wordmark */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--f-text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            Dukanchi
          </div>
          <div style={{ fontSize: 12, color: 'var(--f-text-3)', marginTop: 6, fontWeight: 500, letterSpacing: 0.2 }}>
            apna bazaar, apni dukaan
          </div>
        </div>
      </div>

      {/* Bottom tagline */}
      <div style={{ position: 'absolute', bottom: 36, left: 0, right: 0, textAlign: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--f-text-3)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Made in India 🇮🇳
        </span>
      </div>
    </div>
  );
}
