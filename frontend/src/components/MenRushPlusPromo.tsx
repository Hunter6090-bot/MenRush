import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';

export function MenRushPlusPromo({ compact = false }: { compact?: boolean }) {
  const isPremium = useAuthStore((s) => s.user?.is_premium);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    usersAPI
      .getReceivedLikesSummary()
      .then((res) => setCount(res.data.count ?? 0))
      .catch(() => setCount(0));
  }, []);

  const label =
    count == null
      ? 'See who liked your profile.'
      : count === 0
        ? 'Boost your visibility on Nearby.'
        : `${count} ${count === 1 ? 'man has' : 'men have'} liked your profile.`;

  const href = count != null && count > 0 && !isPremium ? '/matches' : '/premium';
  const cta =
    count != null && count > 0 && !isPremium ? 'See who in Matches →' : 'MenRush+ perks →';

  if (compact) {
    return (
      <Link
        to={href}
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
      to={href}
      className="block rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] p-3.5 text-left transition-colors hover:bg-[rgba(196,131,42,0.18)]"
    >
      <p className="text-[13px] font-extrabold tracking-[0.08em] text-[#E0A14A]">MENRUSH+</p>
      <p className="mt-1 text-[13px] leading-snug text-[var(--cream-muted)]">
        {isPremium ? 'Manage your premium perks.' : label}
      </p>
      {!isPremium && count != null && count > 0 ? (
        <p className="mt-1 text-[11px] font-semibold text-[#E0A14A]">{cta}</p>
      ) : null}
    </Link>
  );
}
