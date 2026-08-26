import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useAuthStore, useNotificationStore, useUnreadStore } from '../hooks/store';
import { UserAvatar } from './UserAvatar';
import { mobileBackFallback, shouldShowMobileBack } from '../lib/mobileBack';
import { MobileBackButton } from './MobileBackButton';
import { IconMapExpand, IconMore, IconNotifications, IconPulse, IconSignOut } from './icons';
import { BrandMark } from './BrandMark';
import { ProfileSearchModal } from './ProfileSearchModal';
import { NotificationDot } from './NotificationDot';
import { MenRushPlusPromo } from './MenRushPlusPromo';
import { getNavItems, isNavActive, mobilePageTitle, type NavItem } from '../lib/navConfig';
import { DiscoveryShellProvider, useDiscoveryShell } from '../context/DiscoveryShellContext';
import { LocationPresenceStrip } from './LocationPresenceStrip';
import { ProfileDepthStrip } from './ProfileDepthStrip';
import { ThemeToggle } from './ThemeToggle';

interface LayoutProps {
  children: React.ReactNode;
}

const SIDEBAR_EXPANDED_KEY = 'menrush_desktop_sidebar_expanded';

function readSidebarExpanded(): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    /* ignore */
  }
  // NordVPN-style: start icon-only; expand when you want labels.
  return false;
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [sidebarExpanded, setSidebarExpanded] = useState(readSidebarExpanded);
  const { state: discoveryShell } = useDiscoveryShell();

  useEffect(() => {
    usersAPI
      .getMatches()
      .then((res) => setMatchCount(res.data?.length ?? 0))
      .catch(() => setMatchCount(0));
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, sidebarExpanded ? '1' : '0');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent('menrush:shell-resize'));
  }, [sidebarExpanded]);

  const navItems = getNavItems();
  const mobileTabs = navItems.filter((item) => item.mobileTab);
  const desktopLinks = navItems.filter((item) => item.desktopNav);
  const mobileMoreItems = navItems.filter((item) => item.mobileMore);
  const isMoreActive = mobileMoreItems.some((item) => isNavActive(location.pathname, item.to));
  const showMobileBack = shouldShowMobileBack(location.pathname);
  const mobileBackTarget = mobileBackFallback(location.pathname);
  const pageTitle = mobilePageTitle(location.pathname);

  useEffect(() => {
    setMoreMenuOpen(false);
  }, [location.pathname]);

  const requestSignOut = () => {
    setSignOutConfirmOpen(true);
  };

  const confirmSignOut = () => {
    setSignOutConfirmOpen(false);
    logout();
    navigate('/login');
  };

  const sidebarWidth = sidebarExpanded
    ? 'var(--desktop-sidebar-width-expanded)'
    : 'var(--desktop-sidebar-width-collapsed)';

  return (
    <div
      className="min-h-dvh bg-[var(--bg-primary)] lg:grid lg:grid-cols-[var(--desktop-sidebar-width)_minmax(0,1fr)]"
      style={{ ['--desktop-sidebar-width' as string]: sidebarWidth }}
      data-sidebar={sidebarExpanded ? 'expanded' : 'collapsed'}
    >
      <aside
        className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:border-r lg:border-[var(--border-default)] lg:bg-nn-bg lg:py-5 transition-[width] duration-300 ease-[var(--ease-out)] ${
          sidebarExpanded
            ? 'lg:w-[var(--desktop-sidebar-width-expanded)] lg:px-3.5'
            : 'lg:w-[var(--desktop-sidebar-width-collapsed)] lg:px-2'
        }`}
      >
        <div
          className={`mb-4 flex items-center ${
            sidebarExpanded ? 'justify-between gap-2 px-1' : 'flex-col gap-2'
          }`}
        >
          <Link
            to="/discover"
            aria-label="MenRush home — Nearby"
            title="MenRush"
            className={`flex items-center rounded-xl py-1 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--copper)] ${
              sidebarExpanded ? 'gap-2.5 px-1' : 'justify-center'
            }`}
          >
            <BrandMark size="sm" className="shadow-[0_0_0_2px_rgba(196,131,42,0.4)] rounded-full" />
            {sidebarExpanded ? (
              <span className="font-display text-sm font-black tracking-[0.14em] text-nn-text">
                MENRUSH
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setSidebarExpanded((v) => !v)}
            aria-label={sidebarExpanded ? 'Collapse navigation' : 'Expand navigation'}
            aria-expanded={sidebarExpanded}
            data-testid="desktop-sidebar-toggle"
            title={sidebarExpanded ? 'Collapse' : 'Show labels'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-nn-border bg-nn-card text-nn-muted transition-colors hover:border-nn-copper/45 hover:text-nn-copper-bright"
          >
            <IconMapExpand size={16} collapse={sidebarExpanded} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1">
          {desktopLinks.map((item) => {
            const active = isNavActive(location.pathname, item.to);
            const badge = badgeFor(item, unreadCount, notificationUnread, matchCount);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                className={`group flex items-center rounded-[14px] text-[15px] font-bold transition-all duration-200 ${
                  sidebarExpanded ? 'gap-3 px-3 py-3' : 'justify-center px-2 py-3'
                } ${
                  active
                    ? 'bg-[rgba(196,131,42,0.14)] text-nn-copper-bright'
                    : 'text-nn-muted hover:bg-nn-card hover:text-nn-text'
                }`}
              >
                <span className="relative inline-flex shrink-0">
                  <item.Icon size={22} />
                  {badge > 0 ? (
                    <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-nn-copper px-1 text-[10px] font-bold text-nn-on-copper">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
                </span>
                {sidebarExpanded ? <span className="truncate flex-1">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className={`mt-auto border-t border-nn-border pt-4 ${sidebarExpanded ? '' : 'px-0'}`}>
          <MenRushPlusPromo compact={!sidebarExpanded} />
          {sidebarExpanded ? (
            <button
              type="button"
              onClick={requestSignOut}
              data-testid="desktop-sign-out"
              title="Sign out"
              aria-label="Sign out"
              className="mt-3 flex w-full items-center gap-2.5 px-1 py-2 text-left text-sm text-nn-faint transition-colors hover:text-nn-danger"
            >
              <IconSignOut size={18} className="shrink-0" />
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={requestSignOut}
              data-testid="desktop-sign-out"
              title="Sign out"
              aria-label="Sign out"
              className="mt-3 mx-auto flex w-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-nn-faint transition-colors hover:bg-nn-card hover:text-nn-danger"
            >
              <IconSignOut size={18} />
              <span className="text-[9px] font-bold uppercase tracking-wide" aria-hidden>
                Out
              </span>
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col lg:col-start-2">
        <header className="lg:hidden fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-primary)_92%,transparent)] backdrop-blur-xl pt-[env(safe-area-inset-top,0px)]">
          <div className="flex h-[3.25rem] items-center gap-2 px-3">
            <div className="w-10 shrink-0">
              {showMobileBack ? (
                <MobileBackButton fallback={mobileBackTarget} className="-ml-1" />
              ) : (
                <span className="block w-10" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 text-center">
              {location.pathname === '/discover' ? (
                <Link
                  to="/discover"
                  aria-label="MenRush home"
                  className="inline-flex items-center justify-center gap-2"
                >
                  <BrandMark size="sm" className="shadow-[0_0_0_2px_rgba(196,131,42,0.35)] rounded-full" />
                  <span className="font-display text-xs font-black tracking-[0.16em] text-[var(--cream)]">
                    MENRUSH
                  </span>
                </Link>
              ) : (
                <p className="truncate text-sm font-bold tracking-wide text-[var(--cream)]">{pageTitle}</p>
              )}
            </div>
            <div className="flex min-w-[7.75rem] shrink-0 items-center justify-end gap-0.5">
              <ThemeToggle variant="header" />
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
                  data-testid="badge-notifications"
                  className="-top-0.5 -right-0.5 min-w-[16px] h-4 text-[9px] bg-[var(--copper)] border-[var(--bg-primary)]"
                />
              </Link>
            </div>
          </div>
        </header>

        <div className="hidden lg:flex h-16 shrink-0 items-center gap-3.5 border-b border-nn-border bg-nn-bg px-6">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex max-w-[520px] flex-1 items-center gap-2.5 rounded-full border border-nn-border bg-nn-card px-4 py-2.5 text-left transition-colors hover:border-nn-copper/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--copper)]"
          >
            <SearchIcon className="h-4 w-4 shrink-0 text-nn-muted" />
            <span className="text-sm text-nn-muted">Search profiles</span>
          </button>
          <div className="flex-1" />
          <ThemeToggle variant="header" className="text-nn-muted hover:text-nn-copper" />
          <div className="flex items-center gap-2 text-[13px] text-nn-muted">
            <span className="inline-flex h-2 w-2 rounded-full bg-nn-online" />
            {discoveryShell.nearbyCount} in your radius
          </div>
          <button
            type="button"
            onClick={() => {
              if (discoveryShell.togglePulse) discoveryShell.togglePulse();
              else navigate('/discover');
            }}
            title="Toggle pulse visibility"
            aria-pressed={discoveryShell.pulseOn}
            className={`relative flex h-[46px] w-[46px] items-center justify-center rounded-full transition-all ${
              discoveryShell.pulseOn
                ? 'mr-cta-gradient text-[#FFF6E6] shadow-[0_0_24px_rgba(196,131,42,0.5)]'
                : 'border border-nn-border bg-nn-card text-nn-faint'
            }`}
          >
            {discoveryShell.pulseOn ? (
              <span className="mr-radar-ring pointer-events-none absolute inset-0 rounded-full" aria-hidden />
            ) : null}
            <IconPulse size={20} className="relative z-[1]" />
          </button>
          <Link to="/profile" className="shrink-0" aria-label="Open your profile">
            <UserAvatar
              name={user?.name ?? '?'}
              photoUrl={user?.photo_url}
              userId={user?.id}
              linkToProfile={false}
              size="md"
              showStatus={false}
              className="!w-[42px] !h-[42px] ring-2 ring-nn-copper"
              data-testid="header-own-avatar"
            />
          </Link>
        </div>

        <main className="flex-1 min-h-0 max-lg:pt-[var(--mobile-header-height)] max-lg:pb-[var(--mobile-tab-bar-height)] lg:pb-0">
          <LocationPresenceStrip />
          <ProfileDepthStrip />
          <div className="page-enter h-full min-h-0">{children}</div>
        </main>

        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2"
          aria-label="Primary"
        >
          <div className="flex items-stretch rounded-[1.35rem] border border-[var(--border-default)] bg-[color-mix(in_srgb,var(--bg-elevated)_95%,transparent)] shadow-[var(--shadow-lg)] backdrop-blur-xl">
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
                      data-testid={
                        item.to === '/conversations'
                          ? 'badge-conversations'
                          : `badge-mobile-${item.to.replace(/\//g, '')}`
                      }
                      className="-top-2 -right-2.5 min-w-[16px] h-[16px] text-[9px] bg-[var(--copper)] border-[var(--bg-elevated)]"
                    />
                  </span>
                  <span className="text-[9px] font-bold leading-none tracking-wide">
                    {item.shortLabel ?? item.label}
                  </span>
                </Link>
              );
            })}
            {mobileMoreItems.length > 0 ? (
              <button
                type="button"
                onClick={() => setMoreMenuOpen((v) => !v)}
                aria-label="More"
                aria-haspopup="true"
                aria-expanded={moreMenuOpen}
                data-testid="mobile-more-tab"
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-all duration-200 first:rounded-l-[1.25rem] last:rounded-r-[1.25rem] ${
                  isMoreActive || moreMenuOpen
                    ? 'text-[var(--copper)] bg-[var(--copper)]/10'
                    : 'text-[var(--cream-muted)] active:scale-95'
                }`}
              >
                <IconMore size={22} className={isMoreActive || moreMenuOpen ? 'scale-110' : ''} />
                <span className="text-[9px] font-bold leading-none tracking-wide">More</span>
              </button>
            ) : null}
          </div>
        </nav>

        <MobileMoreMenu
          open={moreMenuOpen}
          items={mobileMoreItems}
          onClose={() => setMoreMenuOpen(false)}
        />
      </div>

      <ProfileSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {signOutConfirmOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => setSignOutConfirmOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sign-out-confirm-title"
            aria-describedby="sign-out-confirm-desc"
            data-testid="sign-out-confirm"
            className="w-full max-w-sm rounded-2xl border border-nn-border bg-nn-bg p-5 shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="sign-out-confirm-title" className="text-lg font-extrabold text-nn-text">
              Sign out?
            </h2>
            <p id="sign-out-confirm-desc" className="mt-2 text-sm leading-relaxed text-nn-muted">
              You will need to sign in again to use MenRush on this device.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                data-testid="sign-out-cancel"
                onClick={() => setSignOutConfirmOpen(false)}
                className="rounded-full border border-nn-border px-4 py-2 text-sm font-bold text-nn-muted transition-colors hover:text-nn-text"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="sign-out-confirm-btn"
                onClick={confirmSignOut}
                className="rounded-full bg-[#B0432E] px-4 py-2 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const Layout: React.FC<LayoutProps> = ({ children }) => (
  <DiscoveryShellProvider>
    <LayoutInner>{children}</LayoutInner>
  </DiscoveryShellProvider>
);

/** Mobile-only sheet for nav destinations that don't fit the primary tab row. */
function MobileMoreMenu({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: NavItem[];
  onClose: () => void;
}) {
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="More">
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <div
        data-testid="mobile-more-menu"
        className="absolute inset-x-3 rounded-[1.35rem] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-2 shadow-[var(--shadow-lg)]"
        style={{ bottom: 'calc(var(--mobile-tab-bar-height) + 0.5rem)' }}
      >
        {items.map((item) => {
          const active = isNavActive(location.pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-bold transition-colors ${
                active
                  ? 'text-[var(--copper)] bg-[var(--copper)]/10'
                  : 'text-[var(--cream)] active:bg-[var(--bg-card)]'
              }`}
            >
              <item.Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
  </svg>
);
