import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';

/**
 * App-wide nudge when the signed-in man has no saved pin.
 * Discover already has a hard gate; this catches Matches/Messages/Settings.
 * 18+ proximity product — never invent coordinates.
 */
export function LocationPresenceStrip() {
  const pathname = useLocation().pathname;
  const setLocation = useLocationStore((s) => s.setLocation);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  // Skip on Discover (has its own gate) and public auth shells.
  const hidden =
    pathname.startsWith('/discover') ||
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

  useEffect(() => {
    if (hidden) return;
    refresh();
  }, [hidden, pathname, refresh]);

  const enableLocation = () => {
    setNotice('');
    if (!window.isSecureContext) {
      setNotice('Location needs HTTPS. Open menrush.com on your phone.');
      return;
    }
    if (!navigator.geolocation) {
      setNotice('This browser cannot share location.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await usersAPI.updateLocation(coords.latitude, coords.longitude);
          setLocation(coords.latitude, coords.longitude);
          setMissing(false);
          setNotice('');
        } catch {
          setNotice('Could not save location. Try again.');
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setNotice('Allow location in browser settings, then try again.');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  if (hidden || !missing) return null;

  return (
    <div
      className="border-b border-[rgba(196,131,42,0.4)] bg-[rgba(196,131,42,0.12)] px-3 py-2.5"
      role="status"
      data-testid="location-presence-strip"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-[#F0E0C0]">You&apos;re invisible nearby</p>
          <p className="text-[11px] text-[#A89070]">
            Turn on location so men can find you. Shared only while you use the app · 18+ only.
          </p>
          {notice ? <p className="mt-1 text-[11px] text-[#E0A14A]">{notice}</p> : null}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={enableLocation}
          className="shrink-0 rounded-full bg-[#C4832A] px-4 py-2 text-[11px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A] disabled:opacity-60"
        >
          {busy ? 'Locating…' : 'Enable location'}
        </button>
      </div>
    </div>
  );
}
