import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { hotSpotsAPI, type HotSpotCategoryDTO, type HotSpotDTO } from '../api/client';
import { Layout } from '../components/Layout';
import { PulseRing } from '../components/PulseRing';
import { useAuthStore, useLocationStore } from '../hooks/store';

export const HotSpots = () => {
  const { lat, lng } = useLocationStore();
  const isPremium = useAuthStore((s) => s.user?.is_premium ?? false);
  const [categories, setCategories] = useState<HotSpotCategoryDTO[]>([]);
  const [spots, setSpots] = useState<HotSpotDTO[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState('');

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
          with your profile. Free members see rounded live counts; Premium shows exact numbers.
        </p>

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
          <div className="rounded-2xl border border-dashed border-[var(--border-default)] py-16 text-center text-[15px] text-[var(--cream-muted)]">
            Turn on location to find hot spots near you.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-20">
            <PulseRing size={36} label="Loading hot spots" />
          </div>
        ) : spots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-default)] py-16 text-center text-[15px] text-[var(--cream-muted)]">
            No spots in range. Try another category or widen your search later.
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {spots.map((spot) => (
              <article
                key={spot.id}
                className={`mr-card flex flex-col p-4 transition-transform hover:-translate-y-0.5 ${
                  spot.is_checked_in ? 'border-[var(--copper)]/50' : ''
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-[#E0A14A]">
                      {spot.category_icon} {spot.category_name}
                    </p>
                    <h2 className="text-base font-bold text-[var(--cream)]">{spot.name}</h2>
                    <p className="text-[13px] text-[var(--cream-muted)]">
                      {spot.city ?? 'UK'}
                      {spot.distance_km != null ? ` · ${spot.distance_km} km` : ''}
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