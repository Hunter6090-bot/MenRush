import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { LOCATION_PRIVACY_LINE, requestDeviceLocation } from '../lib/deviceLocation';
import { useLocationStore } from '../hooks/store';

/**
 * App-wide nudge when the signed-in man has no saved pin.
 * Auto-requests GPS once per visit; high→low accuracy fallback.
 * Discover has its own gate. Never invents coordinates. 18+ only.
 */
export function LocationPresenceStrip() {
  const pathname = useLocation().pathname;
  const setLocation = useLocationStore((s) => s.setLocation);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const autoTriedRef = useRef(false);

  // Skip on Discover (has its own gate) and public auth shells.
  const hidden =
    pathname.startsWith('/discover') ||
    pathname.startsWith('/profile/setup') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/beta') ||
    pathname.startsWith('/coming-soon') ||
    pathname === '/';

  const refresh = useCallback(() => {
    usersAPI
      .getMe()
      .then((res) => {
        const lat = res.data?.lat != null ? Number(res.data.lat) : NaN;
        const lng = res.data?.lng != null ? Number(res.data.lng) : NaN;
        const ready = Number.isFinite(lat) && Number.isFinite(lng);
        setMissing(!ready);
        if (ready) {
          setLocation(lat, lng);
        }
      })
      .catch(() => {
        /* ignore — unauthenticated shells */
      });
  }, [setLocation]);

  const enableLocation = useCallback(async () => {
    setNotice('');
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
      } catch {
        setNotice('Got your position but could not save it. Check connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [setLocation]);

  useEffect(() => {
    if (hidden) return;
    refresh();
  }, [hidden, pathname, refresh]);

  // Auto-request once when we know the pin is missing — most stuck users never open Settings.
  useEffect(() => {
    if (hidden || !missing || autoTriedRef.current || busy) return;
    autoTriedRef.current = true;
    void enableLocation();
  }, [hidden, missing, busy, enableLocation]);

  if (hidden || !missing) return null;

  return (
    <div
      className="border-b border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.14)] px-3 py-3"
      role="status"
      data-testid="location-presence-strip"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-[#F0E0C0]">
            We need your location — not a public pin
          </p>
          <p className="text-[11px] leading-relaxed text-[#A89070]">
            {LOCATION_PRIVACY_LINE} Without it you stay invisible on Nearby.
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
          className="shrink-0 rounded-full bg-[#C4832A] px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A] disabled:opacity-60"
        >
          {busy ? 'Locating…' : 'Enable location'}
        </button>
      </div>
    </div>
  );
}
