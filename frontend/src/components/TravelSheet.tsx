/**
 * Travel sheet (Premium). Opened from the plane on the map and the Travel row
 * in the Menu. Look around: browse another town or city without moving. Plan a
 * trip: show as Visiting there during your dates. One trip at a time.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { travelAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import {
  TRAVEL_COPY,
  TRAVEL_MAX_LEAD_DAYS,
  TRAVEL_MAX_TRIP_DAYS,
  addDaysIso,
  hasTravelAccess,
  lookAroundPath,
  tripDatesError,
  tripSummary,
  ukToday,
  type TravelTrip,
} from '../lib/travel';
import { IconPlane } from './icons';
import { TravelPremiumGate } from './TravelPremiumGate';

const inputClass =
  'min-h-[44px] w-full rounded-[var(--nn-radius-md)] border border-[var(--nn-border)] bg-[var(--nn-bg)] px-3 text-[16px] text-[var(--nn-text)] placeholder:text-[var(--nn-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nn-copper)]';
const primaryBtn =
  'inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--nn-copper)] px-5 text-[15px] font-extrabold text-[var(--nn-on-copper)] disabled:opacity-60';
const secondaryBtn =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--nn-border)] px-5 text-[15px] font-bold text-[var(--nn-text)] disabled:opacity-60';
const labelClass = 'mb-1 block text-[15px] font-bold text-[var(--nn-text)]';
const helpClass = 'text-[15px] leading-relaxed text-[var(--nn-muted)]';

function apiMessage(err: unknown, fallback: string): { message: string; premium: boolean } {
  const res = (err as { response?: { status?: number; data?: { error?: string; message?: string } } })?.response;
  const premium = res?.status === 402 || res?.data?.error === 'premium_required';
  return { message: res?.data?.message || fallback, premium };
}

export function TravelSheet({ now }: { now?: Date } = {}) {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [gated, setGated] = useState(() => !hasTravelAccess(user));
  const [city, setCity] = useState('');
  const today = ukToday(now);
  const [startsOn, setStartsOn] = useState(today);
  const [endsOn, setEndsOn] = useState(addDaysIso(today, 2));
  const [trip, setTrip] = useState<TravelTrip | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setGated(!hasTravelAccess(user));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    travelAPI
      .getTrip()
      .then((res) => {
        if (!cancelled) setTrip(res.data.trip);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const cityValid = city.trim().length >= 2;

  const onLookAround = (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!cityValid) {
      setError('Type a town or city.');
      return;
    }
    navigate(lookAroundPath(city.trim()));
  };

  const onPlan = async () => {
    setError('');
    setNotice('');
    if (!cityValid) {
      setError('Type a town or city.');
      return;
    }
    const dateErr = tripDatesError(startsOn, endsOn, now);
    if (dateErr) {
      setError(dateErr);
      return;
    }
    setBusy(true);
    try {
      const res = await travelAPI.planTrip({ city: city.trim(), startsOn, endsOn });
      setTrip(res.data.trip);
      setNotice('Trip saved.');
    } catch (err) {
      const { message, premium } = apiMessage(err, 'Could not save the trip. Try again.');
      if (premium) setGated(true);
      else setError(message);
    } finally {
      setBusy(false);
    }
  };

  const onEnd = async () => {
    setBusy(true);
    setError('');
    try {
      await travelAPI.endTrip();
      setTrip(null);
      setNotice('Trip ended. You show near you again.');
    } catch {
      setError('Could not end the trip. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="travel-title"
      data-testid="travel-sheet"
      className="mx-auto w-full max-w-xl space-y-4 rounded-[var(--nn-radius-xl)] border border-[var(--nn-border)] bg-[var(--nn-elevated)] p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <span className="text-[var(--nn-accent-text)]">
          <IconPlane size={24} />
        </span>
        <h1 id="travel-title" className="text-[22px] font-extrabold text-[var(--nn-text)]">
          {TRAVEL_COPY.title}
        </h1>
      </div>
      <p className={helpClass}>{TRAVEL_COPY.intro}</p>

      {trip ? (
        <div
          className="rounded-[var(--nn-radius-lg)] border border-[var(--nn-border)] bg-[var(--nn-card)] p-4"
          data-testid="travel-current-trip"
        >
          <p className="text-[15px] font-bold text-[var(--nn-text)]" data-testid="travel-trip-summary">
            {tripSummary(trip)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryBtn}
              onClick={() => navigate(lookAroundPath(trip.city))}
              data-testid="travel-trip-look"
            >
              Look around {trip.city}
            </button>
            <button type="button" className={secondaryBtn} onClick={() => void onEnd()} disabled={busy} data-testid="travel-end-trip">
              {TRAVEL_COPY.endTrip}
            </button>
          </div>
        </div>
      ) : null}

      {gated ? (
        <TravelPremiumGate />
      ) : (
        <>
          <form onSubmit={onLookAround} className="space-y-2" data-testid="travel-look-form">
            <label htmlFor="travel-city" className={labelClass}>
              Town or city
            </label>
            <input
              id="travel-city"
              data-testid="travel-city"
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Manchester"
              autoComplete="off"
              maxLength={80}
            />
            <p className="text-[15px] text-[var(--nn-muted)]">UK and Ireland.</p>
            <h2 className="pt-2 text-[17px] font-extrabold text-[var(--nn-text)]">Look around</h2>
            <p className={helpClass}>{TRAVEL_COPY.lookAroundHelp}</p>
            <button type="submit" className={primaryBtn} data-testid="travel-look-around">
              Look around
            </button>
          </form>

          <div className="space-y-2 border-t border-[var(--nn-border)] pt-4" data-testid="travel-plan">
            <h2 className="text-[17px] font-extrabold text-[var(--nn-text)]">Plan a trip</h2>
            <p className={helpClass}>{TRAVEL_COPY.planHelp}</p>
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
              <div>
                <label htmlFor="travel-start" className={labelClass}>
                  From
                </label>
                <input
                  id="travel-start"
                  type="date"
                  data-testid="travel-start"
                  className={inputClass}
                  value={startsOn}
                  min={today}
                  max={addDaysIso(today, TRAVEL_MAX_LEAD_DAYS)}
                  onChange={(e) => setStartsOn(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="travel-end" className={labelClass}>
                  To
                </label>
                <input
                  id="travel-end"
                  type="date"
                  data-testid="travel-end"
                  className={inputClass}
                  value={endsOn}
                  min={startsOn}
                  max={addDaysIso(startsOn || today, TRAVEL_MAX_TRIP_DAYS - 1)}
                  onChange={(e) => setEndsOn(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              className={primaryBtn}
              onClick={() => void onPlan()}
              disabled={busy}
              data-testid="travel-save-trip"
            >
              {trip ? 'Replace trip' : 'Save trip'}
            </button>
            {trip ? (
              <p className="text-[15px] text-[var(--nn-muted)]">One trip at a time. Saving replaces your current trip.</p>
            ) : null}
          </div>
        </>
      )}

      {error ? (
        <p role="alert" className="text-[15px] font-semibold text-[var(--nn-danger-text)]" data-testid="travel-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-[15px] font-semibold text-[var(--nn-text)]" data-testid="travel-notice">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
