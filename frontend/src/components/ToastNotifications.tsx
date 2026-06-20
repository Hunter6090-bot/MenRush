import React, { useEffect, useState } from 'react';
import { useNotificationStore, Notification } from '../hooks/store';
import { useNavigate } from 'react-router-dom';
import { IconChat, IconMatches } from './icons';

export const ToastNotifications = () => {
  const { notifications, markAsRead } = useNotificationStore();
  const [activeToasts, setActiveToasts] = useState<Notification[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Show new, unread notifications that aren't already in activeToasts
    const unread = notifications.filter(n => !n.read);
    const newToasts = unread.filter(u => !activeToasts.find(at => at.id === u.id));
    
    if (newToasts.length > 0) {
      setActiveToasts(prev => [...prev, ...newToasts]);
      
      // Auto-remove toasts after 5 seconds
      newToasts.forEach(nt => {
        setTimeout(() => {
          setActiveToasts(current => current.filter(at => at.id !== nt.id));
          markAsRead(nt.id);
        }, 5000);
      });
    }
  }, [notifications, activeToasts, markAsRead]);

  const handleToastClick = (toast: Notification) => {
    markAsRead(toast.id);
    setActiveToasts(current => current.filter(at => at.id !== toast.id));
    
    if (toast.type === 'match' || toast.type === 'message') {
      if (toast.userId) navigate(`/messages/${toast.userId}`);
    } else if (toast.type === 'like') {
      navigate('/matches');
    }
  };

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[3000] flex flex-col gap-3 max-w-[320px] w-full pointer-events-none">
      {activeToasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => handleToastClick(toast)}
          className="pointer-events-auto cursor-pointer bg-[#1E1508]/95 backdrop-blur-md border border-[#3D2B0E] rounded-2xl p-4 shadow-2xl animate-slide-in-right hover:border-[#C4832A]/50 transition-all flex items-start gap-3 group"
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            toast.type === 'match' ? 'bg-[#C4832A]/20 text-[#C4832A]' :
            toast.type === 'like' ? 'bg-[#8B4513]/20 text-[#C4832A]' :
            'bg-nn-online/20 text-[#8FC773]'
          }`}>
            {toast.type === 'match' && <IconMatches size={20} />}
            {toast.type === 'like' && <StarIcon className="w-5 h-5 fill-current" />}
            {toast.type === 'message' && <IconChat size={20} />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#F0E0C0] leading-tight group-hover:text-[#C4832A] transition-colors">
              {toast.message}
            </p>
            <p className="text-[10px] text-[#A89070] mt-1 uppercase tracking-wider font-semibold">
              {toast.type} · Click to view
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveToasts(current => current.filter(at => at.id !== toast.id));
              markAsRead(toast.id);
            }}
            className="text-[#A89070]/40 hover:text-[#A89070] transition-colors p-1"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

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
