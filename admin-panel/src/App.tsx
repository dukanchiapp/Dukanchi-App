import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Stores from './pages/Stores';
import Posts from './pages/Posts';
import Reports from './pages/Reports';
import Complaints from './pages/Complaints';
import KycReview from './pages/KycReview';
import Chats from './pages/Chats';
import Settings from './pages/Settings';
import StoreMembers from './pages/StoreMembers';
import { ToastProvider } from './context/ToastContext';

import { useState, useEffect } from 'react';
import api from './lib/api';

function ProtectedRoute({ children, isAuthenticated, isLoading }: { children: React.ReactNode, isAuthenticated: boolean, isLoading: boolean }) {
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get('/api/me')
      .then(res => {
        if (res.data && !res.data.error) setIsAuthenticated(true);
      })
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={() => setIsAuthenticated(true)} />} />
          <Route path="/dashboard" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><Dashboard /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><Users /></ProtectedRoute>} />
          <Route path="/stores" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><Stores /></ProtectedRoute>} />
          <Route path="/posts" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><Posts /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><Reports /></ProtectedRoute>} />
          <Route path="/complaints" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><Complaints /></ProtectedRoute>} />
          <Route path="/kyc" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><KycReview /></ProtectedRoute>} />
          <Route path="/chats" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><Chats /></ProtectedRoute>} />
          <Route path="/store-members" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><StoreMembers /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute isLoading={isLoading} isAuthenticated={isAuthenticated}><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
