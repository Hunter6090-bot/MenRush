import { useId, useState } from 'react';
import { createPortal } from 'react-dom';

interface VerifiedBadgeProps {
  size?: 'sm' | 'lg';
  className?: string;
  compact?: boolean;
}

/** Display only for an approved Veriff identity check. */
export function VerifiedBadge({ size = 'sm', className = '', compact = false }: VerifiedBadgeProps) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  return (
    <span className={`inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        aria-label="Verified — optional ID checked through Veriff (not the signup age gate)"
        aria-expanded={open}
        aria-controls={descriptionId}
        onClick={(event) => { event.stopPropagation(); setOpen(!open); }}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') setOpen(false); }}
        onBlur={() => setOpen(false)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--copper)] ${compact
          ? 'h-7 w-7 border-2 border-[#FFF6E6] bg-[#C4832A] text-[#1A0E03] shadow-md'
          : `border border-[var(--copper)]/50 bg-[var(--copper)]/10 px-2.5 py-1 text-[var(--copper)] ${size === 'lg' ? 'text-sm' : 'text-xs'}`}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
        {compact ? null : 'Verified'}
      </button>
      {open ? createPortal(<span id={descriptionId} role="status" className="fixed bottom-24 left-1/2 z-[200] w-64 max-w-[90vw] -translate-x-1/2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-xs font-medium leading-5 text-[var(--cream)] shadow-lg">Optional ID checked through Veriff. Separate from the signup 18+ selfie age gate.</span>, document.body) : null}
    </span>
  );
}
