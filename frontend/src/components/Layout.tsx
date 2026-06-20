import React, { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useUnreadStore, useNotificationStore } from '../hooks/store';
import { useSocket } from '../hooks/useSocket';
import { UserAvatar } from './UserAvatar';
import { ToastNotifications } from './ToastNotifications';
import { FEATURES } from '../lib/featureFlags';
import { IconChat, IconDiscover, IconMatches, IconProfile, IconRooms } from './icons';
import { BRAND_LOGO_ORIGINAL } from '../lib/brand';

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
    { to: '/discover', label: 'Nearby', Icon: IconDiscover, badge: 0 },
    { to: '/matches', label: 'Matches', Icon: IconMatches, badge: 0 },
    { to: '/conversations', label: 'Messages', Icon: IconChat, badge: unreadCount },
    { to: '/profile', label: 'Profile', Icon: IconProfile, badge: 0 },
  ];
  if (FEATURES.chatRooms) {
    navLinks.splice(3, 0, { to: '/rooms', label: 'Rooms', Icon: IconRooms, badge: 0 });
  }

  const isActive = (path: string) => {
    if (path === '/conversations') {
      return (
        location.pathname === '/conversations' ||
        location.pathname.startsWith('/conversations/') ||
        location.pathname.startsWith('/messages/')
      );
    }
    // Only "your" profile — /profile/:id is someone else's view
    if (path === '/profile') {
      return location.pathname === '/profile';
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="min-h-dvh bg-[#0D0A06] flex flex-col">
      {/* ── Top header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 bg-[#0D0A06]/85 backdrop-blur-xl border-b border-[#3D2B0E]">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between gap-3">
          {/* Original brand medallion — home */}
          <Link
            to="/discover"
            className="flex shrink-0 items-center hover:opacity-85 transition-opacity"
            aria-label="MenRush home"
          >
            <img
              src={BRAND_LOGO_ORIGINAL}
              alt="MenRush"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-1 ring-[#C4832A]/25 shadow-[0_2px_14px_rgba(196,131,42,0.22)]"
              draggable={false}
            />
          </Link>

          {/* Desktop nav — centered in remaining space */}
          <nav className="hidden sm:flex flex-1 items-center justify-center gap-1 min-w-0">
            {navLinks.map(({ to, label, Icon, badge }) => (
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
                  <Icon size={16} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-[#8B4513] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="hidden md:inline">{label}</span>
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
      <main className="flex-1 pt-16 pb-[var(--mobile-tab-bar-height)] sm:pb-0">
        <div className="page-enter">{children}</div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0D0A06]/90 backdrop-blur-xl border-t border-[#3D2B0E] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-stretch h-16">
          {navLinks.map(({ to, label, Icon, badge }) => (
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
                <Icon size={24} className={`transition-transform duration-200 ${isActive(to) ? 'scale-110' : ''}`} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-[#8B4513] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className="mt-1 text-[10px] font-bold leading-none">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
      <ToastNotifications />
    </div>
  );
};

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
