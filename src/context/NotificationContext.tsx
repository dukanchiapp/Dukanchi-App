import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { apiFetch, getSocketUrl, getSocketAuthOptions } from '../lib/api';

export interface Notification {
  id: string;
  type: string;
  content: string;
  isRead: boolean;
  referenceId?: string;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [, setSocket] = useState<Socket | null>(null);
  const reopenCountRef = useRef(0);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch notifications', e);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const newSocket = io(getSocketUrl(), getSocketAuthOptions());
    reopenCountRef.current = 0;

    const isDev = import.meta.env.DEV;
    newSocket.on('connect', () => {
      if (isDev) console.log('[SOCKET][NotificationCtx] connected', newSocket.id);
    });
    newSocket.on('connect_error', (err) => {
      console.warn('[SOCKET][NotificationCtx] connect_error:', err.message);
    });
    newSocket.on('disconnect', (reason) => {
      if (isDev) console.warn('[SOCKET][NotificationCtx] disconnect', reason);
    });

    // Reconnection-aware refetch: recover notifications missed while tab was backgrounded
    const handleReopen = () => {
      reopenCountRef.current += 1;
      if (reopenCountRef.current > 1) {
        fetchNotifications();
      }
    };
    newSocket.io.on('reconnect', handleReopen);
    newSocket.io.engine?.on('open', handleReopen);

    newSocket.on('newNotification', (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    });

    // Mobile foreground wakeup
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && newSocket && !newSocket.connected) {
        newSocket.connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    setSocket(newSocket);

    return () => {
      newSocket.io.off('reconnect', handleReopen);
      newSocket.io.engine?.off('open', handleReopen);
      document.removeEventListener('visibilitychange', onVisibility);
      newSocket.disconnect();
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    if (!user) return;
    await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    if (!user) return;
    await apiFetch(`/api/notifications/read-all`, { method: 'POST' });
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
