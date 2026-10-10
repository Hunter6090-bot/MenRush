/**
 * Top-right account menu (Pete, 8 Oct 2026). Links only: every row opens a
 * screen that already exists. No new features live here.
 */
import { useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconClose, IconPlane, IconSignOut } from './icons';
import { ROUTE_LABELS } from '../lib/routeLabels';

export interface AccountMenuLink {
  id: string;
  label: string;
  /** In-app route. */
  to?: string;
  /** External link (opens a new tab). */
  href?: string;
  /** Optional row glyph (e.g. the plane on Travel, per Al's spec). */
  icon?: ComponentType<{ size?: number; className?: string }>;
}

export interface AccountMenuSection {
  id: string;
  title: string;
  links: AccountMenuLink[];
}

/**
 * Pete (8 Oct 2026): nothing is lost in the new design. Every screen that is
 * not a bottom tab or on the map is reachable from here. Placement follows
 * docs/redesign-2026-10/feature-map.md (You / Out / Settings rows).
 */
export const ACCOUNT_MENU_SECTIONS: AccountMenuSection[] = [
  {
    id: 'you',
    title: 'You',
    links: [
      { id: 'viewed-me', label: 'Viewed me', to: '/profile/edit#viewed-me' },
      { id: 'albums', label: 'Albums', to: '/albums' },
      { id: 'matches', label: ROUTE_LABELS.matches, to: '/matches' },
      { id: 'mood', label: 'Mood', to: '/profile/edit#mood' },
      // Jumps to the existing Ghost card on the Edit screen (You > Edit). No toggle here:
      // Ghost work is held for Al.
      { id: 'ghost', label: 'Ghost mode', to: '/profile/edit#ghost' },
      { id: 'invite', label: 'Invite friends', to: '/profile/edit#invite' },
      { id: 'alerts', label: ROUTE_LABELS.alerts, to: '/notifications' },
      { id: 'premium', label: 'Premium', to: '/premium' },
      { id: 'verify', label: 'Get verified', to: '/profile/edit#verify' },
    ],
  },
  {
    id: 'discover',
    title: 'Discover',
    links: [
      { id: 'community', label: ROUTE_LABELS.community, to: '/stream' },
      { id: 'events', label: ROUTE_LABELS.events, to: '/events' },
      { id: 'cruise', label: `${ROUTE_LABELS.hotSpots} map`, to: '/hot-spots' },
      { id: 'travel', label: 'Travel', to: '/travel', icon: IconPlane },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    links: [
      { id: 'settings', label: ROUTE_LABELS.settings, to: '/settings' },
      { id: 'account-security', label: 'Account and security', to: '/settings#account' },
      { id: 'privacy-visibility', label: 'Privacy and visibility', to: '/profile/edit#privacy' },
      { id: 'two-factor', label: 'Two-factor', to: '/settings#two-factor' },
      { id: 'notifications', label: 'Notifications', to: '/settings#notifications' },
      { id: 'blocked', label: 'Blocked', to: '/settings#blocked' },
      { id: 'delete-account', label: 'Delete account', to: '/settings#delete-account' },
    ],
  },
  {
    id: 'help',
    title: 'Help',
    links: [
      { id: 'help', label: 'Help', to: '/help' },
      { id: 'safety', label: 'Safety', to: '/safety' },
      { id: 'contact', label: 'Contact', to: '/contact' },
      { id: 'get-the-app', label: 'Get the app', to: '/get-the-app' },
    ],
  },
];

/** Back-compat flat list (tests, audits). */
export const ACCOUNT_MENU_LINKS: AccountMenuLink[] = ACCOUNT_MENU_SECTIONS.flatMap((s) => s.links);

export const ACCOUNT_MENU_FOOTER_LINKS: AccountMenuLink[] = [
  { id: 'terms', label: 'Terms', to: '/terms' },
  { id: 'privacy-policy', label: 'Privacy policy', to: '/privacy' },
  { id: 'cookies', label: 'Cookies', to: '/cookies' },
  { id: 'guidelines', label: 'Guidelines', to: '/guidelines' },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/menrushsocial/' },
  { id: 'bluesky', label: 'Bluesky', href: 'https://bsky.app/profile/menrush.bsky.social' },
];

export function MenuGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function AccountMenuButton({
  open,
  onClick,
  className = '',
}: {
  open: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Menu"
      aria-haspopup="dialog"
      aria-expanded={open}
      data-testid="account-menu-button"
      className={`flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--cream-soft)] transition-colors active:bg-[var(--bg-card)] hover:text-[var(--copper)] ${className}`}
    >
      <MenuGlyph size={24} />
    </button>
  );
}

function SearchGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
    </svg>
  );
}

const footerLinkClass =
  'inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[var(--cream-muted)] hover:text-[var(--cream)]';

/** Row layout without a text colour, so active and default colours never fight on CSS order. */
const rowBaseClass =
  'flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-4 text-left text-[17px] font-bold transition-colors active:bg-[var(--bg-card)] hover:bg-[var(--bg-card)]';

const rowClass = `${rowBaseClass} text-[var(--cream)]`;

export function AccountMenu({
  open,
  onClose,
  onSignOut,
  onSearch,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
  /** App-wide profile search (moved off the map). */
  onSearch?: () => void;
  /** Extra controls rendered above the links (e.g. Discretion). */
  children?: ReactNode;
}) {
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  // Latest onClose without re-running the open effect: an inline onClose from the parent
  // must not move focus back to Close on every re-render (Discretion arrow keys, VoiceOver).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Element that opened the Menu; Escape and Close hand focus back to it.
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAndReturnFocusRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    const first = panelRef.current?.querySelector<HTMLElement>('a, button, input');
    first?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  /** Close, then focus the Menu trigger (the opener, or the visible Menu button when Safari did not focus it on tap). */
  const closeAndReturnFocus = () => {
    onCloseRef.current();
    const opener = openerRef.current;
    const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="account-menu-button"]'));
    const target =
      (opener?.isConnected && !panelRef.current?.contains(opener) ? opener : null) ??
      triggers.find((el) => el.getClientRects().length > 0) ??
      triggers[0];
    target?.focus();
  };
  const closeAndReturnFocusRef = useRef(closeAndReturnFocus);
  closeAndReturnFocusRef.current = closeAndReturnFocus;

  if (!open) return null;

  const isActive = (to: string) => {
    const [path, hash] = to.split('#');
    if (location.pathname !== path) return false;
    return hash ? location.hash === `#${hash}` : !location.hash;
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Menu" data-testid="account-menu">
      <button
        type="button"
        aria-label="Close menu"
        onClick={closeAndReturnFocus}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className="absolute inset-y-0 right-0 flex w-[min(88vw,380px)] flex-col overflow-y-auto border-l border-[var(--border-default)] bg-[var(--bg-elevated)] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-[env(safe-area-inset-top,0px)] shadow-[var(--shadow-lg)]"
        data-testid="account-menu-panel"
      >
        <div className="flex h-[3.25rem] shrink-0 items-center justify-between px-3">
          <p className="pl-2 text-[19px] font-extrabold text-[var(--cream)]">Menu</p>
          <button
            type="button"
            onClick={closeAndReturnFocus}
            aria-label="Close menu"
            data-testid="account-menu-close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--cream-soft)] active:bg-[var(--bg-card)]"
          >
            <IconClose size={22} />
          </button>
        </div>

        {onSearch ? (
          <div className="px-2 pb-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onSearch();
              }}
              data-testid="account-menu-search"
              className={rowClass}
            >
              <span className="flex w-5 shrink-0 justify-center">
                <SearchGlyph />
              </span>
              Search
            </button>
          </div>
        ) : null}

        {children ? <div className="px-3 pb-2">{children}</div> : null}

        <nav className="flex flex-col px-2" aria-label="Menu sections">
          {ACCOUNT_MENU_SECTIONS.map((section) => (
            <div key={section.id} className="pb-2" data-testid={`account-menu-section-${section.id}`}>
              <p className="px-4 pb-1 pt-3 text-[15px] font-extrabold uppercase tracking-[0.14em] text-[var(--cream-muted)]">
                {section.title}
              </p>
              {section.links.map((item) => {
                const active = item.to ? isActive(item.to) : false;
                return (
                  <Link
                    key={item.id}
                    to={item.to ?? '/'}
                    onClick={onClose}
                    data-testid={`account-menu-${item.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`${rowBaseClass} ${active ? 'text-[var(--nn-accent-text)]' : 'text-[var(--cream)]'}`}
                  >
                    {item.icon ? (
                      <span className="flex w-6 shrink-0 justify-center" data-testid={`account-menu-${item.id}-icon`}>
                        <item.icon size={24} />
                      </span>
                    ) : null}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            data-testid="account-menu-sign-out"
            className={`${rowBaseClass} text-[var(--nn-danger-text)]`}
          >
            <span className="flex w-5 shrink-0 justify-center">
              <IconSignOut size={20} />
            </span>
            Sign out
          </button>
        </nav>

        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 px-6 pt-6">
          {ACCOUNT_MENU_FOOTER_LINKS.map((item) =>
            item.href ? (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`account-menu-${item.id}`}
                className={footerLinkClass}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.id}
                to={item.to ?? '/'}
                onClick={onClose}
                data-testid={`account-menu-${item.id}`}
                className={footerLinkClass}
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
