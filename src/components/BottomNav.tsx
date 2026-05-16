import { Link, useLocation } from 'react-router-dom';
import { FIcon, type FIconName } from './futuristic';

/* ── Futuristic v2 skin · Phase 10 / feat/futuristic-redesign ──
   Floating glass bottom navigation. Routes, active-tab detection, and the
   hide-on-auth/chat/landing logic are preserved verbatim. */

const navItems: { path: string; icon: FIconName; label: string }[] = [
  { path: '/', icon: 'home', label: 'Home' },
  { path: '/search', icon: 'search', label: 'Search' },
  { path: '/map', icon: 'mapPin', label: 'Map' },
  { path: '/messages', icon: 'msg', label: 'Chat' },
  { path: '/profile', icon: 'user', label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();

  if (
    location.pathname.startsWith('/chat/') ||
    location.pathname === '/signup' ||
    location.pathname === '/login' ||
    location.pathname === '/landing'
  ) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 pb-safe z-40"
      style={{ pointerEvents: 'none' }}
    >
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 14px 8px' }}>
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
            padding: '8px 6px', borderRadius: 30,
            background: 'rgba(20,20,40,0.62)',
            border: '1px solid var(--f-glass-border-2)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            boxShadow: '0 -2px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)',
          }}
        >
          {navItems.map(({ path, icon, label }) => {
            const isActive =
              location.pathname === path ||
              (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  padding: '6px 14px', borderRadius: 16, textDecoration: 'none',
                  background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                  transition: 'background 250ms var(--f-ease)',
                }}
              >
                <FIcon
                  name={icon}
                  size={21}
                  color={isActive ? 'var(--f-magenta)' : 'rgba(244,242,235,0.55)'}
                  stroke={isActive ? 2.4 : 2}
                />
                <span style={{
                  fontSize: 9.5, fontWeight: 600, letterSpacing: 0.3,
                  color: isActive ? 'var(--f-text-1)' : 'rgba(244,242,235,0.55)',
                }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
