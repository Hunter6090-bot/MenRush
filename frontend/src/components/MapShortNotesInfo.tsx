import { useState } from 'react';
import { createPortal } from 'react-dom';
import { dismissHotSpotsMapBanner, isHotSpotsMapBannerDismissed } from '../lib/hotSpotsMapBanner';
import { dismissMapPrivacyNote, isMapPrivacyNoteDismissed } from './MapPrivacyNote';

/**
 * Short-map access to the 18+ spots note and Discretion pin note.
 * One 44px info button on the pills row; a copper dot while either note
 * is still unread. Closes write the same dismiss keys as the tall-map cards.
 */
export function MapShortNotesInfo({
  spotsText,
  pinText,
}: {
  spotsText?: string | null;
  pinText?: string | null;
}) {
  const [spotsOn, setSpotsOn] = useState(() => Boolean(spotsText) && !isHotSpotsMapBannerDismissed());
  const [pinOn, setPinOn] = useState(() => Boolean(pinText) && !isMapPrivacyNoteDismissed());
  const [open, setOpen] = useState(false);

  const unread = spotsOn || pinOn;
  if (!unread && !open) return null;

  const closeSpots = () => {
    dismissHotSpotsMapBanner();
    setSpotsOn(false);
    if (!pinOn) setOpen(false);
  };
  const closePin = () => {
    dismissMapPrivacyNote();
    setPinOn(false);
    if (!spotsOn) setOpen(false);
  };

  const stack = typeof document !== 'undefined'
    ? document.querySelector('[data-testid="map-top-stack"]')
    : null;

  const sheet = open ? (
    <div
      className="pointer-events-auto absolute left-3 right-14 top-full z-30 mt-2 max-h-[min(14rem,40vh)] overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[rgba(30,21,8,0.96)] p-2 shadow-lg"
      data-testid="map-short-notes-sheet"
      role="dialog"
      aria-label="Map notes"
    >
      {spotsOn && spotsText ? (
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
      {pinOn && pinText ? (
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
