/**
 * Travel pages (Premium).
 *   /travel             Travel sheet: Look around or Plan a trip.
 *   /travel/look?city=  Looking around: that city's members, Cruise spots and
 *                       events. Read-only. Your own pin and location never move.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { eventsAPI, hotSpotsAPI, travelAPI, type EventDTO, type HotSpotDTO } from '../api/client';
import { Layout } from '../components/Layout';
import { LookAroundBar } from '../components/LookAroundBar';
import { TravelPremiumGate } from '../components/TravelPremiumGate';
import { TravelSheet } from '../components/TravelSheet';
import { useAuthStore } from '../hooks/store';
import { resolveAssetUrl } from '../lib/assetUrl';
import { loadMapbox } from '../lib/mapboxLazy';
import { mapboxStyleForTheme, resolvedThemeNow } from '../lib/mapTheme';
import { hasTravelAccess, type LookAroundMember, type TravelPlace } from '../lib/travel';

/** Cruise spots and events within this distance of the city centre. */
const CITY_RADIUS_KM = 15;

export function TravelPage() {
  return (
    <Layout>
      <div className="px-3 py-4 sm:px-6 sm:py-6" data-testid="travel-page">
        <TravelSheet />
      </div>
    </Layout>
  );
}

/** Label under a member in Look around: visitors say "Visiting <city>", locals "In <city>". No distances. */
export function lookAroundMemberLabel(m: LookAroundMember, city: string): string {
  return m.distance_label || `In ${city}`;
}

function MemberTile({ m, city }: { m: LookAroundMember; city: string }) {
  const photo = resolveAssetUrl(m.photo_url) ?? undefined;
  const label = lookAroundMemberLabel(m, city);
  return (
    <Link
      to={`/profile/${encodeURIComponent(m.id)}`}
      data-testid={`look-member-${m.id}`}
      className="group block min-h-[44px] overflow-hidden rounded-[var(--nn-radius-lg)] border border-[var(--nn-border)] bg-[var(--nn-card)]"
    >
      <div className="aspect-square w-full bg-[var(--nn-elevated)]">
        {photo ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[15px] font-bold text-[var(--nn-text)]">
          {m.name}
          {m.age != null ? `, ${m.age}` : ''}
        </p>
        <p className="truncate text-[15px] text-[var(--nn-muted)]" data-testid="look-member-label">
          {label}
        </p>
      </div>
    </Link>
  );
}

function LookAroundMap({
  place,
  members,
  spots,
}: {
  place: TravelPlace;
  members: LookAroundMember[];
  spots: HotSpotDTO[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const tokenMissing = !token || token === '__SET_ME__';

  useEffect(() => {
    if (tokenMissing || !ref.current) return;
    let map: import('mapbox-gl').Map | null = null;
    let cancelled = false;
    void loadMapbox().then((mapboxgl) => {
      if (cancelled || !ref.current) return;
      mapboxgl.accessToken = token!;
      map = new mapboxgl.Map({
        container: ref.current,
        style: mapboxStyleForTheme(resolvedThemeNow()),
        center: [place.centre.lng, place.centre.lat],
        zoom: 11,
        projection: 'mercator',
        attributionControl: false,
      });
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
      const b = place.bounds;
      map.fitBounds(
        [
          [b.west, b.south],
          [b.east, b.north],
        ],
        { padding: 24, duration: 0 },
      );
      for (const m of members) {
        if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
        const el = document.createElement('a');
        el.href = `/profile/${encodeURIComponent(m.id)}`;
        el.setAttribute('aria-label', `${m.name}, ${lookAroundMemberLabel(m, place.name)}`);
        el.className =
          'block h-11 w-11 overflow-hidden rounded-full border-2 border-[var(--nn-copper)] bg-[var(--nn-card)] shadow-md';
        const src = resolveAssetUrl(m.photo_url);
        if (src) {
          const img = document.createElement('img');
          img.src = src;
          img.alt = '';
          img.className = 'h-full w-full object-cover';
          el.appendChild(img);
        }
        new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]).addTo(map);
      }
      for (const s of spots) {
        if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) continue;
        const el = document.createElement('div');
        el.setAttribute('aria-label', s.name);
        el.className = 'flex h-11 w-11 items-center justify-center rounded-full bg-[var(--nn-elevated)] text-[18px] shadow-md';
        el.textContent = s.category_icon || '•';
        new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([s.longitude, s.latitude]).addTo(map);
      }
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [place, members, spots, token, tokenMissing]);

  if (tokenMissing) return null;
  return (
    <div
      ref={ref}
      data-testid="look-around-map"
      className="h-[45vh] min-h-[260px] w-full overflow-hidden rounded-[var(--nn-radius-lg)] border border-[var(--nn-border)]"
    />
  );
}

export function LookAroundPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const cityParam = (params.get('city') || '').trim();
  const [gated, setGated] = useState(() => !hasTravelAccess(user));
  const [place, setPlace] = useState<TravelPlace | null>(null);
  const [members, setMembers] = useState<LookAroundMember[]>([]);
  const [spots, setSpots] = useState<HotSpotDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setGated(!hasTravelAccess(user));
  }, [user]);

  useEffect(() => {
    if (gated || !cityParam) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    travelAPI
      .lookAround(cityParam)
      .then(async (res) => {
        if (cancelled) return;
        setPlace(res.data.place);
        setMembers(res.data.members);
        const { lat, lng } = res.data.place.centre;
        const [s, e] = await Promise.allSettled([
          hotSpotsAPI.listNearby(lat, lng, CITY_RADIUS_KM),
          eventsAPI.getNearby(lat, lng, CITY_RADIUS_KM, 20),
        ]);
        if (cancelled) return;
        setSpots(s.status === 'fulfilled' ? s.value.data.spots ?? [] : []);
        setEvents(e.status === 'fulfilled' && Array.isArray(e.value.data) ? e.value.data : []);
      })
      .catch((err: { response?: { status?: number; data?: { message?: string } } }) => {
        if (cancelled) return;
        if (err?.response?.status === 402) setGated(true);
        else setError(err?.response?.data?.message || 'Could not load that place. Try another town or city.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cityParam, gated]);

  const city = place?.name || cityParam || 'that city';
  const visitors = useMemo(() => members.filter((m) => m.visiting), [members]);
  const locals = useMemo(() => members.filter((m) => !m.visiting), [members]);

  return (
    <Layout>
      <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-6" data-testid="look-around-page">
        <div className="sticky top-0 z-10">
          <LookAroundBar city={city} onNearMe={() => navigate('/discover')} />
        </div>

        {gated ? <TravelPremiumGate /> : null}
        {!gated && loading ? (
          <p className="text-[15px] text-[var(--nn-muted)]" role="status">
            Loading {city}…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[15px] font-semibold text-[var(--nn-danger-text)]">
            {error}
          </p>
        ) : null}

        {!gated && place ? (
          <>
            <LookAroundMap place={place} members={members} spots={spots} />

            <section aria-labelledby="look-members">
              <h2 id="look-members" className="mb-2 text-[17px] font-extrabold text-[var(--nn-text)]">
                Members in {city}
              </h2>
              {members.length === 0 ? (
                <p className="text-[15px] text-[var(--nn-muted)]" data-testid="look-around-empty">
                  Nobody to show in {city} right now.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 min-[560px]:grid-cols-3 lg:grid-cols-5">
                  {[...visitors, ...locals].map((m) => (
                    <MemberTile key={m.id} m={m} city={city} />
                  ))}
                </div>
              )}
            </section>

            <section aria-labelledby="look-spots">
              <h2 id="look-spots" className="mb-2 text-[17px] font-extrabold text-[var(--nn-text)]">
                Cruise spots
              </h2>
              {spots.length === 0 ? (
                <p className="text-[15px] text-[var(--nn-muted)]">No Cruise spots listed here yet.</p>
              ) : (
                <ul className="space-y-2">
                  {spots.slice(0, 20).map((s) => (
                    <li key={s.id} className="rounded-[var(--nn-radius-md)] border border-[var(--nn-border)] bg-[var(--nn-card)] px-3 py-2.5">
                      <p className="text-[15px] font-bold text-[var(--nn-text)]">{s.name}</p>
                      <p className="text-[15px] text-[var(--nn-muted)]">{s.category_name}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="look-events">
              <h2 id="look-events" className="mb-2 text-[17px] font-extrabold text-[var(--nn-text)]">
                Events
              </h2>
              {events.length === 0 ? (
                <p className="text-[15px] text-[var(--nn-muted)]">No events listed here yet.</p>
              ) : (
                <ul className="space-y-2">
                  {events.slice(0, 20).map((ev) => (
                    <li key={ev.id} className="rounded-[var(--nn-radius-md)] border border-[var(--nn-border)] bg-[var(--nn-card)] px-3 py-2.5">
                      <p className="text-[15px] font-bold text-[var(--nn-text)]">{ev.name}</p>
                      {ev.venue_name ? <p className="text-[15px] text-[var(--nn-muted)]">{ev.venue_name}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Link to="/travel" className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-[var(--nn-accent-text)] underline">
              Pick another city or plan a trip
            </Link>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
