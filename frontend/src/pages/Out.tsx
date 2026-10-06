/**
 * Out tab — venues, events, cruise spots, community.
 * Chips: All / Sauna / Bar / Event / Community.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { eventsAPI, hotSpotsAPI, type EventDTO, type HotSpotDTO } from '../api/client';
import { Layout } from '../components/Layout';
import { PulseRing } from '../components/PulseRing';
import { CommunityFeed } from '../components/CommunityFeed';
import { useLocationStore } from '../hooks/store';
import { formatDistanceFromKm } from '../lib/localeUnits';
import { getDirectionsUrl } from '../lib/cruising';

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
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const chip = sectionFromParam(params.get('section') || params.get('chip'));
  const { lat, lng } = useLocationStore();
  const [spots, setSpots] = useState<HotSpotDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
              if (!cancelled) setSpots(res.data.spots ?? []);
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
  }, [chip, lat, lng]);

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
          <button
            type="button"
            data-testid="out-map-toggle"
            onClick={() => navigate('/discover')}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--copper)]/55 bg-[rgba(196,131,42,0.12)] px-3.5 py-2 text-[12px] font-extrabold text-[var(--copper)]"
            aria-label="Open Map"
          >
            <MapGlyph />
            Map
          </button>
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
                className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-[13px] font-extrabold transition-colors ${
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
          <p className="py-8 text-center text-sm text-[var(--cream-muted)]">{error}</p>
        ) : (
          <div className="space-y-3" data-testid="out-list">
            {visibleSpots.map((spot) => (
              <OutSpotRow key={spot.id} spot={spot} />
            ))}
            {visibleEvents.map((ev) => (
              <OutEventRow key={ev.id} event={ev} />
            ))}
            {visibleSpots.length === 0 && visibleEvents.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--cream-muted)]">
                Nothing in this chip yet.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                to="/hot-spots"
                className="text-[12px] font-bold text-[var(--copper)] underline-offset-2 hover:underline"
              >
                Full Cruise map
              </Link>
              <Link
                to="/events"
                className="text-[12px] font-bold text-[var(--copper)] underline-offset-2 hover:underline"
              >
                Full Events
              </Link>
              <Link
                to="/stream"
                className="text-[12px] font-bold text-[var(--copper)] underline-offset-2 hover:underline"
              >
                Community feed
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function OutSpotRow({ spot }: { spot: HotSpotDTO }) {
  const dist =
    typeof spot.distance_km === 'number' ? formatDistanceFromKm(spot.distance_km) : null;
  const mapUrl = getDirectionsUrl(spot.latitude, spot.longitude, spot.name);

  return (
    <article
      className="flex min-h-[72px] gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3"
      data-testid={`out-spot-${spot.id}`}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-elevated)] text-2xl">
        {spot.category_icon || '📍'}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-extrabold text-[var(--cream)]">{spot.name}</h2>
        <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--cream-muted)]">
          {[dist, spot.city].filter(Boolean).join(' · ') || spot.category_name}
        </p>
        <p className="mt-1 text-[11px] text-[var(--cream-soft)]">
          {spot.category_icon} {spot.category_name}
        </p>
      </div>
      <a
        href={mapUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-[44px] shrink-0 items-center self-center rounded-full border border-[var(--border-default)] px-3 text-[11px] font-extrabold uppercase tracking-wide text-[var(--cream)]"
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
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-2xl"
        aria-hidden
      >
        🎟
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[15px] font-extrabold text-[var(--cream)]">{event.name}</h2>
        <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--cream-muted)]">
          {[event.venue_name, event.starts_at].filter(Boolean).join(' · ')}
        </p>
      </div>
      <span className="inline-flex min-h-[44px] shrink-0 items-center self-center rounded-full border border-[var(--copper)]/40 px-3 text-[11px] font-extrabold uppercase tracking-wide text-[var(--copper)]">
        Event
      </span>
    </article>
  );
}

function MapGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );
}

export default Out;
