import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { NearbyUser, ProfileCard } from '../components/ProfileCard';
import { PulseRing } from '../components/PulseRing';
import { ROUTE_LABELS } from '../lib/routeLabels';

/**
 * Live list of nearby men. Location-first: never invent a city centre pin.
 * 18+ product — same proximity rules as Discover map.
 */
export const Stream = () => {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLocation, setNeedsLocation] = useState(false);
  /** Mutual match ids — hydrate Match CTA so Stream shows Matched/Open chat. */
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());

  const loadNearby = useCallback(async (latitude: number, longitude: number) => {
    await usersAPI.updateLocation(latitude, longitude).catch(() => {});
    const res = await usersAPI.getNearby(latitude, longitude, 10);
    setUsers(res.data);
    setError('');
    setNeedsLocation(false);
  }, []);

  const requestLocation = useCallback(() => {
    setError('');
    if (!window.isSecureContext) {
      setNeedsLocation(true);
      setLoading(false);
      setError(
        'Location needs HTTPS. Open menrush.com on your phone, then allow location (18+ only).',
      );
      return;
    }
    if (!navigator.geolocation) {
      setNeedsLocation(true);
      setLoading(false);
      setError('This browser cannot share location. Try Chrome or Safari.');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await loadNearby(coords.latitude, coords.longitude);
        } catch {
          setError('Could not load the live profile list right now.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setNeedsLocation(true);
        setLoading(false);
        setError(
          'Allow location to see men near you. MenRush is live proximity — we never place you on a random map.',
        );
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [loadNearby]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Mutual matches → Match CTA state survives reload.
      try {
        const matchesRes = await usersAPI.getMatches();
        if (!cancelled) {
          const ids = (matchesRes.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
          setMatchedIds(new Set(ids));
        }
      } catch {
        /* ignore */
      }

      // 1) Hydrate from last saved pin so list appears quickly.
      try {
        const r = await usersAPI.getMe();
        if (cancelled) return;
        const lat = r.data?.lat != null ? Number(r.data.lat) : NaN;
        const lng = r.data?.lng != null ? Number(r.data.lng) : NaN;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          try {
            await loadNearby(lat, lng);
          } catch {
            /* continue to live GPS */
          }
        }
      } catch {
        /* no profile pin */
      }
      if (cancelled) return;

      // 2) Live GPS — never invent a city pin if both fail.
      if (!window.isSecureContext || !navigator.geolocation) {
        setNeedsLocation(true);
        setLoading(false);
        setError(
          !window.isSecureContext
            ? 'Location needs HTTPS. Open menrush.com, then allow location (18+ only).'
            : 'This browser cannot share location. Try Chrome or Safari.',
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          if (cancelled) return;
          try {
            await loadNearby(coords.latitude, coords.longitude);
          } catch {
            if (!cancelled) setError('Could not load the live profile list right now.');
          } finally {
            if (!cancelled) setLoading(false);
          }
        },
        () => {
          if (cancelled) return;
          // Keep saved-pin results if we already have users; only gate when empty.
          setLoading(false);
          setUsers((prev) => {
            if (prev.length === 0) {
              setNeedsLocation(true);
              setError(
                'Allow location to see men near you. MenRush is live proximity — we never place you on a random map.',
              );
            }
            return prev;
          });
        },
        { enableHighAccuracy: true, timeout: 12000 },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [loadNearby]);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4832A]">Live view</p>
            <h1 className="text-2xl font-bold text-[#F0E0C0]">{ROUTE_LABELS.liveProfileList}</h1>
            <p className="text-sm text-[#A89070] mt-1">
              Who is around right now — list view. 18+ only.
            </p>
          </div>
          <Link
            to="/discover"
            className="rounded-full border border-[#3D2B0E] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#F0E0C0] transition-colors hover:border-[#C4832A] hover:text-[#C4832A]"
          >
            Back to map
          </Link>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <PulseRing size={32} label="Loading live profiles" />
          </div>
        ) : needsLocation ? (
          <div
            className="rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] px-6 py-10 text-center shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
            data-testid="stream-location-gate"
            role="dialog"
            aria-labelledby="stream-location-title"
          >
            <p id="stream-location-title" className="text-[17px] font-extrabold text-[#F0E0C0]">
              Location unlocks the live list
            </p>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[#A89070]">
              {error ||
                'Allow precise location to see men near you. Shared only while you use the app.'}
            </p>
            <button
              type="button"
              onClick={requestLocation}
              className="mt-5 rounded-full bg-[#C4832A] px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            >
              Enable location
            </button>
            <p className="mt-4 text-[11px] text-[#A89070]">Consent first · Report anytime</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#A45E18]/40 bg-[#1E1508] p-5 text-sm text-[#F0E0C0]">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div
            className="rounded-2xl border border-[rgba(196,131,42,0.35)] bg-[rgba(196,131,42,0.08)] px-6 py-10 text-center"
            data-testid="stream-empty"
          >
            <p className="text-[16px] font-extrabold text-[#F0E0C0]">No one nearby yet</p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-[#A89070]">
              Expand radius on the map, start Pulse, or check Hot Spots for live venues.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link
                to="/discover"
                className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03]"
              >
                Open map
              </Link>
              <Link
                to="/hot-spots"
                className="rounded-full border border-[rgba(196,131,42,0.5)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A]"
              >
                Hot Spots
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[#A89070]">18+ only · Be intentional</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <ProfileCard
                key={user.id}
                user={user}
                initiallyMutual={matchedIds.has(user.id)}
                initiallyLiked={matchedIds.has(user.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
