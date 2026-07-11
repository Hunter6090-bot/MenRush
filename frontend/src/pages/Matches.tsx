import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { profileMetaAPI, usersAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { IconMatches } from '../components/icons';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { getPhotoUrl } from '../components/UserAvatar';
import { PremiumGate } from '../components/PremiumGate';
import { LiveLocationSharingToggle } from '../components/LiveLocationSharingToggle';
import { MatchesLiveMap } from '../components/MatchesLiveMap';

import { useLocationStore } from '../hooks/store';
import { useSocket } from '../hooks/useSocket';
import {
  formatMatchDistanceKm,
  getMatchCoordinates,
  hasVisibleMatchLocation,
} from '../lib/matchLiveLocation';

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
  live_location_sharing?: boolean;
  lat?: number | string | null;
  lng?: number | string | null;
  location_updated_at?: string | null;
  distance_km?: number | string | null;
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
            {hasVisibleMatchLocation(match)
              ? `Live · ${formatMatchDistanceKm(match.distance_km) ?? 'nearby'}`
              : formatMatchedAgo(match.matched_at ?? match.last_message_at) ??
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
  const [sharingLiveLocation, setSharingLiveLocation] = useState(true);
  const navigate = useNavigate();
  const socket = useSocket();
  const lat = useLocationStore((s) => s.lat);
  const lng = useLocationStore((s) => s.lng);

  const fetchMatches = useCallback(async () => {
    try {
      const [matchesRes, likesRes, sharingRes] = await Promise.all([
        usersAPI.getMatches(),
        usersAPI.getReceivedLikesSummary().catch(() => ({ data: { count: 0, is_premium: false } })),
        profileMetaAPI.getLiveLocationSharing().catch(() => ({ data: { enabled: true } })),
      ]);
      setMatches(matchesRes.data);
      setLikesCount(likesRes.data.count ?? 0);
      setSharingLiveLocation(sharingRes.data.enabled !== false);
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

  useEffect(() => {
    if (!socket) return;
    const onMatchLocation = (payload: {
      user_id: string;
      lat: number;
      lng: number;
      updated_at: string;
    }) => {
      setMatches((prev) =>
        prev.map((match) =>
          match.id === payload.user_id
            ? {
                ...match,
                live_location_sharing: true,
                lat: payload.lat,
                lng: payload.lng,
                location_updated_at: payload.updated_at,
              }
            : match,
        ),
      );
    };
    socket.on('match:location', onMatchLocation);
    return () => {
      socket.off('match:location', onMatchLocation);
    };
  }, [socket]);

  const liveMapMatches = useMemo(
    () =>
      matches
        .map((match) => {
          const coords = getMatchCoordinates(match);
          if (!coords) return null;
          return {
            id: match.id,
            name: match.name,
            photo_url: match.photo_url,
            lat: coords.lat,
            lng: coords.lng,
            distance_km: match.distance_km,
          };
        })
        .filter((match): match is NonNullable<typeof match> => match != null),
    [matches],
  );

  const handleSharingToggle = async (enabled: boolean) => {
    setSharingLiveLocation(enabled);
    try {
      await profileMetaAPI.setLiveLocationSharing(enabled);
      if (enabled && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            void usersAPI.updateLocation(coords.latitude, coords.longitude);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
      }
      await fetchMatches();
    } catch {
      setSharingLiveLocation((current) => !current);
      setError('Could not update live location sharing.');
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-4 pb-12 sm:px-6 sm:py-6">
        <div className="mb-6 space-y-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--cream)] lg:text-[28px]">Matches</h1>
            <p className="mt-1 hidden text-sm text-[var(--cream-muted)] lg:block">
              Mutual likes. Live location is on by default — slide the toggle off to pause.
            </p>
            <p className="mt-1 text-sm text-[var(--cream-muted)] lg:hidden">Your mutual connections</p>
          </div>
          <LiveLocationSharingToggle enabled={sharingLiveLocation} onToggle={handleSharingToggle} compact />
        </div>

        {!loading && liveMapMatches.length > 0 ? (
          <div className="mb-6">
            <MatchesLiveMap
              matches={liveMapMatches}
              selfLat={lat}
              selfLng={lng}
              onSelectMatch={(matchId) => navigate(`/messages/${matchId}`)}
            />
          </div>
        ) : null}

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
        ) : matches.length > 0 || likesCount > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-3.5">
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
        ) : (
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
              <Link
                to="/hot-spots"
                className="inline-flex rounded-full border border-[rgba(196,131,42,0.5)] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
              >
                Hot Spots
              </Link>
            </div>
            <p className="mt-5 text-[11px] font-medium tracking-wide text-[#A89070]">
              18+ only · Report underage or abuse anytime
            </p>
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
