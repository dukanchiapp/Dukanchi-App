/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useEffect, useState } from 'react';
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
import { useFcmRegistration } from './hooks/useFcmRegistration';
import ErrorBoundary from './components/ErrorBoundary';

import { useLocation } from 'react-router-dom';
import { isNative } from './lib/api';


function FlowController() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading } = useAuth();
  usePushNotifications();
  useFcmRegistration();        // native-only FCM token registration

  const isStandalone = (() => {
    try {
      if (localStorage.getItem('dk-browser-mode') === '1') return true;
    } catch(e) {}

    const matchStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.indexOf('android-app://') === 0;

    if (matchStandalone) {
      try { sessionStorage.setItem('dk-pwa', '1'); } catch(e) {}
      return true;
    }

    try {
      if (sessionStorage.getItem('dk-pwa') === '1') return true;
    } catch(e) {}

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

function BrowserModeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const isBrowserMode = localStorage.getItem('dk-browser-mode') === '1';
      const isDismissed = sessionStorage.getItem('dk-banner-dismissed') === '1';
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setShow(isBrowserMode && !isStandalone && !isDismissed);
    } catch(e) {}
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: '#FFF4ED', borderBottom: '1px solid #FFE4D6',
      padding: '8px 12px', display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      fontSize: 12,
    }}>
      <span style={{ color: '#666' }}>💡 App install karein better experience ke liye</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <a href="/landing" style={{ color: '#FF6B35', fontWeight: 600, textDecoration: 'none' }}>Install</a>
        <button
          onClick={() => {
            try { sessionStorage.setItem('dk-banner-dismissed', '1'); } catch(e) {}
            setShow(false);
          }}
          style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
        >×</button>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (!isNative()) return;

    // Dynamic imports so web bundle stays clean — Capacitor plugins never ship to dukanchi.com
    (async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        const { App: CapApp } = await import('@capacitor/app');
        const { Keyboard } = await import('@capacitor/keyboard');

        // Status bar: dark icons on cream background to match app
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#FAFAF8' });

        // Keyboard: ensure inputs scroll into view on focus (default Android is jumpy)
        Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});

        // Hardware back button: navigate browser history instead of exiting
        CapApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        });

        // Push notification tap → navigate to the conversation (deep link)
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const url = action.notification.data?.url;
          if (url && typeof url === 'string') {
            window.location.href = url;
          }
        });

        // Hide splash AFTER the app shell mounts so user never sees a blank white frame
        await SplashScreen.hide({ fadeOutDuration: 200 });
      } catch (err) {
        console.error('[native-init] plugin setup failed:', err);
      }
    })();
  }, []);

  return (
    <ErrorBoundary>
    <Router>
      <AuthProvider>
        <ToastProvider>
          <LocationProvider>
          <NotificationProvider>
            <FlowController />
            <div className="min-h-screen pb-16" style={{ background: 'var(--dk-bg)' }}>
              <BrowserModeBanner />
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
