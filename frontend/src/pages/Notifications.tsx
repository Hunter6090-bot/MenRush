import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { NotificationSettings } from '../components/NotificationSettings';
import { UserAvatar } from '../components/UserAvatar';
import { ProfilePhotoLink } from '../components/ProfilePhotoLink';
import { IconChat, IconClose, IconMatches, IconNotifications, IconProfile } from '../components/icons';
import { MissedCallIcon } from '../components/MissedCallIcon';
import {
  formatRelativeTime,
  notificationDestination,
  notificationTypeLabel,
} from '../lib/notifications';
import { refreshNotifications } from '../hooks/useNotificationSync';
import { useNotificationStore, type Notification } from '../hooks/store';

type Filter = 'unread' | 'all';

export const Notifications = () => {
  const navigate = useNavigate();
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const loadError = useNotificationStore((s) => s.loadError);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);
  const deleteAllRead = useNotificationStore((s) => s.deleteAllRead);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  // #74: badge-only on launch, tap opens this page; read items drop out of the
  // default (unread) view rather than piling up — "All" is one tap away, so
  // history isn't lost, just not the default.
  const [filter, setFilter] = useState<Filter>('unread');
  const readCount = notifications.length - unreadCount;
  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, filter],
  );

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

  const handleDelete = useCallback(
    async (event: React.MouseEvent, notification: Notification) => {
      event.stopPropagation();
      deleteNotification(notification.id);
      try {
        const res = await notificationsAPI.delete(notification.id);
        setUnreadCount(res.data.unread_count ?? 0);
      } catch {
        /* local state already updated */
      }
    },
    [deleteNotification, setUnreadCount],
  );

  const handleMarkAllRead = async () => {
    markAllAsRead();
    try {
      await notificationsAPI.markAllRead();
    } catch {
      /* ignore */
    }
  };

  const handleDeleteAllRead = async () => {
    deleteAllRead();
    try {
      await notificationsAPI.deleteAllRead();
    } catch {
      /* ignore */
    }
  };

  return (
    <Layout>
      <div className="mx-auto flex min-h-0 max-w-xl flex-col gap-4 px-4 py-4 pb-10 lg:max-w-6xl lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start lg:gap-8 lg:px-8 lg:py-8">
        <div className="flex items-start justify-between gap-3 lg:col-span-2 lg:hidden">
          <div>
            <h1 className="text-2xl font-bold text-[var(--cream)]">Notifications</h1>
            <p className="mt-1 text-sm text-[var(--cream-muted)]">
              Messages, matches, profile views and more.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-[11px] font-bold text-[#C4832A] transition-colors hover:bg-[#C4832A]/10"
              >
                Mark all read
              </button>
            )}
            {readCount > 0 && (
              <button
                type="button"
                onClick={() => void handleDeleteAllRead()}
                className="rounded-xl px-3 py-1 text-[11px] font-semibold text-[var(--cream-muted)] hover:text-[var(--cream)]"
              >
                Delete read
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-start-1 lg:row-start-1">
          <div className="hidden items-center justify-between gap-3 lg:flex">
            <div>
              <p className="nn-overline mb-1">Activity</p>
              <p className="text-sm text-[var(--cream-muted)]">Recent alerts from your network.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {readCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleDeleteAllRead()}
                  className="rounded-xl px-3 py-2 text-[11px] font-semibold text-[var(--cream-muted)] hover:text-[var(--cream)]"
                >
                  Delete read
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleMarkAllRead()}
                  className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-[11px] font-bold text-[#C4832A] transition-colors hover:bg-[#C4832A]/10"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* #74: default view is unread-only — read items drop out here rather than
              accumulating; "All" is one tap away so history isn't lost. */}
          <div className="flex gap-1.5" role="tablist" aria-label="Filter notifications">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'unread'}
              data-testid="notifications-filter-unread"
              onClick={() => setFilter('unread')}
              className={
                filter === 'unread'
                  ? 'mr-pill mr-pill-active'
                  : 'mr-pill mr-pill-inactive'
              }
            >
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              data-testid="notifications-filter-all"
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'mr-pill mr-pill-active' : 'mr-pill mr-pill-inactive'}
            >
              All
            </button>
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

        {visibleNotifications.length === 0 ? (
          <div
            data-testid="notifications-empty"
            className="rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.06)] px-6 py-12 text-center shadow-card"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#C4832A]/15 text-[#C4832A]">
              <IconNotifications size={28} />
            </div>
            <p className="text-[var(--cream)] font-extrabold">
              {loadError
                ? 'Could not load alerts'
                : filter === 'unread' && notifications.length > 0
                  ? "You're all caught up"
                  : 'No alerts yet'}
            </p>
            <p className="text-[var(--cream-muted)] text-sm mt-2 leading-relaxed mx-auto max-w-sm">
              {loadError
                ? 'Pull to refresh or try again shortly.'
                : filter === 'unread' && notifications.length > 0
                  ? 'No unread alerts. Switch to All to see your history.'
                  : 'Matches, messages, and profile views land here. Get seen on Nearby or the live list.'}
            </p>
            {filter === 'unread' && notifications.length > 0 && !loadError ? (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="mt-4 rounded-full border border-[rgba(196,131,42,0.5)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
              >
                View all
              </button>
            ) : null}
            {!loadError && notifications.length === 0 ? (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/discover"
                  className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
                >
                  Nearby map
                </Link>
                <Link
                  to="/stream"
                  className="rounded-full border border-[rgba(196,131,42,0.5)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
                >
                  Live list
                </Link>
                <Link
                  to="/matches"
                  className="rounded-full border border-[rgba(196,131,42,0.5)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
                >
                  Matches
                </Link>
              </div>
            ) : null}
            {notifications.length === 0 ? (
              <p className="mt-4 text-[11px] font-medium tracking-wide text-[var(--cream-muted)]">
                · Report abuse anytime
              </p>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-2" data-testid="notifications-list">
            {visibleNotifications.map((notification) => (
              <li key={notification.id} className="group relative">
                <div
                  className={`flex w-full items-start gap-3 rounded-2xl border py-3.5 pl-4 pr-11 text-left transition-colors ${
                    notification.read
                      ? 'border-[var(--border-default)] bg-[var(--bg-card)]/70 hover:border-[#C4832A]/30'
                      : 'border-[#C4832A]/35 bg-[var(--bg-card)] shadow-[0_0_0_1px_rgba(196,131,42,0.08)] hover:border-[#C4832A]/50'
                  }`}
                >
                  <div className="relative shrink-0">
                    {notification.userId ? (
                      <ProfilePhotoLink
                        userId={notification.userId}
                        name={notification.actorName ?? notification.message}
                        data-testid={`notification-avatar-${notification.userId}`}
                      >
                        <UserAvatar
                          name={notification.actorName ?? notification.message}
                          photoUrl={notification.actorPhotoUrl}
                          userId={notification.userId}
                          linkToProfile={false}
                          size="sm"
                          showStatus={false}
                        />
                      </ProfilePhotoLink>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C4832A]/15 text-[#C4832A]">
                        <TypeIcon type={notification.type} />
                      </div>
                    )}
                    {!notification.read && (
                      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#C4832A] ring-2 ring-[var(--bg-card)]" />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleOpen(notification)}
                    className="min-w-0 flex-1 text-left"
                    data-testid={`notification-open-${notification.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--cream)] leading-snug">
                        {notification.message}
                      </p>
                      <span className="shrink-0 text-[10px] font-medium text-[var(--cream-muted)]">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    {notification.body && (
                      <p className="mt-1 text-xs text-[var(--cream-muted)] line-clamp-2">{notification.body}</p>
                    )}
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#C4832A]/80">
                      {notificationTypeLabel(notification.type)}
                    </p>
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Delete notification"
                  data-testid={`notification-delete-${notification.id}`}
                  onClick={(e) => void handleDelete(e, notification)}
                  className="absolute right-2.5 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[var(--cream-muted)] opacity-60 transition-opacity hover:bg-[var(--bg-elevated)] hover:text-[var(--cream)] hover:opacity-100 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                >
                  <IconClose size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        </div>

        <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6">
          <NotificationSettings />
        </aside>
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
