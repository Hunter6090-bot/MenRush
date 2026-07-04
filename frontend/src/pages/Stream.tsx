import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { Layout } from '../components/Layout';
import { NearbyUser, ProfileCard } from '../components/ProfileCard';
import { PulseRing } from '../components/PulseRing';
import { ROUTE_LABELS } from '../lib/routeLabels';

export const Stream = () => {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNearby = async (latitude: number, longitude: number) => {
    const res = await usersAPI.getNearby(latitude, longitude, 10);
    setUsers(res.data);
    setError('');
  };

  useEffect(() => {
    const fallback: [number, number] = [51.5136, -0.1365];
    if (!navigator.geolocation) {
      loadNearby(fallback[0], fallback[1])
        .catch(() => setError('Could not load the live profile list right now.'))
        .finally(() => setLoading(false));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await usersAPI.updateLocation(coords.latitude, coords.longitude).catch(() => {});
          await loadNearby(coords.latitude, coords.longitude);
        } catch {
          setError('Could not load the live profile list right now.');
        } finally {
          setLoading(false);
        }
      },
      async () => {
        try {
          await loadNearby(fallback[0], fallback[1]);
          setError('');
        } catch {
          setError('Could not load the live profile list right now.');
        }
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4832A]">Live view</p>
            <h1 className="text-2xl font-bold text-[#F0E0C0]">{ROUTE_LABELS.liveProfileList}</h1>
            <p className="text-sm text-[#A89070] mt-1">
              A clean list view of who is around right now.
            </p>
          </div>
          <Link
            to="/discover"
            className="rounded-full border border-[#3D2B0E] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#F0E0C0] transition-colors hover:border-[#C4832A] hover:text-[#C4832A]"
          >
            Back to map
          </Link>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <PulseRing size={32} label="Loading live profiles" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#8B4513]/40 bg-[#1E1508] p-5 text-sm text-[#F0E0C0]">
            {error}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-[#3D2B0E] bg-[#1E1508] p-6 text-center">
            <p className="text-[#F0E0C0] font-semibold">No one nearby yet.</p>
            <p className="mt-2 text-sm text-[#A89070]">Check back in a bit or expand the discovery radius from the map.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <ProfileCard key={user.id} user={user} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
