import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    // index.html IIFE already redirected browser users to /landing before React loaded.
    // If we reach here in browser mode — something went wrong, do a hard redirect.
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;

    if (!isStandalone) {
      // Hard redirect (not React Router) so Express serves public/landing.html
      window.location.replace('/landing');
      return null;
    }

    // PWA standalone — go to login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
