import { Link, useLocation } from 'react-router-dom';
import { Home, Search, MapPin, MessageCircle, User } from 'lucide-react';

const navItems = [
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
      style={{ background: 'var(--dk-bg)', borderTop: '0.5px solid var(--dk-border)' }}
    >
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive =
            location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-center w-full h-full gap-1"
            >
              <Icon
                size={22}
                fill={isActive ? '#FF6B35' : 'none'}
                color={isActive ? '#FF6B35' : '#888'}
                strokeWidth={isActive ? 0 : 2}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: isActive ? '#FF6B35' : '#888',
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
