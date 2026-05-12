import { useState } from 'react';
import { Bell, Check, Box } from 'lucide-react';
import { useNotifications, Notification } from '../context/NotificationContext';

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
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="font-bold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 flex items-center"
              >
                <Check size={14} className="mr-1" /> Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <Bell size={32} className="text-gray-300 mb-3" />
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((notif) => (
                  <li 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer flex gap-3
                      ${!notif.isRead ? 'bg-indigo-50/30' : ''}
                    `}
                  >
                    <div className="mt-1">
                      {notif.type === 'NEW_POST' ? (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          <Box size={16} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center">
                          <Bell size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${!notif.isRead ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                        {notif.content}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notif.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2"></div>
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
