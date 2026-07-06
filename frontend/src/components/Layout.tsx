import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useAuthStore, useNotificationStore, useUnreadStore } from '../hooks/store';
import { UserAvatar } from './UserAvatar';
import { mobileBackFallback, shouldShowMobileBack } from '../lib/mobileBack';
import { MobileBackButton } from './MobileBackButton';
import { IconNotifications, IconPulse } from './icons';
import { BrandMark } from './BrandMark';
import { ProfileSearchModal } from './ProfileSearchModal';
import { NotificationDot } from './NotificationDot';
import { MenRushPlusPromo } from './MenRushPlusPromo';
import { getNavItems, isNavActive, mobilePageTitle, type NavItem } from '../lib/navConfig';
import { DiscoveryShellProvider, useDiscoveryShell } from '../context/DiscoveryShellContext';

interface LayoutProps {
  children: React.ReactNode;
}

function badgeFor(
  item: NavItem,
  unreadCount: number,
  notificationUnread: number,
  matchCount: number,
): number {
  if (item.badgeKey === 'messages') return unreadCount;
  if (item.badgeKey === 'notifications') return notificationUnread;
  if (item.badgeKey === 'matches') return matchCount;
  return 0;
}

function LayoutInner({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const unreadCount = useUnreadStore((s) => s.count);
  const notificationUnread = useNotificationStore((s) => s.unreadCount);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const { state: discoveryShell } = useDiscoveryShell();

  useEffect(() => {
    usersAPI
      .getMatches()
      .then((res) => setMatchCount(res.data?.length ?? 0))
      .catch(() => setMatchCount(0));
  }, [location.pathname]);

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
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[var(--desktop-sidebar-width)] lg:border-r lg:border-[var(--border-default)] lg:bg-[#080604]">
        <div className="flex items-center gap-2.5 px-3.5 pt-5 pb-4">
          <BrandMark size="sm" />
          <p className="font-display text-sm font-black tracking-[0.14em] text-[var(--cream)]">MENRUSH</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {desktopLinks.map((item) => {
            const active = isNavActive(location.pathname, item.to);
            const badge = badgeFor(item, unreadCount, notificationUnread, matchCount);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 rounded-[14px] px-3 py-3 text-[15px] font-bold transition-all duration-200 ${
                  active
                    ? 'bg-[rgba(196,131,42,0.12)] text-[#E0A14A]'
                    : 'text-[var(--cream-soft)]/75 hover:bg-[var(--bg-card)] hover:text-[var(--cream)]'
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
                <span className="truncate flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-2.5 py-4 border-t border-[var(--border-default)]/80">
          <MenRushPlusPromo />
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 w-full rounded-[14px] px-3 py-3 text-left text-sm font-semibold text-[#6B5840] transition-colors hover:bg-[var(--bg-card)] hover:text-[#B0432E]"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col lg:col-start-2">
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

        <div className="hidden lg:flex h-[var(--desktop-workspace-header)] shrink-0 items-center gap-3.5 border-b border-[var(--border-default)] bg-[var(--bg-primary)] px-6">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex max-w-[420px] flex-1 items-center gap-2.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2.5 text-left transition-colors hover:border-[var(--copper)]/40"
          >
            <SearchIcon className="h-4 w-4 shrink-0 text-[var(--cream-muted)]" />
            <span className="text-sm text-[var(--cream-muted)]">Search by name</span>
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-[13px] text-[var(--cream-muted)]">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--status-online)]" />
            {discoveryShell.nearbyCount} in your radius
          </div>
          <button
            type="button"
            onClick={() => {
              if (discoveryShell.togglePulse) discoveryShell.togglePulse();
              else navigate('/discover');
            }}
            title="Toggle pulse visibility"
            className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all ${
              discoveryShell.pulseOn
                ? 'bg-[var(--copper)] text-[#1A0E03] shadow-[0_0_18px_rgba(196,131,42,0.45)]'
                : 'border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--copper)]'
            }`}
          >
            {discoveryShell.pulseOn ? (
              <span className="mr-radar-ring pointer-events-none absolute inset-0" aria-hidden />
            ) : null}
            <IconPulse size={20} className="relative z-[1]" />
          </button>
          <Link to="/profile" className="shrink-0">
            <UserAvatar
              name={user?.name ?? '?'}
              photoUrl={user?.photo_url}
              size="sm"
              showStatus={false}
              className="ring-2 ring-[var(--copper)]"
            />
          </Link>
        </div>

        <main className="flex-1 min-h-0 max-lg:pt-[var(--mobile-header-height)] max-lg:pb-[var(--mobile-tab-bar-height)] lg:pb-0">
          <div className="page-enter h-full min-h-0">{children}</div>
        </main>

        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2"
          aria-label="Primary"
        >
          <div className="flex items-stretch rounded-[1.35rem] border border-[var(--border-default)] bg-[#12100C]/95 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            {mobileTabs.map((item) => {
              const active = isNavActive(location.pathname, item.to);
              const badge = badgeFor(item, unreadCount, notificationUnread, matchCount);
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
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      <ProfileSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export const Layout: React.FC<LayoutProps> = ({ children }) => (
  <DiscoveryShellProvider>
    <LayoutInner>{children}</LayoutInner>
  </DiscoveryShellProvider>
);

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
  </svg>
);
