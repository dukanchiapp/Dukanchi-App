import { Link } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div
      className="max-w-md mx-auto min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--f-bg-deep)', fontFamily: 'var(--f-font)' }}
    >
      <div className="text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'var(--b-tint)' }}
        >
          <AlertTriangle size={36} style={{ color: 'var(--f-orange)' }} />
        </div>
        <h1 className="text-6xl font-extrabold mb-2" style={{ color: 'var(--f-text-1)' }}>404</h1>
        <p className="text-lg mb-1" style={{ color: 'var(--f-text-2)' }}>Page Not Found</p>
        <p className="text-sm mb-8" style={{ color: 'var(--f-text-3)' }}>The page you're looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="inline-flex items-center px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ background: 'var(--b-grad)', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 14px rgba(199,126,0,0.30)' }}
        >
          <Home size={18} className="mr-2" />
          Go Home
        </Link>
      </div>
    </div>
  );
}
