interface VerifiedBadgeProps {
  size?: 'sm' | 'lg';
  className?: string;
}

/** Single optional Veriff mark — free for all users and separate from Premium. */
export function VerifiedBadge({ size = 'sm', className = '' }: VerifiedBadgeProps) {
  // Slightly larger/heavier than a plain pill so the mark reads on dense profile cards.
  // Brand owns the badge word; until Brand names it, keep this existing Verified mark only.
  const pad = size === 'lg' ? 'px-3.5 py-1.5 text-[13px]' : 'px-2.5 py-1 text-[11.5px]';
  const iconSize = size === 'lg' ? 14 : 12;

  return (
    <span
      data-testid="identity-checked-badge"
      className={`inline-flex items-center gap-1 rounded-full bg-nn-copper/18 text-nn-copper border border-nn-copper/65 font-bold tracking-wide shadow-[0_0_0_1px_rgba(196,131,42,0.12)] ${pad} ${className}`}
    >
      <CheckIcon size={iconSize} />
      Identity checked
    </span>
  );
}

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
