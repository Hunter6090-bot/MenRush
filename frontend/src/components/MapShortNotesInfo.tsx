import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dismissHotSpotsMapBanner, isHotSpotsMapBannerDismissed } from '../lib/hotSpotsMapBanner';
import { dismissMapPrivacyNote, isMapPrivacyNoteDismissed } from './MapPrivacyNote';

type SheetEdge = { left: number; right: number; top: number };

function overlapsX(a: SheetEdge, left: number, right: number): boolean {
  return a.left < right && left < a.right;
}

export function mapNotesSheetCeilingPx(parts: {
  mapBottom: number;
  sheetLeft: number;
  sheetRight: number;
  tab?: SheetEdge | null;
  pulse?: SheetEdge | null;
  dock?: SheetEdge | null;
}): number {
  let ceiling = parts.mapBottom;
  for (const box of [parts.tab, parts.pulse, parts.dock]) {
    if (box && overlapsX(box, parts.sheetLeft, parts.sheetRight)) {
      ceiling = Math.min(ceiling, box.top);
    }
  }
  return ceiling;
}

/** Space between the pills and the tab / overlapping PULSE / dock / map bottom. */
export function mapNotesSheetMaxHeightPx(sheetTop: number, ceiling: number, gap = 8): number {
  return Math.max(0, Math.floor(ceiling - sheetTop - gap));
}

function edgeBox(id: string): SheetEdge | null {
  const el = document.querySelector(`[data-testid="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top };
}

/**
 * Short-map access to the 18+ spots note and Discretion pin note.
 * One 44px info button stays on the pills row after dismiss (no unread
 * dot) so the 18+ note can be reread. The copper unread dot includes
 * the 18+ note only while the Spots layer is on. Escape and an outside
 * tap close the sheet without activating what's underneath.
 */
export function MapShortNotesInfo({
  spotsText,
  pinText,
  spotsLayerOn = true,
}: {
  spotsText?: string | null;
  pinText?: string | null;
  /** 18+ unread / sheet copy only while the Spots layer is on. */
  spotsLayerOn?: boolean;
}) {
  const [spotsOn, setSpotsOn] = useState(() => Boolean(spotsText) && !isHotSpotsMapBannerDismissed());
  const [pinOn, setPinOn] = useState(() => Boolean(pinText) && !isMapPrivacyNoteDismissed());
  const [open, setOpen] = useState(false);
  const [hideSpots, setHideSpots] = useState(false);
  const [hidePin, setHidePin] = useState(false);
  const [maxHeight, setMaxHeight] = useState(176);
  const infoRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const spotsUnread = Boolean(spotsText) && spotsLayerOn && spotsOn;
  const pinUnread = Boolean(pinText) && pinOn;
  const unread = spotsUnread || pinUnread;
  const showSpots = Boolean(spotsText) && spotsLayerOn && !hideSpots;
  const showPin = Boolean(pinText) && !hidePin;

  const closeSheet = (refocus = true) => {
    setOpen(false);
    if (refocus) {
      queueMicrotask(() => infoRef.current?.focus());
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const stack = document.querySelector('[data-testid="map-top-stack"]');
      const column =
        document.querySelector('[data-testid="map-overlay-column"]') ??
        document.querySelector('[data-testid="discover-map-panel"]');
      const sheetTop = (stack?.getBoundingClientRect().bottom ?? 0) + 8;
      const host = column?.getBoundingClientRect();
      const mapBottom = host?.bottom ?? window.innerHeight;
      const width = Math.min(416, (host?.width ?? window.innerWidth) - 88);
      const sheetLeft = (host?.left ?? 0) + ((host?.width ?? window.innerWidth) - width) / 2;
      setMaxHeight(
        mapNotesSheetMaxHeightPx(
          sheetTop,
          mapNotesSheetCeilingPx({
            mapBottom,
            sheetLeft,
            sheetRight: sheetLeft + width,
            tab: edgeBox('mobile-tab-bar'),
            pulse: edgeBox('pulse-fab'),
            dock: edgeBox('discover-chat-dock-toggle'),
          }),
        ),
      );
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    const stack = document.querySelector('[data-testid="map-top-stack"]');
    const column = document.querySelector('[data-testid="map-overlay-column"]');
    if (stack) ro?.observe(stack);
    if (column) ro?.observe(column);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [open, showSpots, showPin]);

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) => {
      const node = target as Node | null;
      return Boolean(node && (infoRef.current?.contains(node) || sheetRef.current?.contains(node)));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSheet(true);
      }
    };
    const blockOutside = (e: Event) => {
      if (inside(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      closeSheet(true);
      const swallowClick = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        document.removeEventListener('click', swallowClick, true);
      };
      document.addEventListener('click', swallowClick, true);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', blockOutside, true);
    document.addEventListener('mousedown', blockOutside, true);
    document.addEventListener('touchstart', blockOutside, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', blockOutside, true);
      document.removeEventListener('mousedown', blockOutside, true);
      document.removeEventListener('touchstart', blockOutside, true);
    };
  }, [open]);

  const openSheet = () => {
    setHideSpots(false);
    setHidePin(false);
    setOpen(true);
  };

  const closeSpots = () => {
    dismissHotSpotsMapBanner();
    setSpotsOn(false);
    setHideSpots(true);
    if (!showPin) closeSheet(true);
  };
  const closePin = () => {
    dismissMapPrivacyNote();
    setPinOn(false);
    setHidePin(true);
    if (!showSpots) closeSheet(true);
  };

  const stack = typeof document !== 'undefined'
    ? document.querySelector('[data-testid="map-top-stack"]')
    : null;

  const sheet = open ? (
    <div
      ref={sheetRef}
      className="pointer-events-auto absolute left-1/2 top-full z-40 mt-2 w-[min(26rem,calc(100%-5.5rem))] -translate-x-1/2 overflow-y-auto overscroll-y-contain rounded-2xl border border-[var(--border-default)] bg-[rgba(30,21,8,0.96)] p-2 shadow-lg"
      data-testid="map-short-notes-sheet"
      data-sheet-max-h={maxHeight}
      role="dialog"
      aria-label="Map notes"
      style={{ maxHeight }}
    >
      {showSpots && spotsText ? (
        <div className="relative mb-2 rounded-xl border border-[rgba(196,131,42,0.28)] px-3 py-2 pr-12 last:mb-0">
          <p
            className="whitespace-normal text-left text-[15px] font-semibold leading-snug text-[rgba(240,224,192,0.88)]"
            data-testid="hotspots-map-helper-copy"
          >
            {spotsText}
          </p>
          <button
            type="button"
            data-testid="hotspots-map-helper-dismiss"
            aria-label="Dismiss map disclaimer"
            title="Dismiss"
            onClick={closeSpots}
            className="absolute right-0 top-0 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[20px] leading-none text-[rgba(240,224,192,0.85)]"
          >
            ×
          </button>
        </div>
      ) : null}
      {showPin && pinText ? (
        <div className="relative rounded-xl border border-[rgba(196,131,42,0.28)] px-3 py-2 pr-12">
          <p
            className="whitespace-normal text-left text-[15px] font-medium leading-snug text-[rgba(240,224,192,0.88)]"
            data-testid="map-privacy-note"
          >
            {pinText}
          </p>
          <button
            type="button"
            data-testid="map-privacy-note-close"
            aria-label="Dismiss pin note"
            title="Dismiss"
            onClick={closePin}
            className="absolute right-0 top-0 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[20px] leading-none text-[rgba(240,224,192,0.85)]"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="relative shrink-0" data-testid="map-short-notes">
      <button
        ref={infoRef}
        type="button"
        data-testid="map-short-notes-info"
        aria-label="Map notes"
        aria-expanded={open}
        title="Map notes"
        onClick={() => (open ? closeSheet(true) : openSheet())}
        className="pointer-events-auto relative flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[rgba(196,131,42,0.55)] bg-[rgba(30,21,8,0.92)] text-[17px] font-extrabold text-[#F0E0C0] shadow-md"
      >
        i
        {unread ? (
          <span
            data-testid="map-short-notes-dot"
            className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--copper)]"
            aria-hidden
          />
        ) : null}
      </button>
      {sheet ? createPortal(sheet, stack ?? document.body) : null}
    </div>
  );
}
