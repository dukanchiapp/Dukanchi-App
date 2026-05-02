/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import SignupPage from './pages/Signup';
import LoginPage from './pages/Login';
import NotFoundPage from './pages/NotFound';

const HomePage = lazy(() => import('./pages/Home'));
const SearchPage = lazy(() => import('./pages/Search'));
const MapPage = lazy(() => import('./pages/Map'));
const MessagesPage = lazy(() => import('./pages/Messages'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const StoreProfilePage = lazy(() => import('./pages/StoreProfile'));
const RetailerDashboard = lazy(() => import('./pages/RetailerDashboard'));
const ChatPage = lazy(() => import('./pages/Chat'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const SupportPage = lazy(() => import('./pages/Support'));
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LocationProvider } from './context/LocationContext';
import ProtectedRoute from './components/ProtectedRoute';
import BottomNav from './components/BottomNav';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import { useAuth } from './context/AuthContext';
import { usePushNotifications } from './hooks/usePushNotifications';
import ErrorBoundary from './components/ErrorBoundary';

import { useLocation } from 'react-router-dom';


function FlowController() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  usePushNotifications();

  const isStandalone = (() => {
    const direct =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.indexOf('android-app://') === 0;

    if (direct) {
      try { sessionStorage.setItem('dk-is-pwa', '1'); } catch (e) {}
      return true;
    }

    try {
      if (sessionStorage.getItem('dk-is-pwa') === '1') return true;
    } catch (e) {}

    return false;
  })();

  useEffect(() => {
    // index.html handles browser→landing redirect before React loads
    if (!isStandalone) return;

    // PWA standalone flow — wait for auth to resolve
    if (isLoading) return;

    // Logged in → no redirect needed
    if (!!user) return;

    // Standalone + not logged in → go to /signup unless already on auth page
    if (location.pathname !== '/login' && location.pathname !== '/signup') {
      navigate('/signup', { replace: true });
    }
  }, [user, isLoading, location.pathname, navigate, isStandalone]);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
    <Router>
      <AuthProvider>
        <ToastProvider>
          <LocationProvider>
          <NotificationProvider>
            <FlowController />
            <div className="min-h-screen pb-16" style={{ background: 'var(--dk-bg)' }}>
              <Suspense fallback={
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="animate-spin" style={{ width: 36, height: 36, border: '3px solid var(--dk-border)', borderTopColor: 'var(--dk-accent)', borderRadius: '50%' }} />
                </div>
              }>
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
              </Suspense>
              <BottomNav />
              <PWAInstallPrompt />
            </div>
          </NotificationProvider>
          </LocationProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
    </ErrorBoundary>
  );
}
