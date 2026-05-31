import { useNotifications, type Notification } from '../context/NotificationContext';
import { FIcon } from './futuristic';

/* ── Session 128.15 — Bright Skin NotificationsDrawer ────────────────────────
   The DROPDOWN portion of the notifications UI, extracted from
   NotificationBell.tsx so a page can pair it with the Header primitive's
   built-in bell button (per dukanchi-bright-skin/react-stubs/Header.jsx —
   the chip-bg bell). Renders nothing when isOpen=false. Owns no bell button.

   useNotifications() is the same context (read state + mark-read) as the
   original NotificationBell.tsx. */

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsDrawer({ isOpen, onClose }: NotificationsDrawerProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  if (!isOpen) return null;

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.isRead) markAsRead(notif.id);
    onClose();
  };

  return (
    <>
      {/* dim backdrop — click outside to close (matches the existing pattern) */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 49,
          background: 'transparent',
        }}
      />
      <div
        style={{
          position: 'fixed',
          right: 16,
          top: 'calc(env(safe-area-inset-top, 0px) + 64px)',
          width: 320,
          maxWidth: 'calc(100vw - 32px)',
          zIndex: 50,
          overflow: 'hidden',
          borderRadius: 18,
          background: '#fff',
          border: '1px solid var(--b-line)',
          boxShadow: 'var(--b-elev-2)',
        }}
      >
        <div
          style={{
            padding: 14,
            borderBottom: '1px solid var(--b-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--b-ink)', margin: 0 }}>
            Notifications
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--b-magenta-ink)',
                fontFamily: 'inherit',
              }}
            >
              <FIcon name="check" size={13} color="var(--b-magenta-ink)" /> Mark all read
            </button>
          )}
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <FIcon name="bell" size={32} color="var(--b-gray-3)" />
              <p style={{ fontSize: 13, color: 'var(--b-gray-2)', marginTop: 12 }}>You're all caught up!</p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 12,
                    borderBottom: '1px solid var(--b-line)',
                    background: !notif.isRead ? 'var(--b-tint)' : 'transparent',
                  }}
                >
                  <div style={{ marginTop: 2 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: notif.type === 'NEW_POST' ? 'var(--b-tint)' : 'var(--b-surface)',
                      }}
                    >
                      <FIcon
                        name={notif.type === 'NEW_POST' ? 'image' : 'bell'}
                        size={15}
                        color={notif.type === 'NEW_POST' ? 'var(--b-magenta-ink)' : 'var(--b-gray-2)'}
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        lineHeight: 1.4,
                        margin: 0,
                        color: !notif.isRead ? 'var(--b-ink)' : 'var(--b-gray-2)',
                        fontWeight: !notif.isRead ? 600 : 400,
                      }}
                    >
                      {notif.content}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--b-gray-3)', marginTop: 4, marginBottom: 0 }}>
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--b-magenta-ink)',
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
