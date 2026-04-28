/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import HomePage from './pages/Home';
import SearchPage from './pages/Search';
import MapPage from './pages/Map';
import MessagesPage from './pages/Messages';
import ProfilePage from './pages/Profile';
import StoreProfilePage from './pages/StoreProfile';
import RetailerDashboard from './pages/RetailerDashboard';
import ChatPage from './pages/Chat';
import SignupPage from './pages/Signup';
import LoginPage from './pages/Login';
import UserSettings from './pages/UserSettings';
import SupportPage from './pages/Support';
import NotFoundPage from './pages/NotFound';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LocationProvider } from './context/LocationContext';
import ProtectedRoute from './components/ProtectedRoute';
import BottomNav from './components/BottomNav';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useAuth } from './context/AuthContext';

// FIX 5: Redirect unauthenticated standalone (PWA) users to /signup
function PWARedirect() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone && !user && !isLoading) {
      navigate('/signup', { replace: true });
    }
  }, [user, isLoading, navigate]);
  return null;
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <LocationProvider>
          <NotificationProvider>
            <PWARedirect />
            <div className="min-h-screen pb-16" style={{ background: 'var(--dk-bg)' }}>
              <Routes>
                <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/store/:id" element={<StoreProfilePage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/retailer/dashboard" element={<ProtectedRoute><RetailerDashboard /></ProtectedRoute>} />
                <Route path="/chat/:userId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><UserSettings /></ProtectedRoute>} />
                <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              <BottomNav />
              <PWAInstallPrompt />
            </div>
          </NotificationProvider>
          </LocationProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
