import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { ConversationItem } from '../components/ConversationItem';
import { IconMatches } from '../components/icons';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { getPhotoUrl } from '../components/UserAvatar';
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
  const photo = getPhotoUrl(match.photo_url);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-[rgba(196,131,42,0.35)] bg-nn-card text-left shadow-card transition-all hover:-translate-y-[3px] hover:border-[rgba(196,131,42,0.4)]"
    >
      <div className="relative aspect-[3/3.6] w-full bg-[var(--bg-elevated)]">
        {photo ? (
          <img src={photo} alt={match.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <SilhouetteAvatar size={80} variant="card" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(13,10,6,0.92)] to-transparent px-3 pb-2.5 pt-10">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${match.online ? 'bg-[var(--status-online)]' : 'bg-[var(--cream-muted)]'}`}
            />
            <span className="truncate text-[15px] font-bold text-[var(--cream)]">
              {match.name} {match.age}
            </span>
            {match.is_verified ? <VerifiedBadge size="sm" /> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-[#E0A14A]">
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

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const [matchesRes, likesRes] = await Promise.all([
          usersAPI.getMatches(),
          usersAPI.getReceivedLikesSummary().catch(() => ({ data: { count: 0, is_premium: false } })),
        ]);
        setMatches(matchesRes.data);
        setLikesCount(likesRes.data.count ?? 0);
      } catch {
        setError('Could not load matches.');
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-6 pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[var(--cream)] lg:text-[28px]">Matches</h1>
          <p className="mt-1 hidden text-sm text-[var(--cream-muted)] lg:block">
            Mutual likes. Chat&apos;s open.
          </p>
          <p className="mt-1 text-sm text-[var(--cream-muted)] lg:hidden">Your mutual connections</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/3.6] animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]" />
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-[var(--cream-muted)]">{error}</p>
          </div>
        ) : matches.length > 0 || likesCount > 0 ? (
          <>
            <div className="hidden grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5 lg:grid">
              {matches.map((match) => (
                <MatchGridCard
                  key={match.id}
                  match={match}
                  onClick={() => navigate(`/messages/${match.id}`)}
                />
              ))}
              {likesCount > 0 ? (
                <PremiumUpsellTile count={likesCount} onClick={() => setPremiumOpen(true)} />
              ) : null}
            </div>
            <div className="flex flex-col gap-3 lg:hidden">
              {matches.map((match) => (
                <ConversationItem
                  key={match.id}
                  userId={match.id}
                  name={match.name}
                  photoUrl={match.photo_url}
                  online={match.online}
                  lastMessageTime={match.last_message_at}
                  lastMessage={match.last_message ?? (match.online ? 'Active now' : 'Tap to open chat')}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] py-24 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(196,131,42,0.1)]">
              <IconMatches size={32} className="text-[var(--copper)]/40" />
            </div>
            <h2 className="text-lg font-bold text-[var(--cream)]">No matches yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--cream-muted)]">
              Match people on Nearby. When it&apos;s mutual, they show up here.
            </p>
            <Link
              to="/discover"
              className="mr-cta-gradient mt-6 inline-flex rounded-full px-6 py-2.5 text-sm font-semibold text-[#1A0E03]"
            >
              Go to Nearby
            </Link>
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
