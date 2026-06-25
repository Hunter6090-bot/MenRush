import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useUnreadStore } from '../hooks/store';
import { UserAvatar } from './UserAvatar';
import { FEATURES } from '../lib/featureFlags';
import { IconChat, IconDiscover, IconMatches, IconProfile, IconRooms } from './icons';
import { BRAND_LOGO_ORIGINAL } from '../lib/brand';
import { ProfileSearchModal } from './ProfileSearchModal';
import { ProfileQrModal } from './ProfileQrModal';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const unreadCount = useUnreadStore((s) => s.count);
  const location = useLocation();
  const navigate = useNavigate();
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const brandMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!brandMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!brandMenuRef.current?.contains(event.target as Node)) {
        setBrandMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBrandMenuOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [brandMenuOpen]);

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
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {/* Original brand medallion — quick menu */}
          <div ref={brandMenuRef} className="relative flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setBrandMenuOpen((open) => !open)}
              className="flex items-center rounded-full hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/55 focus:ring-offset-2 focus:ring-offset-[#0D0A06] transition-opacity"
              aria-label="Open MenRush menu"
              aria-haspopup="menu"
              aria-expanded={brandMenuOpen}
            >
              <img
                src={BRAND_LOGO_ORIGINAL}
                alt="MenRush"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover ring-1 ring-[#C4832A]/25 shadow-[0_2px_14px_rgba(196,131,42,0.22)]"
                draggable={false}
              />
            </button>

            {brandMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-11 w-44 overflow-hidden rounded-xl border border-[#3D2B0E] bg-[#0D0A06]/95 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              >
                <Link
                  to="/discover"
                  role="menuitem"
                  onClick={() => setBrandMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#F0E0C0]/78 transition-colors hover:bg-[#3D2B0E]/55 hover:text-[#F0E0C0]"
                >
                  <IconHome size={16} />
                  Home
                </Link>
                <Link
                  to="/discover"
                  role="menuitem"
                  onClick={() => setBrandMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#F0E0C0]/78 transition-colors hover:bg-[#3D2B0E]/55 hover:text-[#F0E0C0]"
                >
                  <IconDiscover size={16} />
                  Nearby
                </Link>
                <Link
                  to="/profile"
                  role="menuitem"
                  onClick={() => setBrandMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#F0E0C0]/78 transition-colors hover:bg-[#3D2B0E]/55 hover:text-[#F0E0C0]"
                >
                  <IconProfile size={16} />
                  Profile
                </Link>
              </div>
            )}
          </div>

          {user && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#F0E0C0]/55 transition-colors hover:bg-[#3D2B0E]/40 hover:text-[#F0E0C0]"
                aria-label="Search profiles"
              >
                <SearchIcon className="w-[18px] h-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#F0E0C0]/55 transition-colors hover:bg-[#3D2B0E]/40 hover:text-[#F0E0C0]"
                aria-label="Profile QR code"
              >
                <QrIcon className="w-[18px] h-[18px]" />
              </button>
            </div>
          )}
          </div>

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
                    <span
                      data-testid={`badge-${to.replace(/\//g, '')}`}
                      className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-[#8B4513] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5"
                    >
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
                  <span
                    data-testid={`badge-mobile-${to.replace(/\//g, '')}`}
                    className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-[#8B4513] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5"
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className="mt-1 text-[10px] font-bold leading-none">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <ProfileSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ProfileQrModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
};

const IconHome = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
  </svg>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
  </svg>
);

const QrIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h2m2 0h2m-4 2v2m0-4v2m4-2v2" />
  </svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);
