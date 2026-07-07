import React, { useEffect, useRef, useState } from 'react';
import { useNotificationStore, Notification } from '../hooks/store';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../api/client';
import { IconChat, IconMatches, IconNotifications, IconProfile } from './icons';
import { MissedCallIcon } from './MissedCallIcon';
import { notificationDestination } from '../lib/notifications';

export const ToastNotifications = () => {
  const { notifications, markAsRead, setUnreadCount } = useNotificationStore();
  const [activeToasts, setActiveToasts] = useState<Notification[]>([]);
  const navigate = useNavigate();
  const hydratedRef = useRef(false);
  const seenIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!hydratedRef.current) {
      notifications.forEach((n) => seenIdsRef.current.add(n.id));
      hydratedRef.current = true;
      return;
    }

    const newToasts = notifications.filter(
      (n) => !n.read && !seenIdsRef.current.has(n.id),
    );
    if (newToasts.length === 0) return;

    newToasts.forEach((n) => seenIdsRef.current.add(n.id));
    setActiveToasts((prev) => [...prev, ...newToasts]);

    newToasts.forEach((nt) => {
      window.setTimeout(() => {
        setActiveToasts((current) => current.filter((at) => at.id !== nt.id));
      }, 5000);
    });
  }, [notifications]);

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
    void persistRead(toast.id);
    setActiveToasts((current) => current.filter((at) => at.id !== toast.id));
    navigate(notificationDestination(toast));
  };

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[3000] flex flex-col gap-3 max-w-[320px] w-full pointer-events-none">
      {activeToasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => handleToastClick(toast)}
          className="pointer-events-auto cursor-pointer bg-[#1E1508]/95 backdrop-blur-md border border-[#3D2B0E] rounded-2xl p-4 shadow-2xl animate-slide-in-right hover:border-[#C4832A]/50 transition-all flex items-start gap-3 group"
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
            <p className="text-sm font-bold text-[#F0E0C0] leading-tight group-hover:text-[#C4832A] transition-colors">
              {toast.message}
            </p>
            {toast.body && (
              <p className="text-xs text-[#A89070] mt-1 line-clamp-2">{toast.body}</p>
            )}
            <p className="text-[10px] text-[#A89070] mt-1 uppercase tracking-wider font-semibold">
              Tap to open
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveToasts((current) => current.filter((at) => at.id !== toast.id));
            }}
            className="text-[#A89070]/40 hover:text-[#A89070] transition-colors p-1"
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
