/**
 * Easy-to-swap icon slot for Chat Matches / Out Community entries.
 * Final icons come from Claude Design later — keep the wrapper + data attrs stable.
 */
import type { ReactNode } from 'react';

export function EntryIconPlaceholder({
  slot,
  children,
  className = '',
}: {
  /** Stable slot name for design handoff (matches | community). */
  slot: 'matches' | 'community';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(196,131,42,0.2)] text-[var(--copper)] ${className}`}
      data-testid={`${slot}-entry-icon`}
      data-icon-placeholder={slot}
      aria-hidden
    >
      {children}
    </span>
  );
}
