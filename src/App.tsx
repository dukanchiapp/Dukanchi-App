/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import LandingPage from './pages/LandingPage';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LocationProvider } from './context/LocationContext';
import ProtectedRoute from './components/ProtectedRoute';
import BottomNav from './components/BottomNav';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <LocationProvider>
          <NotificationProvider>
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
                <Route path="/landing" element={<LandingPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              <BottomNav />
            </div>
          </NotificationProvider>
          </LocationProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
