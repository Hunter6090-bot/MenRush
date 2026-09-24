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
}

/**
 * Display only for an approved Veriff identity check.
 * Tick treatment only (no “Verified” word chip) — same face as Discovery/Nearby.
 */
export function VerifiedBadge({ size = 'sm', className = '' }: VerifiedBadgeProps) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const box = size === 'lg' ? 'h-8 w-8' : 'h-7 w-7';
  const icon = size === 'lg' ? 16 : 14;
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        aria-label="Verified. Optional ID checked through Veriff. Not the signup age gate."
        aria-expanded={open}
        aria-controls={descriptionId}
        onClick={(event) => { event.stopPropagation(); setOpen(!open); }}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') setOpen(false); }}
        onBlur={() => setOpen(false)}
        className={`inline-flex ${box} items-center justify-center rounded-full border-2 border-[#FFF6E6] bg-[#C4832A] text-[#1A0E03] shadow-md font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--copper)]`}
      >
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </button>
      {open ? createPortal(<span id={descriptionId} role="status" className="fixed bottom-24 left-1/2 z-[200] w-64 max-w-[90vw] -translate-x-1/2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-xs font-medium leading-5 text-[var(--cream)] shadow-lg">Optional ID checked through Veriff. Separate from the signup 18+ selfie age gate.</span>, document.body) : null}
    </span>
  );
}
