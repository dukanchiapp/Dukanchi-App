import { Link, useLocation } from 'react-router-dom';
import { Home, Search, MapPin, MessageCircle, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ── Bright skin · flat white bottom bar ──
   Routes, active-tab detection, and the hide-on-auth/chat/landing logic are
   preserved verbatim. Visual layer ported to the Bright design (bright.html
   .bnav): a flat full-width white bar (no floating glass pill), active tab in
   magenta-ink #D11F75, Home icon filled when active. */

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
      className="app-bottom-nav fixed bottom-0 left-0 right-0 pb-safe z-40"
      style={{
        maxWidth: 480, margin: '0 auto',
        background: 'var(--b-bg)',
        borderTop: '1px solid var(--b-line)',
        boxShadow: '0 -4px 20px rgba(255,107,53,0.06)',
      }}
    >
      <div
        style={{
          height: 62,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        }}
      >
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive =
            location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));
          const isHome = path === '/';
          // Session 128.10 — Blinkit bottom-nav active state: yellow rounded
          // square BEHIND the icon (compare their Print tab) + dark icon +
          // dark bold label. Replaces the magenta-text-only active hint with
          // something users see from across the room.
          const iconColor = isActive ? 'var(--b-yellow-ink)' : '#A8A8A8';
          const labelColor = isActive ? 'var(--b-yellow-ink)' : '#A8A8A8';
          return (
            <Link
              key={path}
              to={path}
              aria-current={isActive ? 'page' : undefined}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                padding: '4px 0',
                textDecoration: 'none',
                outline: 'none', WebkitTapHighlightColor: 'transparent',
                transition: 'color 200ms var(--b-ease)',
              }}
            >
              <span
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 44, height: 30, borderRadius: 12,
                  background: isActive ? 'var(--b-yellow)' : 'transparent',
                  boxShadow: isActive ? '0 2px 6px rgba(248,203,70,0.40)' : 'none',
                  transition: 'background 180ms var(--b-ease)',
                }}
              >
                <Icon
                  size={20}
                  color={iconColor}
                  fill={isHome && isActive ? iconColor : 'none'}
                  strokeWidth={isHome && isActive ? 0 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </span>
              <span style={{
                fontSize: 10, fontWeight: isActive ? 800 : 600, letterSpacing: 0.2,
                color: labelColor,
              }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
