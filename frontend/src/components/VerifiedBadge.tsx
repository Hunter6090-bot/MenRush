interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  level?: 'authentic_person' | 'identity_checked';
}

/** Precise trust claim — free for all users and separate from Premium. */
export function VerifiedBadge({ size = 'md', className = '', level = 'identity_checked' }: VerifiedBadgeProps) {
  const pad =
    size === 'lg'
      ? 'px-3 py-1.5 text-[12px]'
      : size === 'md'
        ? 'px-2.5 py-1 text-[11px]'
        : 'px-2 py-0.5 text-[10.5px]';
  const iconSize = size === 'lg' ? 14 : size === 'md' ? 12 : 11;

  return (
    <span
      data-testid="identity-checked-badge"
      title={level === 'identity_checked' ? 'Identity checked' : 'Authentic person'}
      className={`inline-flex items-center gap-1 rounded-full bg-nn-copper/22 text-nn-copper border-2 border-nn-copper font-extrabold uppercase tracking-wide shadow-[0_0_12px_rgba(196,131,42,0.35)] ${pad} ${className}`}
    >
      <CheckIcon size={iconSize} />
      {level === 'identity_checked' ? 'Identity checked' : 'Authentic person'}
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
