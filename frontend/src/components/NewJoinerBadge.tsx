import { NEW_JOINER_HELPER, NEW_JOINER_LABEL } from '../lib/newJoiner';

interface NewJoinerBadgeProps {
  /** `chip` = grid card corner; `dot` = compact map pin corner. */
  variant?: 'chip' | 'dot';
  className?: string;
}

/**
 * Nearby NEW treatment — Brand-locked pill `NEW`, helper `Just joined`.
 * Same face for newly joined and visitor fresh-face (Brand confirmed — no visitor-only copy).
 * Chat inbox NEW stays parked.
 */
export function NewJoinerBadge({ variant = 'chip', className = '' }: NewJoinerBadgeProps) {
  if (variant === 'dot') {
    return (
      <span
        className={`pointer-events-none absolute -right-0.5 -top-0.5 z-10 rounded-full border border-[#1A0E03] bg-[#C4832A] px-1 py-px text-[7px] font-extrabold uppercase leading-none tracking-wide text-[#1A0E03] shadow-sm ${className}`}
        data-testid="nearby-new-badge"
        title={NEW_JOINER_HELPER}
        aria-label={NEW_JOINER_HELPER}
      >
        {NEW_JOINER_LABEL}
      </span>
    );
  }

  return (
    <span
      className={`pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-md bg-[#C4832A] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[#1A0E03] shadow-md md:left-2 md:top-2 md:text-[10px] ${className}`}
      data-testid="nearby-new-badge"
      title={NEW_JOINER_HELPER}
      aria-label={NEW_JOINER_HELPER}
    >
      {NEW_JOINER_LABEL}
    </span>
  );
}
