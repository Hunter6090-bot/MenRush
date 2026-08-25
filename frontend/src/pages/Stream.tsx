import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { CommunityFeed } from '../components/CommunityFeed';
import { ROUTE_LABELS } from '../lib/routeLabels';

/**
 * Community feed — text-only local posts. Rooms stay the video space.
 */
export const Stream = () => {
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState('');

  const applyCoords = useCallback((latitude: number, longitude: number) => {
    setLat(latitude);
    setLng(longitude);
    void usersAPI.updateLocation(latitude, longitude).catch(() => {});
  }, []);

  const requestLocation = useCallback(() => {
    setError('');
    void (async () => {
      const { requestDeviceLocation } = await import('../lib/deviceLocation');
      const result = await requestDeviceLocation();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      applyCoords(result.lat, result.lng);
      setError('');
    })();
  }, [applyCoords]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await usersAPI.getMe();
        if (cancelled) return;
        const savedLat = r.data?.lat != null ? Number(r.data.lat) : NaN;
        const savedLng = r.data?.lng != null ? Number(r.data.lng) : NaN;
        if (Number.isFinite(savedLat) && Number.isFinite(savedLng)) {
          applyCoords(savedLat, savedLng);
        }
      } catch {
        /* no pin yet */
      }
      if (cancelled) return;
      const { requestDeviceLocation } = await import('../lib/deviceLocation');
      const result = await requestDeviceLocation();
      if (cancelled) return;
      if (result.ok) {
        applyCoords(result.lat, result.lng);
        setError('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyCoords]);

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4832A]">Local feed</p>
            <h1 className="text-2xl font-bold text-[var(--cream)]">{ROUTE_LABELS.community}</h1>
            <p className="mt-1 text-sm text-[var(--cream-muted)]">
              Short text posts from men nearby. No video here.
            </p>
          </div>
          <Link
            to="/discover"
            className="rounded-full border border-[var(--border-default)] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--cream)] transition-colors hover:border-[#C4832A] hover:text-[#C4832A]"
          >
            Back to map
          </Link>
        </div>

        {error && lat == null ? (
          <p className="rounded-2xl border border-[#A45E18]/40 bg-[var(--bg-card)] p-4 text-sm text-[var(--cream)]">
            {error}
          </p>
        ) : null}

        <CommunityFeed lat={lat} lng={lng} onNeedLocation={requestLocation} />
      </div>
    </Layout>
  );
};
