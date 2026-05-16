import { useState } from 'react';
import { useNotifications, Notification } from '../context/NotificationContext';
import { FIcon } from './futuristic';

/* ── Futuristic v2 skin · Phase 10 / feat/futuristic-redesign ──
   View layer restyled to the deep-space glass system. The notification
   context wiring (read state, mark-read, mark-all-read) is verbatim. */

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) {
      markAsRead(notif.id);
    }
    // Theoretically handle navigation via notif.referenceId here later
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 12, cursor: 'pointer',
          background: 'transparent', border: 'none', color: 'var(--f-text-1)',
        }}
        aria-label="Notifications"
      >
        <FIcon name="bell" size={22} color="currentColor" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 16, height: 16, padding: '0 4px', borderRadius: 9999,
            background: 'var(--f-danger)', color: 'white', fontSize: 9, fontWeight: 800,
            border: '2px solid var(--f-bg-deep)', boxShadow: '0 0 8px rgba(255,77,106,0.6)',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', right: 0, marginTop: 8, width: 320, zIndex: 50, overflow: 'hidden',
          borderRadius: 18, background: 'var(--f-modal-bg)', border: '1px solid var(--f-glass-border-2)',
          backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        }}>
          <div style={{
            padding: 14, borderBottom: '1px solid var(--f-glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--f-text-1)', margin: 0 }}>Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--f-magenta-light)', fontFamily: 'inherit',
                }}
              >
                <FIcon name="check" size={13} color="var(--f-magenta-light)" /> Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <FIcon name="bell" size={32} color="var(--f-text-4)" />
                <p style={{ fontSize: 13, color: 'var(--f-text-3)', marginTop: 12 }}>You're all caught up!</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {notifications.map((notif) => (
                  <li
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    style={{
                      padding: 14, cursor: 'pointer', display: 'flex', gap: 12,
                      borderBottom: '1px solid var(--f-glass-border)',
                      background: !notif.isRead ? 'rgba(255,42,140,0.06)' : 'transparent',
                    }}
                  >
                    <div style={{ marginTop: 2 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: notif.type === 'NEW_POST' ? 'rgba(255,42,140,0.15)' : 'var(--f-glass-bg-2)',
                      }}>
                        <FIcon
                          name={notif.type === 'NEW_POST' ? 'image' : 'bell'}
                          size={15}
                          color={notif.type === 'NEW_POST' ? 'var(--f-magenta-light)' : 'var(--f-text-3)'}
                        />
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, lineHeight: 1.4, margin: 0,
                        color: !notif.isRead ? 'var(--f-text-1)' : 'var(--f-text-3)',
                        fontWeight: !notif.isRead ? 600 : 400,
                      }}>
                        {notif.content}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--f-text-4)', marginTop: 4, marginBottom: 0 }}>
                        {new Date(notif.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', background: 'var(--f-magenta)',
                        marginTop: 6, flexShrink: 0, boxShadow: '0 0 8px rgba(255,42,140,0.6)',
                      }} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
