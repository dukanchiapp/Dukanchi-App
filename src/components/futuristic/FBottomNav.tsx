/**
 * FBottomNav — glass bottom navigation with a center AI orb.
 * Adapted from the design-system handoff (futuristic/components.jsx).
 *
 * Keyframe (f-glow-pulse) lives in src/futuristic.css.
 */
import { FIcon, type FIconName } from './FIcon';

interface FBottomNavItem {
  k: string;
  label: string;
  icon: FIconName;
  isAi?: boolean;
}

const ITEMS: FBottomNavItem[] = [
  { k: 'home', label: 'Home', icon: 'home' },
  { k: 'search', label: 'Search', icon: 'search' },
  { k: 'ai', label: 'AI', icon: 'sparkles', isAi: true },
  { k: 'map', label: 'Map', icon: 'mapPin' },
  { k: 'profile', label: 'Profile', icon: 'user' },
];

interface FBottomNavProps {
  active: string;
  onChange: (key: string) => void;
  onAi: () => void;
}

export function FBottomNav({ active, onChange, onAi }: FBottomNavProps) {
  return (
    <div
      style={{
        margin: '0 14px 8px',
        padding: '8px 6px',
        borderRadius: 30,
        background: 'rgba(20,20,40,0.55)',
        border: '1px solid rgba(255,255,255,0.14)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        boxShadow:
          '0 -2px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.10)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        flexShrink: 0,
        zIndex: 10,
        position: 'relative',
      }}
    >
      {ITEMS.map((it) => {
        const isActive = it.k === active;
        if (it.isAi) {
          return (
            <button
              key={it.k}
              onClick={onAi}
              aria-label="Open AI assistant"
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                border: 'none',
                background: 'linear-gradient(135deg, #FF6B35 0%, #FF2A8C 100%)',
                boxShadow:
                  '0 0 24px rgba(255,42,140,0.65), 0 0 48px rgba(255,107,53,0.35), inset 0 1px 0 rgba(255,255,255,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                marginTop: -10,
                animation: 'f-glow-pulse 2.8s ease-in-out infinite',
              }}
            >
              <FIcon name="sparkles" size={22} color="white" fill="white" />
            </button>
          );
        }
        return (
          <button
            key={it.k}
            onClick={() => onChange(it.k)}
            aria-label={it.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '6px 12px',
              borderRadius: 16,
              border: 'none',
              background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
              color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              transition: 'all 250ms var(--f-ease)',
            }}
          >
            <FIcon
              name={it.icon}
              size={20}
              color={isActive ? '#FF2A8C' : 'currentColor'}
              stroke={isActive ? 2.4 : 2}
            />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.3 }}>
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
