import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';

export function MenRushPlusPromo() {
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
      ? 'See who liked you.'
      : count === 0
        ? 'Boost your visibility.'
        : `${count} ${count === 1 ? 'man' : 'men'} liked you. See them.`;

  return (
    <Link
      to="/premium"
      className="block rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] p-3.5 text-left transition-colors hover:bg-[rgba(196,131,42,0.18)]"
    >
      <p className="text-[13px] font-extrabold tracking-[0.08em] text-[#E0A14A]">MENRUSH+</p>
      <p className="mt-1 text-[13px] leading-snug text-[var(--cream-muted)]">
        {isPremium ? 'Manage your premium perks.' : label}
      </p>
    </Link>
  );
}
