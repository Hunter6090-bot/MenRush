import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { NearbyUser } from '../components/ProfileCard';
import { Layout } from '../components/Layout';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { PulsingAvatar } from '../components/PulsingAvatar';
import { PulseFab } from '../components/PulseFab';
import { ProfileDrawer } from '../components/ProfileDrawer';
import { createMapMarkerElement } from '../components/MapMarker';
import { getPhotoUrl } from '../components/UserAvatar';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const INJECT_ID = '__discover_styles__';
if (typeof document !== 'undefined' && !document.getElementById(INJECT_ID)) {
  const s = document.createElement('style');
  s.id = INJECT_ID;
  s.textContent = `
    .user-strip-scroll::-webkit-scrollbar { height: 0; }
    .user-strip-scroll { scrollbar-width: none; -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; }
    .user-strip-card { scroll-snap-align: start; }
    .mapboxgl-popup-content { background: transparent !important; border: none !important; padding: 0 !important; box-shadow: none !important; }
    .mapboxgl-popup-tip { display: none !important; }
    .map-self-dot {
      width: 18px; height: 18px; border-radius: 50%;
      background: var(--copper);
      border: 3px solid var(--cream);
      box-shadow: 0 0 0 6px rgba(196,131,42,0.18), 0 2px 10px rgba(196,131,42,0.55);
    }
  `;
  document.head.appendChild(s);
}

const RADIUS_OPTIONS = [1, 5, 10, 25, 50] as const;

export const Discover = () => {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [likedUsers, setLikedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [radius, setRadius] = useState<number>(5);
  const [pulseUntil, setPulseUntil] = useState<Date | null>(null);
  const [pulseError, setPulseError] = useState('');
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const { lat, lng, setLocation } = useLocationStore();
  const watchIdRef = useRef<number | null>(null);
  const hasFetchedRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<{ marker: mapboxgl.Marker; cleanup: () => void }[]>([]);
  const selfMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const navigate = useNavigate();

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const tokenMissing = !mapboxToken || mapboxToken === '__SET_ME__';

  const fetchNearbyUsers = useCallback(
    async (latitude: number, longitude: number, r: number) => {
      setLoading(true);
      try {
        const res = await usersAPI.getNearby(latitude, longitude, r);
        setUsers(res.data);
        setError('');
      } catch {
        setError('Could not load nearby users.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    usersAPI
      .getMe()
      .then((r) => {
        const until = r.data?.available_until;
        if (until) {
          const d = new Date(until);
          if (d.getTime() > Date.now()) setPulseUntil(d);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!pulseUntil) return;
    const id = window.setInterval(() => {
      if (pulseUntil.getTime() <= Date.now()) {
        setPulseUntil(null);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [pulseUntil]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;
        setLocation(latitude, longitude);
        setMapCenter([latitude, longitude]);
        if (!hasFetchedRef.current) {
          hasFetchedRef.current = true;
          fetchNearbyUsers(latitude, longitude, radius);
        }
      },
      () => {
        setError('Location access denied. Please allow it in your browser settings.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleRadiusCycle = () => {
    const i = RADIUS_OPTIONS.indexOf(radius as any);
    const next = RADIUS_OPTIONS[(i + 1) % RADIUS_OPTIONS.length];
    setRadius(next);
    if (lat && lng) fetchNearbyUsers(lat, lng, next);
  };

  const handleStartPulse = useCallback(
    async (durationMin: 60 | 90 | 120) => {
      try {
        const res = await usersAPI.startPulse(durationMin);
        setPulseUntil(new Date(res.data.available_until));
        setPulseError('');
        if (lat && lng) fetchNearbyUsers(lat, lng, radius);
      } catch (err: any) {
        const msg = err?.response?.data?.error || 'Could not start Pulse.';
        setPulseError(msg);
        setTimeout(() => setPulseError(''), 4000);
        throw err;
      }
    },
    [lat, lng, radius, fetchNearbyUsers],
  );

  const handleStopPulse = useCallback(async () => {
    try {
      await usersAPI.stopPulse();
      setPulseUntil(null);
      if (lat && lng) fetchNearbyUsers(lat, lng, radius);
    } catch {
      // swallow
    }
  }, [lat, lng, radius, fetchNearbyUsers]);

  const handleLike = useCallback(
    async (user: NearbyUser) => {
      if (likedUsers.has(user.id)) {
        navigate(`/messages/${user.id}`);
        return;
      }
      try {
        await usersAPI.likeUser(user.id);
        setLikedUsers((p) => new Set([...p, user.id]));
      } catch {
        // ignore
      }
    },
    [likedUsers, navigate],
  );

  useEffect(() => {
    if (tokenMissing || !mapContainerRef.current || !mapCenter) return;

    if (mapRef.current) {
      mapRef.current.easeTo({ center: [mapCenter[1], mapCenter[0]] });
      selfMarkerRef.current?.setLngLat([mapCenter[1], mapCenter[0]]);
      return;
    }

    mapboxgl.accessToken = mapboxToken!;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [mapCenter[1], mapCenter[0]],
      zoom: 14,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('load', () => setMapLoaded(true));

    const selfEl = document.createElement('div');
    selfEl.className = 'map-self-dot';
    selfMarkerRef.current = new mapboxgl.Marker({ element: selfEl })
      .setLngLat([mapCenter[1], mapCenter[0]])
      .addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      selfMarkerRef.current = null;
      setMapLoaded(false);
    };
  }, [mapCenter, mapboxToken, tokenMissing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    markersRef.current.forEach(({ marker, cleanup }) => {
      marker.remove();
      cleanup();
    });
    markersRef.current = [];

    users.forEach((user) => {
      if (user.lat == null || user.lng == null) return;
      const isPulsing =
        !!user.available_until && new Date(user.available_until).getTime() > Date.now();

      const { element, root } = createMapMarkerElement(
        {
          id: user.id,
          name: user.name,
          photo_url: user.photo_url,
          isPulsing,
          isVerified: !!(user as any).is_verified,
        },
        () => setSelectedUser(user),
        44,
      );

      const marker = new mapboxgl.Marker({ element })
        .setLngLat([Number(user.lng), Number(user.lat)])
        .addTo(map);

      markersRef.current.push({
        marker,
        cleanup: () => {
          setTimeout(() => root.unmount(), 0);
        },
      });
    });
  }, [users, mapLoaded]);

  const onlineCount = users.filter((u) => u.online).length;
  const nearbyCount = users.length;
  const sortedUsers = [...users].sort((a, b) => {
    const ap = !!a.available_until && new Date(a.available_until).getTime() > Date.now() ? 1 : 0;
    const bp = !!b.available_until && new Date(b.available_until).getTime() > Date.now() ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return parseFloat(String(a.distance_km)) - parseFloat(String(b.distance_km));
  });

  return (
    <Layout>
      <div
        className="fixed left-0 right-0 top-14 z-0 bottom-[var(--mobile-tab-bar-height)] sm:bottom-0 bg-[#0D0A06]"
      >
        <div ref={mapContainerRef} className="absolute inset-0" />

        {tokenMissing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center bg-[#0D0A06]">
            <div className="w-14 h-14 rounded-full bg-[var(--copper)]/15 border border-[var(--copper)]/40 flex items-center justify-center mb-3">
              <span className="text-[var(--copper)] text-2xl">·</span>
            </div>
            <p className="text-[var(--cream)] text-sm font-bold">Map unavailable</p>
            <p className="text-[var(--cream-muted)] text-xs mt-1 max-w-xs leading-relaxed">
              Set <code className="text-[var(--copper)]">VITE_MAPBOX_TOKEN</code> in <code className="text-[var(--copper)]">frontend/.env</code> and restart the dev server.
            </p>
          </div>
        )}

        {!tokenMissing && !mapCenter && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0A06]/80 backdrop-blur-sm">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-[var(--copper)]/20 animate-pulse-ring" />
              <span className="w-5 h-5 rounded-full bg-[var(--copper)] border-2 border-[var(--cream)] relative z-10" />
            </div>
            <p className="text-[var(--cream-muted)] text-xs font-medium tracking-widest uppercase mt-3">
              {error || 'Acquiring signal'}
            </p>
          </div>
        )}

        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)]/85 backdrop-blur-sm border border-[var(--border-default)] shadow-md">
          <p className="text-[11px] font-bold text-[var(--cream-soft)] tracking-wide whitespace-nowrap">
            {loading ? (
              <span className="text-[var(--cream-muted)]">Scanning…</span>
            ) : nearbyCount === 0 ? (
              <button onClick={handleRadiusCycle} className="text-[var(--copper)]">
                EXPAND YOUR RADIUS →
              </button>
            ) : (
              <>
                <span className="text-[var(--copper)] font-black">{nearbyCount}</span> NEARBY
                <span className="text-[var(--cream-muted)] mx-1.5">·</span>
                <span className="text-[var(--copper)] font-black">{onlineCount}</span> ONLINE NOW
              </>
            )}
          </p>
        </div>

        <button
          onClick={handleRadiusCycle}
          className="absolute z-30 right-[var(--fab-offset)] top-3 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)]/85 backdrop-blur-sm border border-[var(--border-default)] text-[var(--cream)] text-xs font-bold hover:border-[var(--copper)] transition-colors"
          title="Search radius"
        >
          ▼ {radius} km
        </button>

        {pulseError && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-md bg-[#3D1A1A] border border-[#8B4513] text-[var(--cream)] text-xs">
            {pulseError}
          </div>
        )}

        <PulseFab
          isPulsing={!!pulseUntil}
          pulseExpiresAt={pulseUntil ? pulseUntil.toISOString() : undefined}
          onStartPulse={handleStartPulse}
          onStopPulse={handleStopPulse}
        />

        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ bottom: 0 }}
        >
          <div
            className="h-12 pointer-events-none"
            style={{ background: 'linear-gradient(to top, #0D0A06, transparent)' }}
          />
          <div className="pointer-events-auto pb-2">
            <UserStrip
              users={sortedUsers}
              loading={loading}
              onSelect={setSelectedUser}
            />
          </div>
        </div>
      </div>

      <ProfileDrawer
        user={selectedUser}
        liked={selectedUser ? likedUsers.has(selectedUser.id) : false}
        onClose={() => setSelectedUser(null)}
        onLike={async () => {
          if (!selectedUser) return;
          await handleLike(selectedUser);
        }}
        onMessage={() => {
          if (!selectedUser) return;
          navigate(`/messages/${selectedUser.id}`);
        }}
        onPass={() => setSelectedUser(null)}
      />
    </Layout>
  );
};

interface UserStripProps {
  users: NearbyUser[];
  loading: boolean;
  onSelect: (u: NearbyUser) => void;
}

const UserStrip: React.FC<UserStripProps> = ({ users, loading, onSelect }) => {
  if (loading && users.length === 0) {
    return (
      <div className="user-strip-scroll flex gap-3 overflow-x-auto px-4 pb-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="user-strip-card flex-shrink-0 w-[120px] h-[160px] rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="px-4 pb-3">
        <div className="rounded-2xl bg-[var(--bg-elevated)]/85 backdrop-blur-sm border border-[var(--border-default)] p-4 text-center">
          <p className="text-[var(--cream)] text-sm font-bold">No one nearby</p>
          <p className="text-[var(--cream-muted)] text-xs mt-1">Pulse to wake the map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-strip-scroll flex gap-3 overflow-x-auto px-4 pb-1">
      {users.map((user) => (
        <UserStripCard key={user.id} user={user} onSelect={() => onSelect(user)} />
      ))}
    </div>
  );
};

interface UserStripCardProps {
  user: NearbyUser;
  onSelect: () => void;
}

const UserStripCard: React.FC<UserStripCardProps> = ({ user, onSelect }) => {
  const distance = parseFloat(String(user.distance_km));
  const distLabel = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
  const fullPhotoUrl = getPhotoUrl(user.photo_url);
  const isPulsing =
    !!user.available_until && new Date(user.available_until).getTime() > Date.now();

  return (
    <button
      onClick={onSelect}
      className="user-strip-card flex-shrink-0 w-[120px] h-[160px] rounded-2xl overflow-hidden border border-[var(--border-default)] flex flex-col text-left bg-[var(--bg-elevated)] hover:border-[var(--copper)] transition-colors"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.55)' }}
    >
      <div className="relative w-full" style={{ height: 96, background: 'linear-gradient(135deg,#2A1C0A,#1E1508)' }}>
        {fullPhotoUrl ? (
          <img src={fullPhotoUrl} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <SilhouetteAvatar size={64} variant="card" />
          </div>
        )}
        <div className="absolute bottom-1 left-1">
          <PulsingAvatar isPulsing={isPulsing} size={24} intensity="subtle">
            <div
              className="w-full h-full rounded-full"
              style={{ background: isPulsing ? 'var(--copper)' : 'transparent' }}
            />
          </PulsingAvatar>
        </div>
        {user.online && !isPulsing && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 border border-[var(--bg-elevated)]" />
        )}
      </div>
      <div className="flex-1 px-2 py-1.5 flex flex-col justify-between">
        <div>
          <p className="text-[13px] font-black text-[var(--cream)] truncate">{user.name}</p>
          {user.headline && (
            <p className="text-[11px] text-[var(--cream-soft)] truncate">{user.headline}</p>
          )}
        </div>
        <p className="text-[11px] font-bold text-[var(--copper)]">{distLabel}</p>
      </div>
    </button>
  );
};
