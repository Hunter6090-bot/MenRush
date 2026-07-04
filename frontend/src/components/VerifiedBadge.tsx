interface VerifiedBadgeProps {
  size?: 'sm' | 'lg';
  className?: string;
}

/** ID verified — free for all users, copper trust signal. */
export function VerifiedBadge({ size = 'sm', className = '' }: VerifiedBadgeProps) {
  const pad = size === 'lg' ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[10.5px]';
  const iconSize = size === 'lg' ? 13 : 11;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-nn-copper/13 text-nn-copper border border-nn-copper/50 font-semibold tracking-wide ${pad} ${className}`}
    >
      <CheckIcon size={iconSize} />
      ID verified
    </span>
  );
}

function CheckIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
