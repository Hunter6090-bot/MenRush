import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { IconMatches } from '../components/icons';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useResolvingPhotoSrc } from '../components/UserAvatar';
import { PremiumGate } from '../components/PremiumGate';

interface Match {
  id: string;
  name: string;
  age: number;
  bio?: string;
  photo_url?: string;
  online: boolean;
  last_seen?: string;
  last_message?: string;
  last_message_at?: string;
  matched_at?: string;
  is_verified?: boolean;
  authenticity_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
}

function formatMatchedAgo(iso?: string): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Matched just now';
  if (mins < 60) return `Matched ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Matched ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Matched ${days}d ago`;
}

function MatchGridCard({ match, onClick }: { match: Match; onClick: () => void }) {
  const { src: photo, onError } = useResolvingPhotoSrc(match.photo_url, match.age);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-[rgba(196,131,42,0.35)] bg-nn-card text-left shadow-card transition-all hover:-translate-y-[3px] hover:border-[rgba(196,131,42,0.4)]"
    >
      <div className="relative aspect-[3/3.6] w-full bg-[var(--bg-elevated)]">
        {photo ? (
          <img src={photo} alt={match.name} className="h-full w-full object-cover" onError={onError} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <SilhouetteAvatar size={80} variant="card" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(13,10,6,0.94)] via-[rgba(13,10,6,0.55)] to-transparent px-3 pb-2.5 pt-10">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${match.online ? 'bg-[#4ADE80]' : 'bg-[#C4A882]'}`}
            />
            <span className="truncate text-[15px] font-bold text-[#FFF6E6]">
              {match.name} {match.age}
            </span>
            {match.is_verified ? <VerifiedBadge size="sm" /> : match.authenticity_status === 'verified' ? <VerifiedBadge size="sm" level="authentic_person" /> : null}
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-[#F0E0C0]">
            {formatMatchedAgo(match.matched_at ?? match.last_message_at) ??
              (match.online ? 'Active now' : 'Last seen recently')}
          </p>
        </div>
      </div>
    </button>
  );
}

function PremiumUpsellTile({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.06)] p-6 text-center transition-colors hover:bg-[rgba(196,131,42,0.12)]"
    >
      <span className="text-3xl font-black text-[#E0A14A]">+{Math.min(count, 9)}</span>
      <p className="mt-2 text-[15px] font-bold text-[var(--cream)]">
        {count === 1 ? '1 man liked you.' : `${count} men liked you.`} See them.
      </p>
      <span className="mt-3 text-[13px] font-extrabold uppercase tracking-[0.12em] text-[var(--copper)]">
        MENRUSH+
      </span>
    </button>
  );
}

export const Matches = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [premiumOpen, setPremiumOpen] = useState(false);
  const navigate = useNavigate();

  const fetchMatches = useCallback(async () => {
    try {
      const [matchesRes, likesRes] = await Promise.all([
        usersAPI.getMatches(),
        usersAPI.getReceivedLikesSummary().catch(() => ({ data: { count: 0, is_premium: false } })),
      ]);
      setMatches(matchesRes.data);
      setLikesCount(likesRes.data.count ?? 0);
      setError('');
    } catch {
      setError('Could not load matches.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchMatches();
    }, 20000);
    return () => window.clearInterval(id);
  }, [fetchMatches]);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-4 pb-12 sm:px-6 sm:py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[var(--cream)] lg:text-[28px]">Matches</h1>
          <p className="mt-1 text-sm text-[var(--cream-muted)]">
            Mutual likes. Location is only shared when you send a pin in chat.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-3.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/3.6] animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]" />
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--cream-muted)]">{error}</p>
          </div>
        ) : matches.length === 0 && likesCount === 0 ? (
          <div
            className="rounded-3xl border border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.06)] py-16 px-6 text-center shadow-[0_12px_32px_rgba(0,0,0,0.3)]"
            data-testid="matches-empty"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(196,131,42,0.12)]">
              <IconMatches size={32} className="text-[var(--copper)]/50" />
            </div>
            <h2 className="text-lg font-bold text-[var(--cream)]">No matches yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--cream-muted)]">
              Tap Match on Nearby or the live list. When it&apos;s mutual, they land here — ready to
              chat. Be direct. Consent first.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Link
                to="/discover"
                className="inline-flex rounded-full bg-[#C4832A] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
              >
                Nearby map
              </Link>
              <Link
                to="/stream"
                className="inline-flex rounded-full border border-[rgba(196,131,42,0.5)] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
              >
                Live list
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-3.5">
            {likesCount > 0 ? (
              <PremiumUpsellTile count={likesCount} onClick={() => setPremiumOpen(true)} />
            ) : null}
            {matches.map((match) => (
              <MatchGridCard
                key={match.id}
                match={match}
                onClick={() => navigate(`/messages/${match.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {premiumOpen ? (
        <PremiumGate
          headline={likesCount === 1 ? '1 man liked you.' : `${likesCount} men liked you.`}
          subline="See them. Open chat. Skip the queue."
          onClose={() => setPremiumOpen(false)}
          onUnlock={() => navigate('/premium')}
        />
      ) : null}
    </Layout>
  );
};
