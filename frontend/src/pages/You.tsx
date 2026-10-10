/**
 * You tab: rows only (Claude Design board "07 You / settings", Pete lock 10 Oct 2026).
 *
 * Header: photo in a ring, name, "ID verified" (Veriff only, same tick as everywhere
 * else) and Edit. Card 1: Albums, Discretion, Quiet hours, 2FA, Settings. Card 2:
 * Merch, Brands. Sign out with the brand mark at the bottom.
 *
 * Every profile control that used to live here (cover, photo, Active now, the Edit
 * Profile form, map photo, Viewed me, Invite, location, Mood, Ghost, visibility)
 * is now on the Edit screen (/profile/edit). Nothing on this page writes data.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { albumsAPI, authAPI, profileMetaAPI, usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { useVerification } from '../hooks/useVerification';
import { Layout } from '../components/Layout';
import { UserAvatar } from '../components/UserAvatar';
import { FadedBrandFace, isNearbyPlaceholderFace } from '../components/FadedBrandFace';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { BrandMark } from '../components/BrandMark';
import { MAP_PIN_FUZZ_EVENT, MenuDiscretion } from '../components/MenuDiscretion';
import { IconClose, IconSignOut } from '../components/icons';
import {
  IconAlbums,
  IconBag,
  IconChevronRight,
  IconClock,
  IconEyeOff,
  IconLock,
  IconPencil,
  IconSun,
  IconTag,
} from '../components/icons/YouRowIcons';
import { formatFuzzMetersLabel, nearestMapPinFuzzStep } from '../lib/mapPinFuzz';
import {
  PROFILE_EDIT_PATH,
  YOU_ROW_CARDS,
  comingSoonNotice,
  isComingSoon,
  type YouRowId,
} from '../lib/youRows';

/**
 * Board header: ~84px photo, name wraps to two lines and is never cut off.
 * A name that still needs more than two lines steps down 1px at a time, never
 * below 15px (text lock). At 15px a very long name keeps wrapping rather than truncate.
 */
export const YOU_AVATAR_PX = 84;
export const YOU_NAME_MAX_PX = 24;
export const YOU_NAME_MIN_PX = 15;
export const YOU_NAME_LINE_HEIGHT = 1.2;

/**
 * Largest size from max down to min whose rendered line count is at most 2.
 * `linesAt(px)` sets the size and returns how many lines the name takes.
 */
export function fitNameSize(linesAt: (px: number) => number, max = YOU_NAME_MAX_PX, min = YOU_NAME_MIN_PX): number {
  for (let px = max; px > min; px -= 1) {
    if (linesAt(px) <= 2) return px;
  }
  return min;
}

function useFittedNameSize(name: string) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const [px, setPx] = useState(YOU_NAME_MAX_PX);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const linesAt = (size: number) => {
      el.style.fontSize = `${size}px`;
      const lineBox = size * YOU_NAME_LINE_HEIGHT;
      // jsdom has no layout (height 0): treat that as one line.
      return el.scrollHeight > 0 ? Math.round(el.scrollHeight / lineBox) : 1;
    };
    const next = fitNameSize(linesAt);
    el.style.fontSize = `${next}px`;
    setPx(next);
  }, []);
  useLayoutEffect(() => {
    fit();
  }, [fit, name]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const parent = el.parentElement;
    if (!parent) return;
    let lastW = parent.clientWidth;
    const ro = new ResizeObserver(() => {
      if (parent.clientWidth !== lastW) {
        lastW = parent.clientWidth;
        fit();
      }
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [fit]);
  return { ref, px };
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Ask Layout to open its Sign out confirm (same confirm as the Menu and sidebar). */
export const REQUEST_SIGN_OUT_EVENT = 'menrush:request-sign-out';

const ROW_ICONS: Record<YouRowId, (p: { size?: number }) => ReactNode> = {
  albums: IconAlbums,
  discretion: IconEyeOff,
  'quiet-hours': IconClock,
  'two-factor': IconLock,
  settings: IconSun,
  merch: IconBag,
  brands: IconTag,
};

const rowClass =
  'flex min-h-[60px] w-full items-center gap-4 px-4 text-left text-[17px] font-bold text-[var(--cream)] transition-colors hover:bg-[var(--bg-elevated)] active:bg-[var(--bg-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--copper)]';

const cardClass =
  'overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] divide-y divide-[var(--border-default)]';

interface Me {
  name?: string;
  photo_url?: string | null;
}

export function You() {
  const user = useAuthStore((s) => s.user);
  const verification = useVerification();
  const [me, setMe] = useState<Me | null>(null);
  const [albumCount, setAlbumCount] = useState<number | null>(null);
  const [twoFactorOn, setTwoFactorOn] = useState<boolean | null>(null);
  const [discretionM, setDiscretionM] = useState<number | null>(null);
  const [discretionOpen, setDiscretionOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const discretionTrigger = useRef<HTMLButtonElement | null>(null);
  const discretionPanel = useRef<HTMLDivElement | null>(null);
  const discretionClose = useRef<HTMLButtonElement | null>(null);
  const discretionWasOpen = useRef(false);

  // Reads only. Opening You never writes anything.
  useEffect(() => {
    let live = true;
    usersAPI
      .getMe()
      .then((r) => live && setMe(r.data as Me))
      .catch(() => {});
    albumsAPI
      .listMine()
      .then((r) => live && setAlbumCount((r.data.albums ?? []).length))
      .catch(() => {});
    authAPI
      .getTwoFactorStatus()
      .then((r) => live && setTwoFactorOn(Boolean(r.data.enabled)))
      .catch(() => {});
    profileMetaAPI
      .getMapPinFuzz()
      .then((r) => live && setDiscretionM(nearestMapPinFuzzStep(r.data.map_pin_fuzz_m)))
      .catch(() => {});
    return () => {
      live = false;
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  // Discretion changes made in the sheet (or the Menu) update the row value.
  useEffect(() => {
    const onFuzz = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      if (typeof v === 'number') setDiscretionM(v);
    };
    window.addEventListener(MAP_PIN_FUZZ_EVENT, onFuzz);
    return () => window.removeEventListener(MAP_PIN_FUZZ_EVENT, onFuzz);
  }, []);

  // Discretion sheet: focus moves in on open and back to the row on close.
  useEffect(() => {
    if (discretionOpen) {
      discretionWasOpen.current = true;
      discretionClose.current?.focus();
    } else if (discretionWasOpen.current) {
      discretionWasOpen.current = false;
      discretionTrigger.current?.focus();
    }
  }, [discretionOpen]);

  const closeDiscretion = () => setDiscretionOpen(false);

  const onDiscretionKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDiscretion();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = discretionPanel.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = active ? panel.contains(active) : false;
    if (e.shiftKey && (active === first || !inside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !inside)) {
      e.preventDefault();
      first.focus();
    }
  };

  const name = me?.name ?? user?.name ?? '';
  const { ref: nameRef, px: namePx } = useFittedNameSize(name);
  const photoUrl = me?.photo_url ?? user?.photo_url ?? null;
  const verified = verification.status?.is_verified === true;

  const showNotice = (label: string) => {
    setNotice(comingSoonNotice(label));
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  };

  const rowValue = (id: YouRowId): string | null => {
    if (id === 'albums') return albumCount == null ? null : String(albumCount);
    if (id === 'discretion') return discretionM == null ? null : formatFuzzMetersLabel(discretionM);
    if (id === 'two-factor') return twoFactorOn == null ? null : twoFactorOn ? 'On' : 'Off';
    return null;
  };

  const renderRow = (row: (typeof YOU_ROW_CARDS)[number][number]) => {
    const Icon = ROW_ICONS[row.id];
    const soon = isComingSoon(row.id);
    const value = soon ? null : rowValue(row.id);
    const inner = (
      <>
        <span className="flex w-6 shrink-0 justify-center text-[var(--nn-accent-text)]" data-testid={`you-row-icon-${row.id}`}>
          <Icon size={22} />
        </span>
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
        {soon ? (
          <span
            className="shrink-0 rounded-full border border-[var(--border-default)] px-2 text-[15px] font-medium leading-[22px] text-[var(--cream-muted)]"
            data-testid={`you-row-soon-${row.id}`}
          >
            Coming soon
          </span>
        ) : value != null ? (
          <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--cream-muted)]" data-testid={`you-row-value-${row.id}`}>
            {value}
          </span>
        ) : null}
        {soon ? null : (
          <span className="shrink-0 text-[var(--cream-muted)]" aria-hidden>
            <IconChevronRight size={18} />
          </span>
        )}
      </>
    );

    if (soon) {
      return (
        <button
          key={row.id}
          type="button"
          className={rowClass}
          data-testid={`you-row-${row.id}`}
          data-coming-soon="true"
          aria-label={`${row.label}, coming soon`}
          onClick={() => showNotice(row.label)}
        >
          {inner}
        </button>
      );
    }
    if (row.id === 'discretion') {
      return (
        <button
          key={row.id}
          type="button"
          className={rowClass}
          data-testid={`you-row-${row.id}`}
          ref={discretionTrigger}
          aria-haspopup="dialog"
          aria-expanded={discretionOpen}
          onClick={() => setDiscretionOpen(true)}
        >
          {inner}
        </button>
      );
    }
    return (
      <Link key={row.id} to={row.to!} className={rowClass} data-testid={`you-row-${row.id}`}>
        {inner}
      </Link>
    );
  };

  return (
    <Layout>
      <h1 className="sr-only">You</h1>
      <div className="mx-auto w-full min-w-0 max-w-xl space-y-4 px-4 py-4 pb-28 lg:py-8" data-testid="you-rows-page">
        <header className="flex items-center gap-3 py-2" data-testid="you-header">
          <span
            className="inline-flex shrink-0 rounded-full border-2 border-[var(--copper)] p-0.5"
            data-testid="you-avatar-ring"
          >
            {isNearbyPlaceholderFace(photoUrl) ? (
              <span
                className="inline-flex overflow-hidden rounded-full"
                style={{ width: YOU_AVATAR_PX, height: YOU_AVATAR_PX }}
                data-testid="you-avatar-brand-face"
              >
                <FadedBrandFace variant="profile" size={YOU_AVATAR_PX} label={name || 'MenRush'} />
              </span>
            ) : (
              <UserAvatar
                name={name}
                photoUrl={photoUrl ?? undefined}
                size="xl"
                showStatus={false}
                className="!h-[84px] !w-[84px]"
                data-testid="you-avatar"
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              ref={nameRef}
              className="whitespace-normal break-words font-extrabold text-[var(--cream)] [overflow-wrap:anywhere]"
              style={{ fontSize: namePx, lineHeight: YOU_NAME_LINE_HEIGHT }}
              data-testid="you-name"
              data-font-px={namePx}
            >
              {name}
            </h2>
            {verified ? (
              <p className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold text-[var(--nn-accent-text)]" data-testid="you-id-verified">
                <VerifiedBadge tone="surface" />
                <span>ID verified</span>
              </p>
            ) : null}
          </div>
          <Link
            to={PROFILE_EDIT_PATH}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[15px] font-bold text-[var(--cream)] hover:border-[var(--copper)]"
            data-testid="you-edit"
          >
            <span className="text-[var(--nn-accent-text)]">
              <IconPencil size={16} />
            </span>
            Edit
          </Link>
        </header>

        {YOU_ROW_CARDS.map((rows, i) => (
          <nav key={i} className={cardClass} aria-label={i === 0 ? 'You' : 'More'} data-testid={`you-card-${i + 1}`}>
            {rows.map(renderRow)}
          </nav>
        ))}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(REQUEST_SIGN_OUT_EVENT))}
            className="inline-flex min-h-[44px] items-center gap-2.5 px-2 text-[17px] font-bold text-[var(--cream-muted)] hover:text-[var(--cream)]"
            data-testid="you-sign-out"
          >
            <IconSignOut size={20} />
            Sign out
          </button>
          <BrandMark size="sm" />
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          className="fixed bottom-28 left-1/2 z-[80] w-[min(90vw,360px)] -translate-x-1/2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-3 text-center text-[15px] font-semibold text-[var(--cream)] shadow-[var(--shadow-lg)]"
          data-testid="you-coming-soon-notice"
        >
          {notice}
        </div>
      ) : null}

      {discretionOpen ? (
        <div className="fixed inset-0 z-[75]" role="dialog" aria-modal="true" aria-label="Discretion" data-testid="you-discretion-sheet">
          <button
            type="button"
            aria-label="Close Discretion"
            tabIndex={-1}
            className="absolute inset-0 bg-black/55"
            onClick={closeDiscretion}
          />
          <div
            ref={discretionPanel}
            onKeyDown={onDiscretionKeyDown}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-xl rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[17px] font-extrabold text-[var(--cream)]">Discretion</p>
              <button
                type="button"
                ref={discretionClose}
                onClick={closeDiscretion}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--cream-soft)]"
              >
                <IconClose size={22} />
              </button>
            </div>
            <p className="mb-3 text-[15px] text-[var(--cream-muted)]">Your pin moves up to this far from your real spot.</p>
            <MenuDiscretion />
          </div>
        </div>
      ) : null}
    </Layout>
  );
}

export default You;
