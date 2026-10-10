import { useState } from 'react';

export const MAP_PRIVACY_NOTE_DISMISS_KEY = 'menrush_map_privacy_note_dismissed';

export function isMapPrivacyNoteDismissed(): boolean {
  try {
    return sessionStorage.getItem(MAP_PRIVACY_NOTE_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissMapPrivacyNote(): void {
  try {
    sessionStorage.setItem(MAP_PRIVACY_NOTE_DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Discretion pin note. Compact, closeable (44px). The card is paint-only;
 * only the close button captures taps so map pins stay hittable. Text wraps
 * so the metre figures stay visible.
 */
export function MapPrivacyNote({ text }: { text: string }) {
  const [open, setOpen] = useState(() => !isMapPrivacyNoteDismissed());
  if (!open) return null;
  return (
    <div className="pointer-events-none flex justify-center px-2" data-testid="map-privacy-note-wrap">
      <div
        className="pointer-events-none relative w-fit max-w-[min(90%,20rem)] rounded-2xl py-1.5 pl-3 pr-12 text-[15px] font-medium leading-snug"
        style={{
          background: 'rgba(13,10,6,0.72)',
          color: 'rgba(240,224,192,0.85)',
          border: '1px solid rgba(196,131,42,0.25)',
        }}
        data-testid="map-privacy-note-card"
        role="status"
      >
        <p
          className="pointer-events-none whitespace-normal break-words text-center text-[15px] leading-snug"
          data-testid="map-privacy-note"
        >
          {text}
        </p>
        <button
          type="button"
          data-testid="map-privacy-note-close"
          aria-label="Dismiss pin note"
          title="Dismiss"
          onClick={() => {
            dismissMapPrivacyNote();
            setOpen(false);
          }}
          className="pointer-events-auto absolute right-0 top-0 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[20px] leading-none text-[rgba(240,224,192,0.85)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
