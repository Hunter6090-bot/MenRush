import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HotSpotDTO } from '../api/client';
import { IconClose, SpotTypeIcon, spotTypeKey } from './icons';
import { formatDistanceFromKm } from '../lib/localeUnits';
import { HOT_SPOTS_FACE } from '../lib/cruiseCopy';
import { getDirectionsUrl } from '../lib/cruising';
import { activeHotSpotCountLabel, isHotSpotActive } from '../lib/hotSpotCounts';
import { HotSpotReviewsPanel } from './HotSpotReviewsPanel';

interface HotSpotSheetProps {
  spot: HotSpotDTO | null;
  isPremium: boolean;
  acting: boolean;
  error: string;
  onClose: () => void;
  onCheckIn: (spot: HotSpotDTO, anonymous: boolean) => void | Promise<void>;
  /** Legacy: open the separate reviews modal. Without it, Reviews jumps to the inline list. */
  onOpenReviews?: (spot: HotSpotDTO) => void;
  /** Review posted or deleted: the server returns the spot with its new rating. */
  onSpotUpdated?: (spot: HotSpotDTO) => void;
  /** Show this spot on the Map tab (Out) or centre the map on its pin (Map). */
  onViewOnMap?: (spot: HotSpotDTO) => void;
}

type Snap = 'half' | 'full';
const SNAP_VH: Record<Snap, number> = { half: 55, full: 92 };
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Spot details sheet. Opens from an Out card and from the spot's pin on the map,
 * so both routes show the same thing: name, type, distance, check-in counts
 * (server-rounded for Free: exact 0 to 4, then 5+; exact for Premium), Check in,
 * Check in anonymously, Directions (native maps), View on map and reviews
 * (read and leave one). Half-screen, drag the handle up for full screen.
 * Focus is trapped inside; Escape or Close returns focus to what opened it.
 */
export function HotSpotSheet({
  spot,
  isPremium,
  acting,
  error,
  onClose,
  onCheckIn,
  onOpenReviews,
  onSpotUpdated,
  onViewOnMap,
}: HotSpotSheetProps) {
  const open = Boolean(spot);
  const [snap, setSnap] = useState<Snap>('half');
  const [dragVh, setDragVh] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startVh: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const reviewsRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Remember the opener, focus Close, and hand focus back when the sheet goes.
  useEffect(() => {
    if (!open) return;
    setSnap('half');
    setDragVh(null);
    const active = document.activeElement;
    returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
    closeRef.current?.focus();
    return () => {
      const el = returnFocusRef.current;
      returnFocusRef.current = null;
      if (el && el.isConnected) el.focus();
    };
  }, [open]);

  // Escape closes; Tab and Shift+Tab stay inside the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const root = sheetRef.current;
      if (!root) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      const inside = current ? root.contains(current) : false;
      if (e.shiftKey && (current === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragRef.current = { startY: e.clientY, startVh: dragVh ?? SNAP_VH[snap] };
    },
    [dragVh, snap],
  );

  const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const deltaY = dragRef.current.startY - e.clientY;
    const next = Math.min(96, Math.max(20, dragRef.current.startVh + (deltaY / window.innerHeight) * 100));
    setDragVh(next);
  }, []);

  const endDrag = useCallback(() => {
    const vh = dragVh;
    dragRef.current = null;
    setDragVh(null);
    if (vh == null) return;
    if (vh < 35) {
      onCloseRef.current();
      return;
    }
    setSnap(vh > (SNAP_VH.half + SNAP_VH.full) / 2 ? 'full' : 'half');
  }, [dragVh]);

  if (!spot) return null;

  const active = isHotSpotActive(spot);
  const countLabel = activeHotSpotCountLabel(spot);
  const typeKey = spotTypeKey(spot.category_slug, spot.category_name);
  const hasCoords = Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude);
  const currentVh = dragVh ?? SNAP_VH[snap];
  const dragging = dragVh != null;
  const meta = [
    spot.distance_km != null ? formatDistanceFromKm(Number(spot.distance_km)) : null,
    spot.city ?? null,
    spot.nation ?? null,
  ].filter(Boolean);

  const jumpToReviews = () => {
    if (onOpenReviews) {
      onOpenReviews(spot);
      return;
    }
    setSnap('full');
    const el = reviewsRef.current;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    el?.focus();
  };

  const secondaryBtn =
    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-4 text-[15px] font-bold text-[var(--cream)] hover:border-[var(--copper)]';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center"
      data-testid="hotspot-sheet-root"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close spot details"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        data-testid="hotspot-sheet-backdrop"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotspot-sheet-title"
        data-testid="hotspot-sheet"
        data-snap={snap}
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)]"
        style={{
          height: `${currentVh}vh`,
          maxHeight: `${currentVh}vh`,
          transition: dragging ? 'none' : 'height 220ms cubic-bezier(0.22,1,0.36,1), max-height 220ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div
          role="slider"
          aria-label="Resize spot details"
          aria-valuemin={SNAP_VH.half}
          aria-valuemax={SNAP_VH.full}
          aria-valuenow={Math.round(currentVh)}
          aria-valuetext={snap === 'full' ? 'Full screen' : 'Half screen'}
          tabIndex={0}
          data-testid="hotspot-sheet-handle"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'PageUp') {
              e.preventDefault();
              setSnap('full');
            } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
              e.preventDefault();
              setSnap('half');
            } else if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSnap((s) => (s === 'full' ? 'half' : 'full'));
            }
          }}
          className="flex min-h-[44px] shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          <span className="h-1.5 w-12 rounded-full bg-[var(--cream-muted)]" aria-hidden />
        </div>

        <div className="flex shrink-0 items-start gap-3 px-5">
          <div className="min-w-0 flex-1">
            <p
              className="flex items-center gap-1.5 text-[15px] font-extrabold text-[var(--nn-accent-text)]"
              data-testid="hotspot-sheet-type"
            >
              <SpotTypeIcon type={typeKey} size={18} />
              <span>{spot.category_name}</span>
            </p>
            <h2 id="hotspot-sheet-title" className="mt-0.5 text-[20px] font-extrabold leading-tight text-[var(--cream)]">
              {spot.name}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[15px] text-[var(--cream-muted)]" data-testid="hotspot-sheet-meta">
              <span>{meta.length ? meta.join(' · ') : 'UK'}</span>
              {spot.rating_avg != null && (spot.review_count ?? 0) > 0 ? (
                <span className="font-bold text-[var(--nn-accent-text)]">
                  · ★ {spot.rating_avg} ({spot.review_count})
                </span>
              ) : null}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="hotspot-sheet-close"
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--cream-muted)] hover:text-[var(--cream)]"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3">
          <div className="flex items-center gap-2" data-testid="hotspot-sheet-activity">
            <span
              className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${active ? 'bg-[var(--status-online)]' : 'bg-[var(--cream-muted)]'}`}
              aria-hidden
            />
            <p className="text-[15px] font-bold text-[var(--cream)]">
              {active ? (countLabel ? `${countLabel} checked in` : 'Active now') : 'No check-ins right now'}
            </p>
          </div>
          <p className="mt-1 text-[15px] text-[var(--cream-muted)]">
            Check-ins expire after {spot.checkin_ttl_hours ?? 4} hours.
          </p>

          {error ? (
            <p role="alert" className="mt-3 text-[15px] font-semibold text-[var(--nn-danger-text)]">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-2" data-testid="hotspot-sheet-actions">
            {spot.is_checked_in ? (
              <button
                type="button"
                disabled={acting}
                onClick={() => void onCheckIn(spot, false)}
                data-testid="hotspot-sheet-checkout"
                className="min-h-[44px] rounded-full border border-[var(--copper)] bg-[var(--bg-card)] px-4 text-[15px] font-bold text-[var(--nn-accent-text)]"
              >
                {acting ? 'Updating…' : spot.my_checkin_anonymous ? 'Checked in anonymously. Check out' : 'Check out'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void onCheckIn(spot, false)}
                  data-testid="hotspot-sheet-checkin"
                  className="min-h-[44px] rounded-full bg-[var(--copper)] px-4 text-[15px] font-bold text-[var(--nn-on-copper)]"
                >
                  {acting ? 'Checking in…' : 'Check in'}
                </button>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => void onCheckIn(spot, true)}
                  data-testid="hotspot-sheet-checkin-anon"
                  className={secondaryBtn}
                >
                  Check in anonymously
                </button>
              </>
            )}

            <div className="grid grid-cols-2 gap-2">
              {hasCoords ? (
                <a
                  href={getDirectionsUrl(spot.latitude, spot.longitude, spot.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="hotspot-sheet-directions"
                  className={secondaryBtn}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-[var(--nn-accent-text)]">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                  Directions
                </a>
              ) : null}
              {onViewOnMap && hasCoords ? (
                <button
                  type="button"
                  onClick={() => onViewOnMap(spot)}
                  data-testid="hotspot-sheet-view-on-map"
                  className={secondaryBtn}
                >
                  <SpotTypeIcon type="pin" size={18} className="text-[var(--nn-accent-text)]" />
                  View on map
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={jumpToReviews}
              data-testid="hotspot-sheet-reviews-btn"
              className={secondaryBtn}
            >
              <span>Reviews</span>
              {(spot.review_count ?? 0) > 0 ? (
                <span className="text-[15px] text-[var(--nn-accent-text)]">{spot.review_count}</span>
              ) : null}
            </button>
          </div>

          <p className="mt-4 text-[15px] leading-relaxed text-[var(--cream-muted)]" data-testid="hotspot-sheet-brand-face">
            {HOT_SPOTS_FACE}
          </p>

          {spot.description ? (
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--cream-soft)]">{spot.description}</p>
          ) : null}

          {spot.source_url ? (
            <a
              href={spot.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex min-h-[44px] items-center text-[15px] font-semibold text-[var(--nn-accent-text)] underline-offset-2 hover:underline"
            >
              Venue website
            </a>
          ) : null}

          <div ref={reviewsRef} tabIndex={-1} className="mt-5 outline-none" data-testid="hotspot-sheet-reviews">
            <HotSpotReviewsPanel spot={spot} onSpotUpdated={onSpotUpdated} />
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[15px] text-[var(--cream-muted)]">
            <Link
              to="/safety"
              className="inline-flex min-h-[44px] items-center font-semibold text-[var(--nn-accent-text)] underline-offset-2 hover:underline"
            >
              Safety tips
            </Link>
            {!isPremium ? <span>Counts of 5+ are rounded on Free.</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
