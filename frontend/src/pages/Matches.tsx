import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { IconMatches } from '../components/icons';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useGridPhotoSrc, clearGridPhotoQueue } from '../lib/nearbyPhotoSrc';
import { ProfilePhotoLink } from '../components/ProfilePhotoLink';
import { PROFILE_TILE_GRID_CLASS } from '../lib/profileTileGrid';
import {
  readCachedMatches,
  refreshMatches,
  type MatchesPerson,
} from '../lib/tabListCache';

type Match = MatchesPerson;
type ReceivedLike = MatchesPerson;

/** Max time to keep cold-start skeletons if the network hangs. */
const COLD_SKELETON_MS = 4500;

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

function formatLikedAgo(iso?: string): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Liked you just now';
  if (mins < 60) return `Liked you ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Liked you ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `Liked you ${days}d ago`;
}

function PersonGridCard({
  person,
  subtitle,
  testId,
  onMessage,
}: {
  person: {
    id: string;
    name: string;
    age: number;
    photo_url?: string | null;
    online?: boolean;
    is_verified?: boolean;
    authenticity_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
  };
  subtitle: string;
  testId?: string;
  /** Dedicated Message control — photo always opens profile. */
  onMessage?: () => void;
}) {
  const { src: photo, phase } = useGridPhotoSrc(person.photo_url ?? undefined, person.age);
  return (
    <div
      data-testid={testId}
      className="group relative overflow-hidden rounded-xl border border-[rgba(196,131,42,0.35)] bg-nn-card text-left shadow-card transition-all hover:-translate-y-[3px] hover:border-[rgba(196,131,42,0.4)] md:rounded-2xl"
    >
      <ProfilePhotoLink
        userId={person.id}
        name={person.name}
        className="block"
        data-testid={testId ? `${testId}-photo` : `match-photo-${person.id}`}
      >
        <div className="relative aspect-[3/3.6] w-full bg-[var(--bg-elevated)]">
          {/*
            Progressive media: name/chrome paint immediately. Photo fills when
            ready — never gate the card on full image decode.
          */}
          {photo && phase !== 'loading' ? (
            <img
              src={photo}
              alt={person.name}
              className="h-full w-full object-cover"
              decoding="async"
              data-testid="match-grid-photo"
              data-photo-phase={phase}
            />
          ) : (
            <div
              className="flex h-full items-center justify-center"
              data-testid="match-grid-photo-pending"
              data-photo-phase={phase}
              aria-hidden
            >
              <SilhouetteAvatar size={56} variant="card" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(13,10,6,0.94)] via-[rgba(13,10,6,0.55)] to-transparent px-1.5 pb-1.5 pt-8 md:px-3 md:pb-2.5 md:pt-10">
            <div className="flex items-center gap-0.5 md:gap-1.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full md:h-2 md:w-2 ${person.online ? 'bg-[#4ADE80]' : 'bg-[#C4A882]'}`}
              />
              <span className="truncate text-[11px] font-bold leading-tight text-[#FFF6E6] md:text-[12px] lg:text-[13px]">
                {person.name} {person.age}
              </span>
              {person.is_verified ? (
                <VerifiedBadge size="sm" />

              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[9px] font-semibold text-[var(--cream)] md:text-xs">{subtitle}</p>
          </div>
        </div>
      </ProfilePhotoLink>
      {onMessage ? (
        <div className="border-t border-[var(--border-default)] p-1 md:p-1.5">
          <button
            type="button"
            onClick={onMessage}
            data-testid={`match-message-${person.id}`}
            className="w-full rounded-lg border border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.18)] py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#E0A14A] transition-colors hover:bg-[rgba(196,131,42,0.28)] md:rounded-xl md:py-2 md:text-[11px]"
          >
            Message
          </button>
        </div>
      ) : null}
    </div>
  );
}

function readInitialMatches(): {
  matches: Match[];
  likes: ReceivedLike[];
  hasCache: boolean;
} {
  const cached = readCachedMatches();
  if (!cached) return { matches: [], likes: [], hasCache: false };
  return { matches: cached.matches, likes: cached.likes, hasCache: true };
}

export const Matches = () => {
  const initial = readInitialMatches();
  const [matches, setMatches] = useState<Match[]>(() => initial.matches);
  const [receivedLikes, setReceivedLikes] = useState<ReceivedLike[]>(() => initial.likes);
  // Skeleton only on true cold start — never when last-known rows exist.
  const [loading, setLoading] = useState(() => !initial.hasCache);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const hungRef = useRef(false);

  const applySnapshot = useCallback(
    (snap: { matches: MatchesPerson[]; likes: MatchesPerson[] }) => {
      setMatches(snap.matches);
      setReceivedLikes(snap.likes);
      setError('');
      setLoading(false);
    },
    [],
  );

  const fetchMatches = useCallback(async () => {
    // Paint mutual matches as soon as that API returns — do not wait on likes
    // (iPhone was sitting on a full-page skeleton for 25–30s while photos/likes lagged).
    // Shared refreshMatches() also writes the warm cache for tab remounts.
    try {
      const snap = await refreshMatches();
      applySnapshot(snap);
    } catch {
      const cached = readCachedMatches();
      if (cached) {
        applySnapshot(cached);
        return;
      }
      setError('Could not load matches.');
      setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    // Drop Discover's pending multi‑MB photo jobs so Matches tiles get the queue.
    clearGridPhotoQueue();
    void fetchMatches();
  }, [fetchMatches]);

  // Cold start hang: do not leave blank placeholders forever.
  useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => {
      if (hungRef.current) return;
      hungRef.current = true;
      const cached = readCachedMatches();
      if (cached && (cached.matches.length > 0 || cached.likes.length > 0)) {
        applySnapshot(cached);
        return;
      }
      setLoading(false);
      setError((prev) => prev || 'Could not load matches.');
    }, COLD_SKELETON_MS);
    return () => window.clearTimeout(id);
  }, [loading, applySnapshot]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchMatches();
    }, 20000);
    return () => window.clearInterval(id);
  }, [fetchMatches]);

  const isEmpty = matches.length === 0 && receivedLikes.length === 0;

  return (
    <Layout>
      <div className="mx-auto min-w-0 max-w-6xl overflow-x-clip px-4 py-4 pb-12 sm:px-6 sm:py-6" data-testid="matches-shell">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[var(--cream)] lg:text-[28px]">Matches</h1>
          <p className="mt-1 text-sm text-[var(--cream-muted)]">
            Who liked you and mutual matches. Location is only shared when you send a pin in chat.
          </p>
        </div>

        {loading ? (
          <div className={PROFILE_TILE_GRID_CLASS} data-testid="matches-skeleton">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="aspect-[3/3.6] animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]"
              />
            ))}
          </div>
        ) : error && isEmpty ? (
          <div className="py-12 text-center" data-testid="matches-error">
            <p className="text-sm text-[var(--cream-muted)]">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError('');
                hungRef.current = false;
                void fetchMatches();
              }}
              className="mt-4 rounded-full border border-[rgba(196,131,42,0.5)] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A]"
            >
              Try again
            </button>
          </div>
        ) : isEmpty ? (
          <div
            className="rounded-3xl border border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.06)] py-16 px-6 text-center shadow-[0_12px_32px_rgba(0,0,0,0.3)]"
            data-testid="matches-empty"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(196,131,42,0.12)]">
              <IconMatches size={32} className="text-[var(--copper)]/50" />
            </div>
            <h2 className="text-lg font-bold text-[var(--cream)]">No matches yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--cream-muted)]">
              Tap Match on Nearby or Community. When it&apos;s mutual, they land here — ready to
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
                Community
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-8" data-testid="matches-list">
            {receivedLikes.length > 0 ? (
              <section data-testid="likes-you-section" aria-labelledby="likes-you-heading">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2
                    id="likes-you-heading"
                    className="text-lg font-extrabold text-[var(--cream)]"
                  >
                    Liked you
                  </h2>
                  <p className="text-xs font-semibold text-[var(--cream-muted)]">
                    {receivedLikes.length === 1
                      ? '1 man liked you'
                      : `${receivedLikes.length} men liked you`}
                  </p>
                </div>
                <div className={PROFILE_TILE_GRID_CLASS}>
                  {receivedLikes.map((like) => (
                    <PersonGridCard
                      key={like.id}
                      person={like}
                      subtitle={
                        formatLikedAgo(like.liked_at) ??
                        (like.online ? 'Active now' : 'Liked you')
                      }
                      testId={`liker-card-${like.id}`}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {matches.length > 0 ? (
              <section data-testid="mutual-matches-section" aria-labelledby="mutual-matches-heading">
                {receivedLikes.length > 0 ? (
                  <h2
                    id="mutual-matches-heading"
                    className="mb-3 text-lg font-extrabold text-[var(--cream)]"
                  >
                    Mutual matches
                  </h2>
                ) : null}
                <div className={PROFILE_TILE_GRID_CLASS}>
                  {matches.map((match) => (
                    <PersonGridCard
                      key={match.id}
                      person={match}
                      subtitle={
                        formatMatchedAgo(match.matched_at ?? match.last_message_at) ??
                        (match.online ? 'Active now' : 'Last seen recently')
                      }
                      testId={`match-card-${match.id}`}
                      onMessage={() => navigate(`/messages/${match.id}`)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </Layout>
  );
};
