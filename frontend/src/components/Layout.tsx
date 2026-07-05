import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useNotificationStore, useUnreadStore } from '../hooks/store';
import { UserAvatar } from './UserAvatar';
import { mobileBackFallback, shouldShowMobileBack } from '../lib/mobileBack';
import { MobileBackButton } from './MobileBackButton';
import { IconNotifications } from './icons';
import { BrandMark } from './BrandMark';
import { ProfileSearchModal } from './ProfileSearchModal';
import { ProfileQrModal } from './ProfileQrModal';
import { NotificationDot } from './NotificationDot';
import { getNavItems, isNavActive, mobilePageTitle, type NavItem } from '../lib/navConfig';

interface LayoutProps {
  children: React.ReactNode;
}

function badgeFor(item: NavItem, unreadCount: number, notificationUnread: number): number {
  if (item.badgeKey === 'messages') return unreadCount;
  if (item.badgeKey === 'notifications') return notificationUnread;
  return 0;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const unreadCount = useUnreadStore((s) => s.count);
  const notificationUnread = useNotificationStore((s) => s.unreadCount);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const navItems = getNavItems();
  const mobileTabs = navItems.filter((item) => item.mobileTab);
  const desktopLinks = navItems.filter((item) => item.desktopNav);
  const showMobileBack = shouldShowMobileBack(location.pathname);
  const mobileBackTarget = mobileBackFallback(location.pathname);
  const pageTitle = mobilePageTitle(location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] lg:grid lg:grid-cols-[var(--desktop-sidebar-width)_minmax(0,1fr)]">
      {/* ── Desktop sidebar (web app) ── */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[var(--desktop-sidebar-width)] lg:border-r lg:border-[var(--border-default)] lg:bg-[#080604]">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5 border-b border-[var(--border-default)]/80">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <p className="font-display text-lg font-black tracking-[0.14em] text-[var(--cream)] leading-none">
              MENRUSH
            </p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--cream-muted)] mt-1">
              Desktop
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {desktopLinks.map((item) => {
            const active = isNavActive(location.pathname, item.to);
            const badge = badgeFor(item, unreadCount, notificationUnread);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 border ${
                  active
                    ? 'bg-[var(--copper)]/12 text-[var(--copper)] border-[var(--copper)]/35 shadow-[inset_3px_0_0_var(--copper)]'
                    : 'text-[var(--cream-soft)]/75 border-transparent hover:bg-[var(--bg-card)] hover:text-[var(--cream)] hover:border-[var(--border-default)]'
                }`}
              >
                <span className="relative inline-flex shrink-0">
                  <item.Icon size={20} />
                  <NotificationDot
                    count={badge}
                    visible={badge > 0}
                    data-testid={`badge-${item.to.replace(/\//g, '')}`}
                    className="-top-2 -right-2 min-w-[16px] h-4 text-[9px] bg-[var(--copper)] border-[#080604]"
                  />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-[var(--border-default)]/80 space-y-2">
          <div className="flex gap-2 px-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]/60 px-3 py-2.5 text-xs font-semibold text-[var(--cream-soft)] transition-colors hover:border-[var(--copper)]/40 hover:text-[var(--cream)]"
            >
              <SearchIcon className="w-4 h-4" />
              Search
            </button>
            <button
              type="button"
              onClick={() => setQrOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]/60 text-[var(--cream-soft)] transition-colors hover:border-[var(--copper)]/40 hover:text-[var(--cream)]"
              aria-label="Profile QR code"
            >
              <QrIcon className="w-4 h-4" />
            </button>
          </div>

          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]/40 px-3 py-3 transition-colors hover:border-[var(--copper)]/35"
          >
            <UserAvatar
              name={user?.name ?? '?'}
              photoUrl={user?.photo_url}
              size="sm"
              showStatus={false}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--cream)]">{user?.name ?? 'Account'}</p>
              <p className="text-[10px] text-[var(--cream-muted)]">View profile</p>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-3 py-2.5 text-xs font-semibold text-[var(--cream-muted)] transition-colors hover:border-[#8B4513]/40 hover:bg-[#8B4513]/10 hover:text-[var(--cream)]"
          >
            <LogoutIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex min-h-dvh min-w-0 flex-col lg:col-start-2">
        {/* Mobile app header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-default)] bg-[#0D0A06]/92 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
          <div className="flex h-[3.25rem] items-center gap-2 px-3">
            <div className="w-10 shrink-0">
              {showMobileBack ? (
                <MobileBackButton fallback={mobileBackTarget} className="-ml-1" />
              ) : (
                <Link to="/discover" aria-label="MenRush home" className="inline-flex">
                  <BrandMark size="sm" />
                </Link>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center">
              {location.pathname !== '/discover' && (
                <p className="truncate text-sm font-bold tracking-wide text-[var(--cream)]">{pageTitle}</p>
              )}
            </div>

            <div className="flex w-[4.5rem] shrink-0 items-center justify-end gap-0.5">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--cream-soft)] active:bg-[var(--bg-card)]"
                aria-label="Search profiles"
              >
                <SearchIcon className="w-5 h-5" />
              </button>
              <Link
                to="/notifications"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--cream-soft)] active:bg-[var(--bg-card)]"
                aria-label="Alerts"
              >
                <IconNotifications size={22} />
                <NotificationDot
                  count={notificationUnread}
                  visible={notificationUnread > 0}
                  className="-top-0.5 -right-0.5 min-w-[16px] h-4 text-[9px] bg-[var(--copper)] border-[#0D0A06]"
                />
              </Link>
            </div>
          </div>
        </header>

        {/* Desktop content header strip */}
        <div className="hidden lg:flex items-center justify-between gap-4 border-b border-[var(--border-default)]/70 bg-[var(--bg-primary)]/80 px-8 py-4 backdrop-blur-sm">
          <div>
            <p className="nn-overline mb-1">Workspace</p>
            <h1 className="text-xl font-bold text-[var(--cream)]">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--cream-muted)]">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--status-online)] shadow-[0_0_8px_var(--status-online-glow)]" />
            Live proximity
          </div>
        </div>

        <main className="flex-1 min-h-0 max-lg:pt-[var(--mobile-header-height)] max-lg:pb-[var(--mobile-tab-bar-height)] lg:pb-0">
          <div className="page-enter h-full min-h-0">{children}</div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2"
          aria-label="Primary"
        >
          <div className="flex items-stretch rounded-[1.35rem] border border-[var(--border-default)] bg-[#12100C]/95 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            {mobileTabs.map((item) => {
              const active = isNavActive(location.pathname, item.to);
              const badge = badgeFor(item, unreadCount, notificationUnread);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-all duration-200 first:rounded-l-[1.25rem] last:rounded-r-[1.25rem] ${
                    active
                      ? 'text-[var(--copper)] bg-[var(--copper)]/10'
                      : 'text-[var(--cream-muted)] active:scale-95'
                  }`}
                >
                  <span className="relative inline-flex">
                    <item.Icon size={22} className={active ? 'scale-110' : ''} />
                    <NotificationDot
                      count={badge}
                      visible={badge > 0}
                      data-testid={`badge-mobile-${item.to.replace(/\//g, '')}`}
                      className="-top-2 -right-2.5 min-w-[16px] h-[16px] text-[9px] bg-[var(--copper)] border-[#12100C]"
                    />
                  </span>
                  <span className="text-[9px] font-bold leading-none tracking-wide">
                    {item.shortLabel ?? item.label}
                  </span>
                  {active ? (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--copper)] shadow-[0_0_8px_var(--copper-glow-strong)]" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <ProfileSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ProfileQrModal open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
};

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
