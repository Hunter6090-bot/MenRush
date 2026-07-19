import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { LOCATION_PRIVACY_LINE, requestDeviceLocation } from '../lib/deviceLocation';
import { useLocationStore } from '../hooks/store';
import { formatRadiusMiles, clampRadiusKm } from '../lib/discoveryFormat';

const RADIUS_KEY = 'menrush_default_radius_km';

/**
 * App-wide strip when signed-in user has no usable location pin.
 * Hides immediately once location is active (store or API).
 */
export function LocationPresenceStrip() {
  const pathname = useLocation().pathname;
  const storeLat = useLocationStore((s) => s.lat);
  const storeLng = useLocationStore((s) => s.lng);
  const setLocation = useLocationStore((s) => s.setLocation);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState('');
  const autoTriedRef = useRef(false);

  const hidden =
    pathname.startsWith('/discover') ||
    pathname.startsWith('/profile/setup') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/beta') ||
    pathname.startsWith('/coming-soon') ||
    pathname === '/';

  const storeReady =
    storeLat != null &&
    storeLng != null &&
    Number.isFinite(storeLat) &&
    Number.isFinite(storeLng);

  const refresh = useCallback(() => {
    if (storeReady) {
      setMissing(false);
      return;
    }
    usersAPI
      .getMe()
      .then((res) => {
        const lat = res.data?.lat != null ? Number(res.data.lat) : NaN;
        const lng = res.data?.lng != null ? Number(res.data.lng) : NaN;
        const ready = Number.isFinite(lat) && Number.isFinite(lng);
        setMissing(!ready);
        if (ready) {
          setLocation(lat, lng);
          setNotice('');
        }
      })
      .catch(() => {
        /* ignore */
      });
  }, [setLocation, storeReady]);

  const enableLocation = useCallback(async () => {
    setNotice('');
    setSuccess('');
    setBusy(true);
    try {
      const result = await requestDeviceLocation();
      if (!result.ok) {
        setNotice(result.message);
        return;
      }
      try {
        await usersAPI.updateLocation(result.lat, result.lng);
        setLocation(result.lat, result.lng);
        setMissing(false);
        setNotice('');
        const km = clampRadiusKm(Number(localStorage.getItem(RADIUS_KEY) ?? 5));
        setSuccess(`Location is active. Showing people within ${formatRadiusMiles(km)}.`);
        window.setTimeout(() => setSuccess(''), 5000);
      } catch {
        setNotice('Got your position but could not save it. Check connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [setLocation]);

  useEffect(() => {
    if (hidden) return;
    if (storeReady) {
      setMissing(false);
      return;
    }
    refresh();
  }, [hidden, pathname, refresh, storeReady]);

  useEffect(() => {
    if (hidden || !missing || storeReady || autoTriedRef.current || busy) return;
    autoTriedRef.current = true;
    void enableLocation();
  }, [hidden, missing, storeReady, busy, enableLocation]);

  if (hidden) return null;

  if (success && !missing) {
    return (
      <div
        className="border-b border-[rgba(143,199,115,0.45)] bg-[rgba(143,199,115,0.12)] px-3 py-2.5"
        role="status"
        data-testid="location-presence-success"
      >
        <p className="mx-auto max-w-3xl text-[13px] font-semibold text-[#8FC773]">{success}</p>
      </div>
    );
  }

  if (!missing) return null;

  return (
    <div
      className="border-b border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.14)] px-3 py-3"
      role="status"
      data-testid="location-presence-strip"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-[#F0E0C0]">Turn on location for Nearby</p>
          <p className="text-[11px] leading-relaxed text-[var(--cream-muted)]">
            {LOCATION_PRIVACY_LINE}
          </p>
          {notice ? (
            <p className="mt-1 text-[11px] font-semibold text-[#E0A14A]" data-testid="location-strip-error">
              {notice}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enableLocation()}
          className="min-h-[44px] shrink-0 rounded-full bg-[#C4832A] px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A] disabled:opacity-60"
        >
          {busy ? 'Locating…' : 'Enable location'}
        </button>
      </div>
    </div>
  );
}
