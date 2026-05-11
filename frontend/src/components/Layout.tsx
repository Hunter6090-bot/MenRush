import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useUnreadStore, useNotificationStore } from '../hooks/store';
import { useSocket } from '../hooks/useSocket';
import { UserAvatar } from './UserAvatar';
import { ToastNotifications } from './ToastNotifications';
import { FEATURES } from '../lib/featureFlags';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { count: unreadCount, addUnread } = useUnreadStore();
  const { addNotification } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();

  // Listen for incoming messages and notifications
  useEffect(() => {
    if (!socket) return;

    const onMessage = (data: any) => {
      const isViewingConversation = location.pathname === `/messages/${data.sender_id}`;
      if (!isViewingConversation) {
        addUnread(data.sender_id);
        addNotification({
          type: 'message',
          message: `New message from ${data.sender_name || 'someone'}`,
          userId: data.sender_id,
        });
      }
    };

    const onNotification = (data: any) => {
      addNotification({
        type: data.type,
        message: data.message,
        userId: data.userId,
      });
    };

    socket.on('message', onMessage);
    socket.on('notification', onNotification);

    return () => {
      socket.off('message', onMessage);
      socket.off('notification', onNotification);
    };
  }, [socket, location.pathname, addUnread, addNotification]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/discover', label: 'Discover', icon: CompassIcon, badge: 0 },
    { to: '/matches', label: 'Matches', icon: HeartIcon, badge: 0 },
    { to: '/conversations', label: 'Messages', icon: ChatIcon, badge: unreadCount },
    { to: '/profile', label: 'Profile', icon: PersonIcon, badge: 0 },
  ];
  if (FEATURES.chatRooms) {
    navLinks.splice(3, 0, { to: '/rooms', label: 'Rooms', icon: RoomsNavIcon, badge: 0 });
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-dvh bg-[#0D0A06] flex flex-col">
      {/* ── Top header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center relative overflow-visible px-4 bg-[#0D0A06]/85 backdrop-blur-xl border-b border-[#3D2B0E]">
        {/* Compact brand mark — small in-bar logo (no oversized pendant on internal pages) */}
        <Link
          to="/discover"
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-50 hover:opacity-80 transition-opacity"
          aria-label="MenRush home"
        >
          <img src="/logo.png" alt="MenRush" className="w-6 h-6 rounded-full" />
        </Link>

        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          {/* Left spacer to balance the coin (desktop) */}
          <div className="hidden sm:block w-10" />

          {/* Desktop nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon, badge }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(to)
                    ? 'bg-[#C4832A]/15 text-[#C4832A]'
                    : 'text-[#F0E0C0]/55 hover:text-[#F0E0C0] hover:bg-[#3D2B0E]/40'
                }`}
              >
                <span className="relative">
                  <Icon className="w-4 h-4" />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-[#8B4513] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </nav>

          {/* Avatar + logout */}
          <div className="flex items-center gap-3">
            <Link to="/profile" className="flex items-center gap-2 group">
              <UserAvatar
                name={user?.name ?? '?'}
                photoUrl={user?.photo_url}
                size="xs"
                showStatus={false}
                className="group-hover:ring-2 group-hover:ring-[#C4832A]/50 rounded-full transition-all"
              />
            </Link>
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#F0E0C0]/40 hover:text-[#8B4513] hover:bg-[#8B4513]/10 transition-all duration-200"
            >
              <LogoutIcon className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 pt-16 pb-16 sm:pb-0">
        <div className="page-enter">{children}</div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0D0A06]/90 backdrop-blur-xl border-t border-[#3D2B0E] safe-area-inset-bottom">
        <div className="flex items-stretch h-16">
          {navLinks.map(({ to, label, icon: Icon, badge }) => (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center font-medium transition-all duration-200 ${
                isActive(to)
                  ? 'text-[#C4832A]'
                  : 'text-[#F0E0C0]/35 hover:text-[#F0E0C0]/70'
              }`}
            >
              <span className="relative">
                <Icon className={`w-6 h-6 transition-transform duration-200 ${isActive(to) ? 'scale-110' : ''}`} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-[#8B4513] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </nav>
      <ToastNotifications />
    </div>
  );
};

/* ── Icons ── */
const CompassIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" />
  </svg>
);

const HeartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const ChatIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const PersonIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const RoomsNavIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);
