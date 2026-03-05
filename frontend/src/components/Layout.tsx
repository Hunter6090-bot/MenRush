import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/store';
import { UserAvatar } from './UserAvatar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/discover', label: 'Discover', icon: CompassIcon },
    { to: '/conversations', label: 'Messages', icon: ChatIcon },
    { to: '/profile', label: 'Profile', icon: PersonIcon },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-dvh bg-[#0F1115] flex flex-col">
      {/* ── Top header ── */}
      <header className="fixed top-0 left-0 right-0 z-30 h-14 flex items-center px-4 bg-[#0F1115]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          {/* Wordmark */}
          <Link
            to="/discover"
            className="text-lg font-black tracking-tight text-[#F2F4F8] hover:text-[#4F8CFF] transition-colors"
          >
            Near<span className="text-[#4F8CFF]">&</span>Now
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(to)
                    ? 'bg-[#4F8CFF]/15 text-[#4F8CFF]'
                    : 'text-[#F2F4F8]/55 hover:text-[#F2F4F8] hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
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
                className="group-hover:ring-2 group-hover:ring-[#4F8CFF]/50 rounded-full transition-all"
              />
            </Link>
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#F2F4F8]/40 hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 transition-all duration-200"
            >
              <LogoutIcon className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 pt-14 pb-16 sm:pb-0">
        <div className="page-enter">{children}</div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#0F1115]/85 backdrop-blur-xl border-t border-white/[0.06] safe-area-inset-bottom">
        <div className="flex items-stretch h-16">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all duration-200 ${
                isActive(to)
                  ? 'text-[#4F8CFF]'
                  : 'text-[#F2F4F8]/35 hover:text-[#F2F4F8]/70'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive(to) ? 'scale-110' : ''}`} />
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-[#F2F4F8]/30 hover:text-[#FF6B6B] transition-colors"
          >
            <LogoutIcon className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </nav>
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
