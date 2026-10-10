import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dismissHotSpotsMapBanner, isHotSpotsMapBannerDismissed } from '../lib/hotSpotsMapBanner';
import { dismissMapPrivacyNote, isMapPrivacyNoteDismissed } from './MapPrivacyNote';

/**
 * Short-map access to the 18+ spots note and Discretion pin note.
 * One 44px info button on the pills row. The copper unread dot includes
 * the 18+ note only while the Spots layer is on. Closes write the same
 * dismiss keys as the tall-map cards. Escape and an outside tap close
 * the sheet and return focus to the button.
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
  const infoRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const spotsUnread = Boolean(spotsText) && spotsLayerOn && spotsOn;
  const pinUnread = Boolean(pinText) && pinOn;
  const unread = spotsUnread || pinUnread;

  const closeSheet = (refocus = true) => {
    setOpen(false);
    if (refocus) {
      queueMicrotask(() => infoRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSheet(true);
      }
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (infoRef.current?.contains(target) || sheetRef.current?.contains(target)) return;
      e.preventDefault();
      closeSheet(true);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  if (!unread && !open) return null;

  const closeSpots = () => {
    dismissHotSpotsMapBanner();
    setSpotsOn(false);
    if (!pinUnread) closeSheet(true);
  };
  const closePin = () => {
    dismissMapPrivacyNote();
    setPinOn(false);
    if (!spotsUnread) closeSheet(true);
  };

  const stack = typeof document !== 'undefined'
    ? document.querySelector('[data-testid="map-top-stack"]')
    : null;

  const sheet = open ? (
    <div
      ref={sheetRef}
      className="pointer-events-auto absolute left-1/2 top-full z-40 mt-2 w-[min(26rem,calc(100%-5.5rem))] max-h-[min(11rem,32vh)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[rgba(30,21,8,0.96)] p-2 shadow-lg"
      data-testid="map-short-notes-sheet"
      role="dialog"
      aria-label="Map notes"
    >
      {spotsUnread && spotsText ? (
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
      {pinUnread && pinText ? (
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
        onClick={() => setOpen((v) => !v)}
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
