import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { NotificationSettings } from '../components/NotificationSettings';
import { UserAvatar } from '../components/UserAvatar';
import { IconChat, IconMatches, IconNotifications, IconProfile } from '../components/icons';
import { MissedCallIcon } from '../components/MissedCallIcon';
import {
  formatRelativeTime,
  notificationDestination,
  notificationTypeLabel,
} from '../lib/notifications';
import { refreshNotifications } from '../hooks/useNotificationSync';
import { useNotificationStore, type Notification } from '../hooks/store';

export const Notifications = () => {
  const navigate = useNavigate();
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loadError = useNotificationStore((s) => s.loadError);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  useEffect(() => {
    void refreshNotifications();
  }, []);

  const handleOpen = useCallback(
    async (notification: Notification) => {
      if (!notification.read) {
        markAsRead(notification.id);
        try {
          const res = await notificationsAPI.markRead(notification.id);
          setUnreadCount(res.data.unread_count ?? 0);
        } catch {
          /* local state already updated */
        }
      }
      navigate(notificationDestination(notification));
    },
    [markAsRead, navigate, setUnreadCount],
  );

  const handleMarkAllRead = async () => {
    markAllAsRead();
    try {
      await notificationsAPI.markAllRead();
    } catch {
      /* ignore */
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-6 pb-10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[#F0E0C0]">Notifications</h1>
            <p className="text-[#A89070] text-sm mt-1">
              Messages, matches, profile views and more.
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              className="shrink-0 rounded-xl border border-[#3D2B0E] px-3 py-2 text-[11px] font-bold text-[#C4832A] hover:bg-[#C4832A]/10 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {loadError && (
          <div
            className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 flex items-center justify-between gap-3"
            data-testid="notifications-error"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void refreshNotifications()}
              className="shrink-0 rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-bold text-red-100 hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <div
            data-testid="notifications-empty"
            className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] px-6 py-12 text-center shadow-card"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C4832A]/15 text-[#C4832A]">
              <IconNotifications size={28} />
            </div>
            <p className="text-[#F0E0C0] font-semibold">You are all caught up</p>
            <p className="text-[#A89070] text-sm mt-2 leading-relaxed">
              {loadError
                ? 'Alerts could not be loaded from the server.'
                : 'When someone messages you, matches with you, or views your profile, it will show up here.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2" data-testid="notifications-list">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => void handleOpen(notification)}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                    notification.read
                      ? 'border-[#3D2B0E] bg-[#1E1508]/70 hover:border-[#C4832A]/30'
                      : 'border-[#C4832A]/35 bg-[#1E1508] shadow-[0_0_0_1px_rgba(196,131,42,0.08)] hover:border-[#C4832A]/50'
                  }`}
                >
                  <div className="relative shrink-0">
                    {notification.userId ? (
                      <UserAvatar
                        name={notification.actorName ?? notification.message}
                        photoUrl={notification.actorPhotoUrl}
                        size="sm"
                        showStatus={false}
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C4832A]/15 text-[#C4832A]">
                        <TypeIcon type={notification.type} />
                      </div>
                    )}
                    {!notification.read && (
                      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#C4832A] ring-2 ring-[#1E1508]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#F0E0C0] leading-snug">
                        {notification.message}
                      </p>
                      <span className="shrink-0 text-[10px] font-medium text-[#A89070]">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    {notification.body && (
                      <p className="mt-1 text-xs text-[#A89070] line-clamp-2">{notification.body}</p>
                    )}
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#C4832A]/80">
                      {notificationTypeLabel(notification.type)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <NotificationSettings />
      </div>
    </Layout>
  );
};

function TypeIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'match':
      return <IconMatches size={18} />;
    case 'message':
    case 'photo':
    case 'voice':
      return <IconChat size={18} />;
    case 'missed_call':
      return <MissedCallIcon size={18} />;
    case 'profile_view':
      return <IconProfile size={18} />;
    default:
      return <IconNotifications size={18} />;
  }
}
