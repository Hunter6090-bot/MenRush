/**
 * Out tab: venues, events, cruise spots, community.
 * Chips: All / Sauna / Bar / Event / Community.
 * Cruising spot search lives here (moved off the map, Pete 8 Oct 2026).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { eventsAPI, hotSpotsAPI, onLocationSaved, type EventDTO, type HotSpotDTO } from '../api/client';
import { Layout } from '../components/Layout';
import { PulseRing } from '../components/PulseRing';
import { CommunityFeed } from '../components/CommunityFeed';
import { CruisingSearchBar } from '../components/CruisingSearchBar';
import { CruisingSearchSheet } from '../components/CruisingSearchSheet';
import { HotSpotReviewsModal } from '../components/HotSpotReviewsModal';
import { HotSpotSheet } from '../components/HotSpotSheet';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { spotAfterCheckToggle } from '../lib/hotSpotCounts';
import { formatDistanceFromKm } from '../lib/localeUnits';
import { getDirectionsUrl } from '../lib/cruising';
import { IconCommunity, SpotTypeIcon, spotTypeKey } from '../components/icons';

type OutChip = 'all' | 'sauna' | 'bar' | 'event' | 'community';

const CHIPS: { id: OutChip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sauna', label: 'Sauna' },
  { id: 'bar', label: 'Bar' },
  { id: 'event', label: 'Event' },
  { id: 'community', label: 'Community' },
];

function spotMatchesChip(spot: HotSpotDTO, chip: OutChip): boolean {
  if (chip === 'all') return true;
  if (chip === 'event' || chip === 'community') return false;
  const slug = (spot.category_slug || '').toLowerCase();
  const name = (spot.category_name || '').toLowerCase();
  if (chip === 'sauna') return slug.includes('sauna') || name.includes('sauna');
  if (chip === 'bar') {
    return (
      slug.includes('bar') ||
      slug.includes('nightlife') ||
      name.includes('bar') ||
      name.includes('night')
    );
  }
  return true;
}

function sectionFromParam(raw: string | null): OutChip {
  if (!raw) return 'all';
  const v = raw.toLowerCase();
  if (v === 'sauna' || v === 'saunas') return 'sauna';
  if (v === 'bar' || v === 'bars' || v === 'nightlife') return 'bar';
  if (v === 'event' || v === 'events') return 'event';
  if (v === 'community' || v === 'stream') return 'community';
  if (v === 'cruise' || v === 'hot-spots' || v === 'hotspots') return 'all';
  if (CHIPS.some((c) => c.id === v)) return v as OutChip;
  return 'all';
}

export function Out() {
  const [params, setParams] = useSearchParams();
  const chip = sectionFromParam(params.get('section') || params.get('chip'));
  const { lat, lng } = useLocationStore();
  const [spots, setSpots] = useState<HotSpotDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cruisingSearchOpen, setCruisingSearchOpen] = useState(false);
  const [actingSpotId, setActingSpotId] = useState<string | null>(null);
  const [reviewsSpot, setReviewsSpot] = useState<HotSpotDTO | null>(null);
  // Tapping a card opens the same spot sheet the map pin opens (lose-nothing fix, 10 Oct).
  const [sheetSpotId, setSheetSpotId] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState('');
  const isPremium = useAuthStore((s) => Boolean(s.user?.is_premium));
  const navigate = useNavigate();
  // Last copy of the open spot, so a list refresh that drops it does not slam the sheet shut.
  const sheetSnapshotRef = useRef<HotSpotDTO | null>(null);
  const sheetSpot = useMemo(() => {
    if (!sheetSpotId) {
      sheetSnapshotRef.current = null;
      return null;
    }
    const live = spots.find((s) => s.id === sheetSpotId) ?? null;
    if (live) sheetSnapshotRef.current = live;
    return live ?? (sheetSnapshotRef.current?.id === sheetSpotId ? sheetSnapshotRef.current : null);
  }, [spots, sheetSpotId]);

  const replaceSpot = useCallback((updated: HotSpotDTO) => {
    setSpots((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
  }, []);

  // Quiet re-read of the list after a check-in or check-out (no spinner, the sheet stays
  // open). Counts come from the server, which leaves out Ghost and hidden members (#368).
  const refreshSpots = useCallback(async () => {
    if (lat == null || lng == null || chip === 'community' || chip === 'event') return;
    try {
      const res = await hotSpotsAPI.listNearby(lat, lng, 80);
      setSpots(res.data.spots ?? []);
    } catch {
      /* keep the server spot we already merged */
    }
  }, [lat, lng, chip]);

  // Same check-in / check-out calls the map sheet uses (Discover handleHotSpotCheckIn).
  const handleCheckIn = useCallback(
    async (spot: HotSpotDTO, anonymous: boolean) => {
      setActingSpotId(spot.id);
      setSheetError('');
      try {
        // Server count only, same as the map sheet: no client +1 / -1, which is
        // wrong for a Ghost or hidden viewer who is never counted (#368).
        if (spot.is_checked_in) {
          const res = await hotSpotsAPI.checkOut(spot.id);
          replaceSpot(spotAfterCheckToggle(spot, res.data?.spot, false));
        } else {
          const res = await hotSpotsAPI.checkIn(spot.id, anonymous);
          replaceSpot(spotAfterCheckToggle(spot, res.data?.spot, true, { my_checkin_anonymous: anonymous }));
        }
        // Refresh the Out list so every card shows the server's updated count.
        await refreshSpots();
      } catch {
        setSheetError('Check-in failed. Try again.');
      } finally {
        setActingSpotId(null);
      }
    },
    [replaceSpot, refreshSpots],
  );

  const setChip = useCallback(
    (next: OutChip) => {
      const sp = new URLSearchParams(params);
      if (next === 'all') {
        sp.delete('section');
        sp.delete('chip');
      } else {
        sp.set('section', next);
      }
      setParams(sp, { replace: true });
    },
    [params, setParams],
  );

  // A brand-new member's first read can land before the server has their
  // location (empty list, location_required). Reload once when it is saved.
  const [needsLocation, setNeedsLocation] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!needsLocation) return;
    return onLocationSaved(() => {
      setNeedsLocation(false);
      setReloadKey((k) => k + 1);
    });
  }, [needsLocation]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const tasks: Promise<void>[] = [];
        if (chip !== 'community' && chip !== 'event') {
          tasks.push(
            (async () => {
              if (lat == null || lng == null) {
                if (!cancelled) setSpots([]);
                return;
              }
              const res = await hotSpotsAPI.listNearby(lat, lng, 80);
              if (!cancelled) {
                setSpots(res.data.spots ?? []);
                setNeedsLocation(Boolean((res.data as { location_required?: boolean }).location_required));
              }
            })(),
          );
        } else if (!cancelled) {
          setSpots([]);
        }
        if (chip === 'all' || chip === 'event') {
          tasks.push(
            (async () => {
              if (lat == null || lng == null) {
                if (!cancelled) setEvents([]);
                return;
              }
              const res = await eventsAPI.getNearby(lat, lng, 50, 24);
              if (!cancelled) setEvents(Array.isArray(res.data) ? res.data : []);
            })(),
          );
        } else if (!cancelled) {
          setEvents([]);
        }
        await Promise.all(tasks);
      } catch {
        if (!cancelled) setError('Could not load Out.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [chip, lat, lng, reloadKey]);

  const visibleSpots = useMemo(
    () => spots.filter((s) => spotMatchesChip(s, chip)),
    [spots, chip],
  );
  const visibleEvents = useMemo(
    () => (chip === 'all' || chip === 'event' ? events : []),
    [events, chip],
  );

  return (
    <Layout>
      <div
        className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pb-8 pt-3"
        data-testid="out-page"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-[var(--cream)]">Out</h1>
        </div>

        <div className="mb-3 shrink-0">
          <Link
            to="/stream"
            data-testid="community-entry"
            aria-label="Community"
            className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-[var(--copper)]/40 bg-[rgba(196,131,42,0.12)] px-3.5 text-left transition-colors hover:border-[var(--copper)] hover:bg-[rgba(196,131,42,0.18)]"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(196,131,42,0.2)] text-[var(--copper)]"
              data-testid="community-entry-icon"
              aria-hidden
            >
              <IconCommunity size={20} />
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-extrabold text-[var(--cream)]">
              Community
            </span>
          </Link>
        </div>

        <div className="mb-3 shrink-0" data-testid="out-cruising-search">
          <CruisingSearchBar
            onOpen={() => setCruisingSearchOpen(true)}
            className="min-h-[48px] w-full"
          />
        </div>

        <div
          className="mb-4 flex gap-2 overflow-x-auto pb-1"
          data-testid="out-chips"
          role="tablist"
          aria-label="Out filters"
        >
          {CHIPS.map((c) => {
            const active = chip === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`out-chip-${c.id}`}
                onClick={() => setChip(c.id)}
                className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-[15px] font-extrabold transition-colors ${
                  active
                    ? 'bg-[var(--copper)] text-[#1A0E03]'
                    : 'border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--cream)]'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {chip === 'community' ? (
          <div data-testid="out-community">
            <CommunityFeed />
          </div>
        ) : loading ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <PulseRing size={36} label="Loading Out" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-[15px] text-[var(--cream-muted)]">{error}</p>
        ) : (
          <div className="space-y-3" data-testid="out-list">
            {visibleSpots.map((spot) => (
              <OutSpotRow key={spot.id} spot={spot} onOpen={() => setSheetSpotId(spot.id)} />
            ))}
            {visibleEvents.map((ev) => (
              <OutEventRow key={ev.id} event={ev} />
            ))}
            {visibleSpots.length === 0 && visibleEvents.length === 0 ? (
              <p className="py-12 text-center text-[15px] text-[var(--cream-muted)]">
                Nothing in this chip yet.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                to="/hot-spots"
                className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-[var(--copper)] underline-offset-2 hover:underline"
              >
                Full Cruise map
              </Link>
              <Link
                to="/events"
                className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-[var(--copper)] underline-offset-2 hover:underline"
              >
                Full Events
              </Link>
              <Link
                to="/stream"
                className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-[var(--copper)] underline-offset-2 hover:underline"
              >
                Community feed
              </Link>
            </div>
          </div>
        )}
      </div>

      <CruisingSearchSheet
        open={cruisingSearchOpen}
        onClose={() => setCruisingSearchOpen(false)}
        lat={lat}
        lng={lng}
        onCheckIn={handleCheckIn}
        onOpenReviews={(spot) => setReviewsSpot(spot)}
        actingSpotId={actingSpotId}
      />
      <HotSpotSheet
        spot={sheetSpot}
        isPremium={isPremium}
        acting={Boolean(sheetSpot && actingSpotId === sheetSpot.id)}
        error={sheetError}
        onClose={() => {
          setSheetSpotId(null);
          setSheetError('');
        }}
        onCheckIn={handleCheckIn}
        onSpotUpdated={replaceSpot}
        onViewOnMap={(spot) => {
          setSheetSpotId(null);
          navigate(`/discover?spot=${encodeURIComponent(spot.id)}`);
        }}
      />
      <HotSpotReviewsModal
        spot={reviewsSpot}
        open={Boolean(reviewsSpot)}
        onClose={() => setReviewsSpot(null)}
      />
    </Layout>
  );
}

function OutSpotRow({ spot, onOpen }: { spot: HotSpotDTO; onOpen: () => void }) {
  const dist =
    typeof spot.distance_km === 'number' ? formatDistanceFromKm(spot.distance_km) : null;
  const mapUrl = getDirectionsUrl(spot.latitude, spot.longitude, spot.name);
  const typeKey = spotTypeKey(spot.category_slug, spot.category_name);

  return (
    <article
      className="relative flex min-h-[72px] gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3"
      data-testid={`out-spot-${spot.id}`}
    >
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-elevated)] text-[var(--nn-accent-text)]"
        data-testid="out-spot-type-tile"
      >
        <SpotTypeIcon type={typeKey} size={28} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-extrabold text-[var(--cream)]">
          {/* Whole card is the tap target (stretched button); MAP stays its own link above it. */}
          <button
            type="button"
            onClick={onOpen}
            data-testid={`out-spot-open-${spot.id}`}
            aria-haspopup="dialog"
            aria-label={`${spot.name}, open details`}
            className="block w-full truncate text-left after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[var(--copper)]"
          >
            {spot.name}
          </button>
        </h2>
        <p className="mt-0.5 truncate text-[15px] font-medium text-[var(--cream-muted)]">
          {[dist, spot.city].filter(Boolean).join(' · ') || spot.category_name}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[15px] text-[var(--cream-soft)]" data-testid="out-spot-type">
          <SpotTypeIcon type={typeKey} size={16} className="shrink-0 text-[var(--nn-accent-text)]" />
          <span>{spot.category_name}</span>
        </p>
      </div>
      <a
        href={mapUrl}
        target="_blank"
        rel="noreferrer"
        className="relative z-10 inline-flex min-h-[44px] shrink-0 items-center self-center rounded-full border border-[var(--border-default)] px-3 text-[15px] font-extrabold uppercase tracking-wide text-[var(--cream)]"
        aria-label={`Map directions to ${spot.name}`}
      >
        Map
      </a>
    </article>
  );
}

function OutEventRow({ event }: { event: EventDTO }) {
  return (
    <article
      className="flex min-h-[72px] gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3"
      data-testid={`out-event-${event.id}`}
    >
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--nn-accent-text)]"
        aria-hidden
      >
        <SpotTypeIcon type="event" size={28} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-extrabold text-[var(--cream)]">{event.name}</h2>
        <p className="mt-0.5 truncate text-[15px] font-medium text-[var(--cream-muted)]">
          {[event.venue_name, event.starts_at].filter(Boolean).join(' · ')}
        </p>
      </div>
      <span className="inline-flex min-h-[44px] shrink-0 items-center self-center rounded-full border border-[var(--copper)]/40 px-3 text-[15px] font-extrabold uppercase tracking-wide text-[var(--copper)]">
        Event
      </span>
    </article>
  );
}


export default Out;
