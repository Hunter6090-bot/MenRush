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
 * Discretion pin note. Closeable (44px) so it cannot own the pinned footer
 * on a short or landscape map.
 */
export function MapPrivacyNote({ text }: { text: string }) {
  const [open, setOpen] = useState(() => !readDismissed());
  if (!open) return null;
  return (
    <div
      className="pointer-events-auto relative mx-auto mb-1 w-fit max-w-[min(90%,320px)] rounded-full py-1 pl-3 pr-11 text-[15px] font-medium leading-snug"
      style={{
        background: 'rgba(13,10,6,0.72)',
        color: 'rgba(240,224,192,0.85)',
        border: '1px solid rgba(196,131,42,0.25)',
      }}
      data-testid="map-privacy-note-card"
      role="status"
    >
      <p className="text-center text-[15px]" data-testid="map-privacy-note">
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
        className="absolute right-0 top-1/2 flex h-11 w-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full text-[20px] leading-none text-[rgba(240,224,192,0.85)]"
      >
        ×
      </button>
    </div>
  );
}
