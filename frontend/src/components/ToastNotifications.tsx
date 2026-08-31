import React, { useEffect } from 'react';
import { useNotificationStore, Notification } from '../hooks/store';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../api/client';
import { IconChat, IconMatches, IconNotifications, IconProfile } from './icons';
import { MissedCallIcon } from './MissedCallIcon';
import { notificationDestination } from '../lib/notifications';

/**
 * Live toast previews for notifications that arrive *after* the session has
 * already synced with the server. Login / refresh backfill stays badge-only —
 * users open the bell (`/notifications`) to read the list.
 */
export const ToastNotifications = () => {
  const pendingToasts = useNotificationStore((s) => s.pendingToasts);
  const dismissToast = useNotificationStore((s) => s.dismissToast);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const navigate = useNavigate();

  useEffect(() => {
    if (pendingToasts.length === 0) return;
    const timers = pendingToasts.map((nt) =>
      window.setTimeout(() => {
        dismissToast(nt.id);
      }, 5000),
    );
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [pendingToasts, dismissToast]);

  const persistRead = async (id: string) => {
    markAsRead(id);
    try {
      const res = await notificationsAPI.markRead(id);
      setUnreadCount(res.data.unread_count ?? 0);
    } catch {
      /* local state already updated */
    }
  };

  const handleToastClick = (toast: Notification) => {
    const dest = notificationDestination(toast);
    navigate(dest);
    dismissToast(toast.id);
    void persistRead(toast.id);
  };

  if (pendingToasts.length === 0) return null;

  return (
    <div
      data-testid="toast-notifications"
      className="fixed top-16 right-4 z-[3000] flex flex-col gap-3 max-w-[320px] w-full pointer-events-none"
    >
      {pendingToasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => handleToastClick(toast)}
          className="pointer-events-auto cursor-pointer bg-[var(--bg-card)]/95 backdrop-blur-md border border-[var(--border-default)] rounded-2xl p-4 shadow-2xl animate-slide-in-right hover:border-[#C4832A]/50 transition-all flex items-start gap-3 group"
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              toast.type === 'missed_call'
                ? 'bg-red-500/15 text-red-400'
                : toast.type === 'match'
                ? 'bg-[#C4832A]/20 text-[#C4832A]'
                : toast.type === 'like'
                  ? 'bg-[#A45E18]/20 text-[#C4832A]'
                  : toast.type === 'profile_view'
                    ? 'bg-[#C4832A]/15 text-[#C4832A]'
                    : 'bg-nn-online/20 text-[#8FC773]'
            }`}
          >
            <ToastIcon type={toast.type} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[var(--cream)] leading-tight group-hover:text-[#C4832A] transition-colors">
              {toast.message}
            </p>
            {toast.body && (
              <p className="text-xs text-[var(--cream-muted)] mt-1 line-clamp-2">{toast.body}</p>
            )}
            <p className="text-[10px] text-[var(--cream-muted)] mt-1 uppercase tracking-wider font-semibold">
              Tap to open
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              dismissToast(toast.id);
            }}
            className="text-[var(--cream-muted)]/40 hover:text-[var(--cream-muted)] transition-colors p-1"
            aria-label="Dismiss alert preview"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

function ToastIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'match':
      return <IconMatches size={20} />;
    case 'message':
    case 'photo':
    case 'voice':
      return <IconChat size={20} />;
    case 'missed_call':
      return <MissedCallIcon size={20} />;
    case 'profile_view':
      return <IconProfile size={20} />;
    case 'like':
      return <StarIcon className="w-5 h-5 fill-current" />;
    default:
      return <IconNotifications size={20} />;
  }
}

const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
