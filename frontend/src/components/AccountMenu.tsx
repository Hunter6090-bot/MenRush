/**
 * Top-right account menu (Pete, 8 Oct 2026). Links only: every row opens a
 * screen that already exists. No new features live here.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconClose, IconNotifications, IconSettings, IconSignOut } from './icons';

export interface AccountMenuLink {
  id: string;
  label: string;
  to: string;
}

/** Order follows docs/redesign-2026-10/feature-map.md (You / Settings rows). */
export const ACCOUNT_MENU_LINKS: AccountMenuLink[] = [
  { id: 'settings', label: 'Settings', to: '/settings' },
  { id: 'privacy-security', label: 'Privacy and security', to: '/settings#account' },
  { id: 'two-factor', label: 'Two-factor', to: '/settings#two-factor' },
  { id: 'notifications', label: 'Notifications', to: '/settings#notifications' },
  { id: 'blocked', label: 'Blocked', to: '/settings#blocked' },
  { id: 'premium', label: 'Premium', to: '/premium' },
  { id: 'safety', label: 'Safety', to: '/safety' },
  { id: 'help', label: 'Help', to: '/help' },
];

export const ACCOUNT_MENU_FOOTER_LINKS: AccountMenuLink[] = [
  { id: 'terms', label: 'Terms', to: '/terms' },
  { id: 'privacy-policy', label: 'Privacy policy', to: '/privacy' },
  { id: 'guidelines', label: 'Guidelines', to: '/guidelines' },
  { id: 'contact', label: 'Contact', to: '/contact' },
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

const rowClass =
  'flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-4 text-left text-[17px] font-bold text-[var(--cream)] transition-colors active:bg-[var(--bg-card)] hover:bg-[var(--bg-card)]';

function rowIcon(id: string): ReactNode {
  if (id === 'settings') return <IconSettings size={20} />;
  if (id === 'notifications') return <IconNotifications size={20} />;
  return null;
}

export function AccountMenu({
  open,
  onClose,
  onSignOut,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
  /** Extra controls rendered above the links (e.g. Discretion). */
  children?: ReactNode;
}) {
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const first = panelRef.current?.querySelector<HTMLElement>('a, button, input');
    first?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

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
        onClick={onClose}
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
            onClick={onClose}
            aria-label="Close menu"
            data-testid="account-menu-close"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--cream-soft)] active:bg-[var(--bg-card)]"
          >
            <IconClose size={22} />
          </button>
        </div>

        {children ? <div className="px-3 pb-2">{children}</div> : null}

        <nav className="flex flex-col gap-0.5 px-2" aria-label="Account">
          {ACCOUNT_MENU_LINKS.map((item) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.id}
                to={item.to}
                onClick={onClose}
                data-testid={`account-menu-${item.id}`}
                aria-current={active ? 'page' : undefined}
                className={`${rowClass} ${active ? 'text-[var(--copper)]' : ''}`}
              >
                <span className="flex w-5 shrink-0 justify-center text-[var(--cream-muted)]">{rowIcon(item.id)}</span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            data-testid="account-menu-sign-out"
            className={`${rowClass} text-[#D9694F]`}
          >
            <span className="flex w-5 shrink-0 justify-center">
              <IconSignOut size={20} />
            </span>
            Sign out
          </button>
        </nav>

        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 px-6 pt-6">
          {ACCOUNT_MENU_FOOTER_LINKS.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              onClick={onClose}
              data-testid={`account-menu-${item.id}`}
              className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--cream-muted)] hover:text-[var(--cream)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
