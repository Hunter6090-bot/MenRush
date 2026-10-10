/**
 * Out tab: venues, events, cruise spots, community.
 * Chips: All / Sauna / Bar / Event / Community.
 * Cruising spot search lives here (moved off the map, Pete 8 Oct 2026).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { eventsAPI, hotSpotsAPI, type EventDTO, type HotSpotDTO } from '../api/client';
import { Layout } from '../components/Layout';
import { PulseRing } from '../components/PulseRing';
import { CommunityFeed } from '../components/CommunityFeed';
import { CruisingSearchBar } from '../components/CruisingSearchBar';
import { CruisingSearchSheet } from '../components/CruisingSearchSheet';
import { HotSpotReviewsModal } from '../components/HotSpotReviewsModal';
import { useLocationStore } from '../hooks/store';
import { formatDistanceFromKm, resolveLocaleTag } from '../lib/localeUnits';
import { eventTicketUrl } from '../lib/eventTickets';
import { SpotTypeIcon } from '../components/icons/SpotTypeIcon';
import { getDirectionsUrl } from '../lib/cruising';
import { IconCommunity } from '../components/icons';

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

  // Same check-in / check-out calls the map used for this sheet.
  const handleCheckIn = useCallback(async (spot: HotSpotDTO, anonymous: boolean) => {
    setActingSpotId(spot.id);
    try {
      if (spot.is_checked_in) await hotSpotsAPI.checkOut(spot.id);
      else await hotSpotsAPI.checkIn(spot.id, anonymous);
    } catch {
      /* card keeps its state; try again */
    } finally {
      setActingSpotId(null);
    }
  }, []);

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
              <OutSpotRow key={spot.id} spot={spot} />
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
      <HotSpotReviewsModal
        spot={reviewsSpot}
        open={Boolean(reviewsSpot)}
        onClose={() => setReviewsSpot(null)}
      />
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
        <p className="mt-0.5 truncate text-[15px] font-medium text-[var(--cream-muted)]">
          {[dist, spot.city].filter(Boolean).join(' · ') || spot.category_name}
        </p>
        <p className="mt-1 text-[15px] text-[var(--cream-soft)]">
          {spot.category_icon} {spot.category_name}
        </p>
      </div>
      <a
        href={mapUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-[44px] shrink-0 items-center self-center rounded-full border border-[var(--border-default)] px-3 text-[15px] font-extrabold uppercase tracking-wide text-[var(--cream)]"
        aria-label={`Map directions to ${spot.name}`}
      >
        Map
      </a>
    </article>
  );
}

/** Matches backend ACTIVE_CHECKIN_TTL_HOURS (same copy as the Events page). */
const EVENT_CHECKIN_TTL_HOURS = 4;

function formatEventStart(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(resolveLocaleTag(), {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

/**
 * Out event row. Tapping it opens the same actions the Events card had before the
 * redesign (#316): Tickets when the event has a URL, Who's going (the event room)
 * and Check in. Nothing new; only the old Events flow, reachable from Out again.
 */
function OutEventRow({ event }: { event: EventDTO }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [notice, setNotice] = useState('');
  const ticketUrl = eventTicketUrl(event);
  const when = formatEventStart(event.starts_at);
  const panelId = `out-event-actions-${event.id}`;

  return (
    <article
      className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]"
      data-testid={`out-event-${event.id}`}
    >
      <button
        type="button"
        className="flex min-h-[72px] w-full gap-3 p-3 text-left"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${event.name}, show event actions`}
        data-testid={`out-event-open-${event.id}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-elevated)] text-[var(--copper)]"
          aria-hidden
        >
          <SpotTypeIcon type="event" size={28} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold text-[var(--cream)]">{event.name}</span>
          <span className="mt-0.5 block truncate text-[15px] font-medium text-[var(--cream-muted)]">
            {[event.venue_name, when].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="inline-flex min-h-[44px] shrink-0 items-center self-center rounded-full border border-[var(--copper)]/40 px-3 text-[15px] font-extrabold uppercase tracking-wide text-[var(--nn-accent-text)]">
          Event
        </span>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-[var(--border-default)] p-3" data-testid={panelId}>
          <div className="flex flex-wrap gap-2">
            {ticketUrl ? (
              <a
                href={ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="event-tickets"
                className="mr-cta-gradient inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full px-4 text-[15px] font-bold"
              >
                Tickets
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => navigate(`/rooms/${event.id}`)}
              data-testid="event-whos-going"
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full px-4 text-[15px] font-bold ${
                ticketUrl
                  ? 'border border-[var(--border-default)] text-[var(--cream)]'
                  : 'mr-cta-gradient'
              }`}
            >
              Who&apos;s going
            </button>
            <button
              type="button"
              disabled={checkingIn || event.lat == null || event.lng == null}
              data-testid={`event-checkin-${event.id}`}
              onClick={() => {
                setCheckingIn(true);
                setNotice('');
                void eventsAPI
                  .checkIn(event.id)
                  .then(() =>
                    setNotice(
                      `Checked in at ${event.venue_name || event.name}. Pin stays on the map for ${EVENT_CHECKIN_TTL_HOURS} hours.`,
                    ),
                  )
                  .catch((err: { response?: { data?: { error?: string } } }) =>
                    setNotice(err.response?.data?.error || 'Check-in failed.'),
                  )
                  .finally(() => setCheckingIn(false));
              }}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-[var(--copper)]/50 px-4 text-[15px] font-bold text-[var(--nn-accent-text)] disabled:opacity-50"
            >
              {checkingIn ? 'Checking in…' : 'Check in'}
            </button>
          </div>
          {notice ? (
            <p className="mt-2 text-[15px] text-[var(--cream-muted)]" role="status" data-testid="out-event-notice">
              {notice}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default Out;
