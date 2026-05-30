import { Link, useLocation } from 'react-router-dom';

/* ── Session 128.13 — Bright Skin BottomNav ─────────────────────────────────
   Replaces the previous BottomNav (Session 128.10 Blinkit-Phase-2 yellow-pill
   active state). Visual contract now matches dukanchi-bright-skin/react-stubs/
   BottomNav.jsx EXACTLY: 62px tall, white surface, hairline top border, active
   tab tinted with var(--b-magenta-ink) (#C77E00 in the yellow theme).

   Preserved from previous BottomNav:
   - Route → tab mapping (Home / Search / Map / Chat / Profile)
   - Hide on /chat/*, /signup, /login, /landing
   - app-bottom-nav class so body.modal-open hides it (Session 128.1
     post-sheet anti-overlap rule in src/index.css)
   - max-w 480 mobile-first container preserved by the layout above
   ─────────────────────────────────────────────────────────────────────────── */

const ICONS: Record<string, string> = {
  home:    '<path d="M3 9.5L12 2l9 7.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  map:     '<path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/>',
  chat:    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};

const TABS: { key: keyof typeof ICONS; label: string; path: string }[] = [
  { key: 'home',    label: 'Home',    path: '/' },
  { key: 'search',  label: 'Search',  path: '/search' },
  { key: 'map',     label: 'Map',     path: '/map' },
  { key: 'chat',    label: 'Chat',    path: '/messages' },
  { key: 'profile', label: 'Profile', path: '/profile' },
];

export default function BottomNav() {
  const location = useLocation();

  // Hide-on-route rules preserved from prior BottomNav.
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
        maxWidth: 480,
        margin: '0 auto',
        background: '#fff',
        borderTop: '1px solid var(--b-line)',
        height: 62,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        flexShrink: 0,
      }}
    >
      {TABS.map(({ key, label, path }) => {
        const isActive =
          location.pathname === path ||
          (path !== '/' && location.pathname.startsWith(path));
        const col = isActive ? 'var(--b-magenta-ink)' : 'var(--b-gray-3)';
        return (
          <Link
            key={key}
            to={path}
            aria-current={isActive ? 'page' : undefined}
            className="b-tap b-ripple"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              textDecoration: 'none',
              padding: '6px 10px',
              outline: 'none',
              WebkitTapHighlightColor: 'transparent',
              transition: 'color 200ms var(--b-ease)',
            }}
          >
            <svg
              width={23}
              height={23}
              viewBox="0 0 24 24"
              fill="none"
              stroke={col}
              strokeWidth={isActive ? 2.4 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dangerouslySetInnerHTML={{ __html: ICONS[key] }}
            />
            <span
              style={{
                fontSize: 10.5,
                fontWeight: isActive ? 800 : 600,
                color: col,
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
