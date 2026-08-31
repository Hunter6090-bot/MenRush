import { Link } from 'react-router-dom';
import { useAuthStore } from '../hooks/store';

/**
 * Sidebar MenRush+ promo. Incoming likes are free on Matches — do not use
 * "see who liked you" copy that implies a paywall.
 */
export function MenRushPlusPromo({ compact = false }: { compact?: boolean }) {
  const isPremium = useAuthStore((s) => s.user?.is_premium);

  if (compact) {
    return (
      <Link
        to="/premium"
        title="MenRush+"
        aria-label="MenRush+"
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.12)] text-[11px] font-black tracking-tight text-[#E0A14A] transition-colors hover:bg-[rgba(196,131,42,0.22)]"
      >
        +
      </Link>
    );
  }

  return (
    <Link
      to="/premium"
      className="block rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] p-3.5 text-left transition-colors hover:bg-[rgba(196,131,42,0.18)]"
    >
      <p className="text-[13px] font-extrabold tracking-[0.08em] text-[#E0A14A]">MENRUSH+</p>
      <p className="mt-1 text-[13px] leading-snug text-[var(--cream-muted)]">
        {isPremium
          ? 'Manage your premium perks.'
          : 'Boost visibility, expand radius, and unlock premium filters.'}
      </p>
    </Link>
  );
}
