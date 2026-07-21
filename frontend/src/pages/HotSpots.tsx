import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { hotSpotsAPI, type HotSpotCategoryDTO, type HotSpotDTO } from '../api/client';
import { Layout } from '../components/Layout';
import { PulseRing } from '../components/PulseRing';
import { HotSpotPin, createHotSpotPinElement } from '../components/HotSpotPin';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { formatDistanceFromKm } from '../lib/localeUnits';

export const HotSpots = () => {
  const { lat, lng } = useLocationStore();
  const isPremium = useAuthStore((s) => s.user?.is_premium ?? false);
  const [categories, setCategories] = useState<HotSpotCategoryDTO[]>([]);
  const [spots, setSpots] = useState<HotSpotDTO[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; root: Root; spot: HotSpotDTO }>>(
    new Map(),
  );
  const [mapLoaded, setMapLoaded] = useState(false);

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const tokenMissing = !mapboxToken || mapboxToken === '__SET_ME__';

  const loadSpots = useCallback(async () => {
    if (lat == null || lng == null) {
      setLoading(false);
      return;
    }
    setError('');
    try {
      const res = await hotSpotsAPI.listNearby(lat, lng, 80, category === 'all' ? undefined : category);
      setSpots(res.data.spots);
    } catch {
      setError('Could not load hot spots.');
      setSpots([]);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, category]);

  useEffect(() => {
    hotSpotsAPI
      .listCategories()
      .then((res) => setCategories(res.data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadSpots();
  }, [loadSpots]);

  useEffect(() => {
    if (tokenMissing || !mapContainerRef.current || lat == null || lng == null) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = mapboxToken!;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [lng, lat],
      zoom: 11,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('load', () => setMapLoaded(true));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach(({ marker, root }) => {
        marker.remove();
        setTimeout(() => root.unmount(), 0);
      });
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [mapboxToken, tokenMissing, lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const visibleIds = new Set<string>();

    spots.forEach((spot) => {
      if (!Number.isFinite(spot.latitude) || !Number.isFinite(spot.longitude)) return;
      visibleIds.add(spot.id);
      const lngLat: [number, number] = [spot.longitude, spot.latitude];
      const existing = markersRef.current.get(spot.id);
      const pinData = {
        id: spot.id,
        name: spot.name,
        category_icon: spot.category_icon,
        live_count_exact: spot.live_count_exact,
      };

      if (existing) {
        existing.marker.setLngLat(lngLat);
        if (
          existing.spot.live_count_exact !== spot.live_count_exact ||
          existing.spot.name !== spot.name ||
          existing.spot.category_icon !== spot.category_icon
        ) {
          existing.root.render(<HotSpotPin spot={pinData} size={36} />);
        }
        existing.spot = spot;
        return;
      }

      const { element, root } = createHotSpotPinElement(
        pinData,
        () => {
          setSelectedId(spot.id);
          const el = document.getElementById(`hotspot-card-${spot.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },
        36,
      );
      const marker = new mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat(lngLat)
        .addTo(map);
      markersRef.current.set(spot.id, { marker, root, spot });
    });

    markersRef.current.forEach(({ marker, root }, spotId) => {
      if (visibleIds.has(spotId)) return;
      marker.remove();
      setTimeout(() => root.unmount(), 0);
      markersRef.current.delete(spotId);
    });
  }, [spots, mapLoaded]);

  const handleCheckIn = async (spot: HotSpotDTO, anonymous: boolean) => {
    setActingId(spot.id);
    setError('');
    try {
      if (spot.is_checked_in) {
        await hotSpotsAPI.checkOut(spot.id);
      } else {
        await hotSpotsAPI.checkIn(spot.id, anonymous);
      }
      await loadSpots();
    } catch {
      setError('Check-in failed. Try again.');
    } finally {
      setActingId(null);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-4 flex flex-wrap items-baseline gap-3">
          <h1 className="flex-1 text-2xl font-extrabold text-[var(--cream)]">Hot Spots</h1>
          <Link
            to="/safety"
            className="text-[13px] font-semibold text-[#C4832A] hover:text-[#E0A14A]"
          >
            Safety tips
          </Link>
        </div>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-[var(--cream-muted)]">
          See who&apos;s around popular venues and open areas across the UK. Check in anonymously or
          with your profile. Map pins stay visible — dim when empty, solid when someone is checked in.
          Free members see rounded live counts; Premium shows exact numbers.
        </p>

        {lat != null && lng != null && !tokenMissing ? (
          <div
            className="relative mb-5 overflow-hidden rounded-2xl border border-[rgba(196,131,42,0.35)]"
            style={{ height: 'min(42vh, 360px)' }}
            data-testid="hotspots-map"
          >
            <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-[rgba(196,131,42,0.4)] bg-[rgba(13,10,6,0.85)] px-3 py-1.5 text-[11px] font-semibold text-[var(--cream-muted)]">
              Solid = checked in · Dim = empty
            </div>
          </div>
        ) : null}

        <div className="mb-5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory('all')}
            className={category === 'all' ? 'mr-pill mr-pill-active' : 'mr-pill mr-pill-inactive'}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setCategory(cat.slug)}
              className={category === cat.slug ? 'mr-pill mr-pill-active' : 'mr-pill mr-pill-inactive'}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {lat == null || lng == null ? (
          <div
            className="rounded-2xl border border-[rgba(196,131,42,0.4)] bg-[rgba(196,131,42,0.08)] px-6 py-12 text-center shadow-[0_12px_28px_rgba(0,0,0,0.3)]"
            data-testid="hotspots-location-gate"
            role="status"
          >
            <p className="text-[16px] font-extrabold text-[var(--cream)]">
              We need your location for Hot Spots
            </p>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--cream-muted)]">
              Not a public pin on a map — we use GPS privately to rank venues near you. Others do not
              see your exact address. Shared only while you use the app.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Link
                to="/settings"
                className="rounded-full bg-[#C4832A] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
              >
                Allow in Settings
              </Link>
              <Link
                to="/discover"
                className="rounded-full border border-[rgba(196,131,42,0.5)] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
              >
                Nearby map
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[var(--cream-muted)]">Meet in public · Consent first</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <PulseRing size={36} label="Loading hot spots" />
          </div>
        ) : spots.length === 0 ? (
          <div
            className="rounded-2xl border border-[rgba(196,131,42,0.3)] bg-[rgba(196,131,42,0.05)] px-6 py-12 text-center"
            data-testid="hotspots-empty"
          >
            <p className="text-[15px] font-extrabold text-[var(--cream)]">No spots in this filter</p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--cream-muted)]">
              Try another category or check back later as the beta fills in.
            </p>
            <Link
              to="/discover"
              className="mt-5 inline-flex rounded-full bg-[#C4832A] px-5 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03]"
            >
              Browse Nearby
            </Link>
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {spots.map((spot) => (
              <article
                key={spot.id}
                id={`hotspot-card-${spot.id}`}
                className={`mr-card flex flex-col p-4 transition-transform hover:-translate-y-0.5 ${
                  spot.is_checked_in ? 'border-[var(--copper)]/50' : ''
                } ${selectedId === spot.id ? 'ring-2 ring-[#C4832A]/60' : ''}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-[#E0A14A]">
                      {spot.category_icon} {spot.category_name}
                    </p>
                    <h2 className="text-base font-bold text-[var(--cream)]">{spot.name}</h2>
                    <p className="text-[13px] text-[var(--cream-muted)]">
                      {spot.city ?? 'UK'}
                      {spot.distance_km != null ? ` · ${formatDistanceFromKm(Number(spot.distance_km))}` : ''}
                    </p>
                  </div>
                  <div className="rounded-full border border-[var(--border-default)] bg-[rgba(196,131,42,0.12)] px-3 py-1 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--cream-muted)]">
                      Live
                    </p>
                    <p className="text-lg font-extrabold text-[#E0A14A]">{spot.live_count}</p>
                  </div>
                </div>

                {spot.description ? (
                  <p className="mb-3 text-[13px] leading-relaxed text-[var(--cream-muted)]">
                    {spot.description}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-col gap-2 pt-2">
                  {spot.is_checked_in ? (
                    <button
                      type="button"
                      disabled={actingId === spot.id}
                      onClick={() => void handleCheckIn(spot, false)}
                      className="rounded-full border border-[var(--copper)]/50 py-2.5 text-[13px] font-bold text-[#E0A14A]"
                    >
                      {actingId === spot.id ? 'Updating…' : 'Check out'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={actingId === spot.id}
                        onClick={() => void handleCheckIn(spot, false)}
                        className="mr-cta-gradient rounded-full py-2.5 text-[13px] font-bold"
                      >
                        {actingId === spot.id ? 'Checking in…' : 'Check in'}
                      </button>
                      <button
                        type="button"
                        disabled={actingId === spot.id}
                        onClick={() => void handleCheckIn(spot, true)}
                        className="rounded-full border border-[var(--border-default)] py-2 text-[12px] font-semibold text-[var(--cream-muted)] hover:border-[var(--copper)]/40"
                      >
                        Check in anonymously
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {!isPremium ? (
          <p className="mt-6 text-center text-xs text-[var(--cream-muted)]">
            Counts of 5+ are rounded on Free.{' '}
            <Link to="/premium" className="font-bold text-[#C4832A]">
              Upgrade for exact live counts
            </Link>
            .
          </p>
        ) : null}
      </div>
    </Layout>
  );
};

export default HotSpots;
