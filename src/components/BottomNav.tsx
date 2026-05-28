import { Link, useLocation } from 'react-router-dom';
import { Home, Search, MapPin, MessageCircle, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ── Futuristic v3 skin · Session 117 / feat/reskin-header-nav ──
   Floating glass bottom navigation. Routes, active-tab detection, and the
   hide-on-auth/chat/landing logic are preserved verbatim. v3 changes the
   active state from the v2 solid-gradient tile to a translucent inset pill
   with a magenta-tinted icon, and swaps FIcon → lucide-react. */

const navItems: { path: string; icon: LucideIcon; label: string }[] = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/search', icon: Search, label: 'Search' },
  { path: '/map', icon: MapPin, label: 'Map' },
  { path: '/messages', icon: MessageCircle, label: 'Chat' },
  { path: '/profile', icon: User, label: 'Profile' },
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
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 6px 6px' }}>
        <div
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-around',
            padding: '8px 4px', borderRadius: 32,
            background: 'var(--f-bottom-nav-bg)',
            border: '1px solid var(--f-glass-border-2)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            boxShadow: '0 -8px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.30)',
          }}
        >
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive =
              location.pathname === path ||
              (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  position: 'relative',
                  flex: 1,
                  minHeight: 58,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  padding: '10px 6px 8px', borderRadius: 20,
                  textDecoration: 'none',
                  transition: 'all 250ms var(--f-ease)',
                }}
              >
                {/* v3 active pill — translucent inset, magenta border + glow */}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute', inset: '2px 8px',
                      borderRadius: 18,
                      background: 'linear-gradient(135deg, rgba(255,107,53,0.22), rgba(255,42,140,0.28))',
                      border: '1px solid rgba(255,42,140,0.45)',
                      boxShadow: '0 4px 14px rgba(255,42,140,0.30), inset 0 1px 0 rgba(255,255,255,0.20)',
                    }}
                  />
                )}
                <Icon
                  size={22}
                  color={isActive ? '#FF2A8C' : 'var(--f-text-3)'}
                  fill={isActive ? 'rgba(255,42,140,0.14)' : 'none'}
                  strokeWidth={isActive ? 2.4 : 2}
                  style={{ position: 'relative' }}
                />
                <span style={{
                  position: 'relative',
                  fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
                  color: isActive ? '#FF2A8C' : 'var(--f-text-3)',
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
