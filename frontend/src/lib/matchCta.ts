/**
 * Match CTA labels for other-user profiles / sheets.
 *
 * - none:      "Match" (active) — tap sends one-way request
 * - outgoing:  "Match" (muted, disabled) — request already sent; NOT mutual
 * - mutual:    "Matched with {displayName}" — both sides matched
 *
 * Never show "Matched" / "Matched with …" for one-way pending.
 */

export type MatchInterestState = 'none' | 'outgoing' | 'mutual';

export function matchInterestState(opts: {
  liked?: boolean;
  mutual?: boolean;
}): MatchInterestState {
  if (opts.mutual) return 'mutual';
  if (opts.liked) return 'outgoing';
  return 'none';
}

export function matchCtaLabel(
  state: MatchInterestState,
  displayName: string,
  opts?: {
    sending?: boolean;
    /** Compact grid/search chips may keep Open chat / Chat for mutual. */
    mutualLabel?: 'matched_with' | 'open_chat' | 'chat';
  },
): string {
  if (opts?.sending) return 'Sending…';
  if (state === 'mutual') {
    const mode = opts?.mutualLabel ?? 'matched_with';
    if (mode === 'open_chat') return 'Open chat';
    if (mode === 'chat') return 'Chat';
    const name = displayName.trim() || 'them';
    return `Matched with ${name}`;
  }
  // none + outgoing both read "Match" — outgoing is muted/disabled in UI
  return 'Match';
}

export function matchCtaDisabled(state: MatchInterestState, sending = false): boolean {
  if (sending) return true;
  // One-way pending: already sent — cannot send again
  return state === 'outgoing';
}

export function matchCtaAriaLabel(
  state: MatchInterestState,
  displayName: string,
  opts?: { mutualOpensChat?: boolean },
): string {
  const name = displayName.trim() || 'them';
  if (state === 'mutual') {
    return opts?.mutualOpensChat
      ? `Matched with ${name}. Open chat`
      : `Matched with ${name}`;
  }
  if (state === 'outgoing') {
    return `Match request already sent to ${name}`;
  }
  return `Match with ${name}`;
}

/** Tailwind class fragments for primary Match CTAs (drawer / full profile). */
export function matchCtaToneClasses(state: MatchInterestState): string {
  if (state === 'mutual') {
    return 'border border-[var(--copper)]/55 bg-[rgba(196,131,42,0.18)] text-[var(--copper)]';
  }
  if (state === 'outgoing') {
    // Gray / faded / muted — still readable when disabled
    return 'border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--cream-muted)] opacity-70 cursor-not-allowed';
  }
  return 'bg-[var(--copper)] text-[var(--nn-on-copper)] hover:bg-[var(--copper-light,#E0A14A)]';
}

/** Compact chip/grid tone classes. */
export function matchCtaCompactToneClasses(state: MatchInterestState): string {
  if (state === 'mutual') {
    return 'border border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.18)] text-[#E0A14A]';
  }
  if (state === 'outgoing') {
    return 'border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--cream-muted)] opacity-70 cursor-not-allowed';
  }
  return 'bg-[#C4832A] text-[#1A0E03] hover:bg-[#E0A14A]';
}
