import { useId, useState } from 'react';
import { createPortal } from 'react-dom';

interface VerifiedBadgeProps {
  size?: 'sm' | 'lg';
  className?: string;
  /**
   * @deprecated Always tick — one Veriff system app-wide (Discovery/Nearby/Matches).
   * Kept so call sites stay compatible; word chip removed.
   */
  compact?: boolean;
  /**
   * overlay (default): bright tick with shadow for photos.
   * surface: theme accent text token for plain card surfaces (light and dark).
   */
  tone?: 'overlay' | 'surface';
}

/**
 * Display only for an approved Veriff identity check.
 * Tick only — no circular badge/ring around the mark (Pete lock).
 */
export function VerifiedBadge({ size = 'sm', className = '', tone = 'overlay' }: VerifiedBadgeProps) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const icon = size === 'lg' ? 22 : 18;
  // 44x44 tap target around the tick; negative margins keep the visible layout at the tick size.
  const hit = size === 'lg' ? 'h-11 w-11 -m-[11px]' : 'h-11 w-11 -m-[13px]';
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        aria-label="Verified. Optional ID checked through Veriff. Not the signup age gate."
        aria-expanded={open}
        aria-controls={descriptionId}
        data-testid="verified-tick"
        onClick={(event) => { event.stopPropagation(); setOpen(!open); }}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') setOpen(false); }}
        onBlur={() => setOpen(false)}
        className={`relative ${hit} inline-flex items-center justify-center bg-transparent p-0 ${
          tone === 'surface'
            ? 'text-[var(--nn-accent-text)]'
            : 'text-[#E0A14A] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]'
        } font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--copper)]`}
      >
        {tone === 'surface' ? (
          // Invisible 44x44 hit area centred on the tick; the visible tick keeps its size.
          <span aria-hidden="true" data-testid="verified-tick-hit" className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2" />
        ) : null}
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </button>
      {open ? createPortal(<span id={descriptionId} role="status" className="fixed bottom-24 left-1/2 z-[200] w-64 max-w-[90vw] -translate-x-1/2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-[15px] font-medium leading-5 text-[var(--cream)] shadow-lg">Optional ID checked through Veriff. Separate from the signup 18+ selfie age gate.</span>, document.body) : null}
    </span>
  );
}
