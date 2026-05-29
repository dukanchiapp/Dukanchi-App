import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen" style={{ background: 'var(--f-bg-deep)' }}>
        <div
          className="animate-spin rounded-full h-8 w-8"
          style={{ border: '3px solid var(--f-glass-border-2)', borderTopColor: 'var(--f-magenta)' }}
        ></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
