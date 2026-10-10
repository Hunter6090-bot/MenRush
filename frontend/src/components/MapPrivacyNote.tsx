import { useState } from 'react';

const SESSION_KEY = 'menrush_map_privacy_note_dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Discretion pin note. Compact, closeable (44px). The card is paint-only;
 * only the close button captures taps so map pins stay hittable.
 */
export function MapPrivacyNote({ text }: { text: string }) {
  const [open, setOpen] = useState(() => !readDismissed());
  if (!open) return null;
  return (
    <div className="pointer-events-none flex justify-center px-2" data-testid="map-privacy-note-wrap">
      <div
        className="pointer-events-none relative w-fit max-w-[220px] rounded-full py-0.5 pl-2.5 pr-10 text-[15px] font-medium leading-tight"
        style={{
          background: 'rgba(13,10,6,0.72)',
          color: 'rgba(240,224,192,0.85)',
          border: '1px solid rgba(196,131,42,0.25)',
        }}
        data-testid="map-privacy-note-card"
        role="status"
      >
        <p className="pointer-events-none truncate text-center text-[15px]" data-testid="map-privacy-note">
          {text}
        </p>
        <button
          type="button"
          data-testid="map-privacy-note-close"
          aria-label="Dismiss pin note"
          title="Dismiss"
          onClick={() => {
            try {
              sessionStorage.setItem(SESSION_KEY, '1');
            } catch {
              /* ignore */
            }
            setOpen(false);
          }}
          className="pointer-events-auto absolute right-0 top-1/2 flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full text-[20px] leading-none text-[rgba(240,224,192,0.85)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
