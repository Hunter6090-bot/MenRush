import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { usersAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { ProfileCard, NearbyUser } from '../components/ProfileCard';
import { Layout } from '../components/Layout';

/* ── Map helpers ───────────────────────────────── */

/** Keep map centred on current position */
const MapSync = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
};

/** Radar pulse marker for current user */
const selfIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;inset:0;border-radius:50%;background:#4F8CFF;animation:radarRing 2.4s ease-out infinite;opacity:.5;"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:#4F8CFF;animation:radarRing 2.4s ease-out .8s infinite;opacity:.3;"></div>
      <div style="position:absolute;inset:0;border-radius:50%;background:#4F8CFF;animation:radarRing 2.4s ease-out 1.6s infinite;opacity:.15;"></div>
      <div style="position:relative;width:14px;height:14px;border-radius:50%;background:#4F8CFF;border:2.5px solid white;box-shadow:0 0 16px #4F8CFF80;z-index:10;"></div>
    </div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

const createUserIcon = (user: NearbyUser) =>
  L.divIcon({
    className: '',
    html: `
      <div style="
        width:40px;height:40px;border-radius:50%;
        border:2px solid #4F8CFF;overflow:hidden;
        background:linear-gradient(135deg,#21252D,#1A1D23);
        display:flex;align-items:center;justify-content:center;
        color:#F2F4F8;font-weight:700;font-size:15px;
        box-shadow:0 0 0 3px rgba(79,140,255,.2),0 4px 16px rgba(0,0,0,.5);
        transition:transform .2s;
        font-family:Inter,sans-serif;
      ">
        ${user.photo_url
          ? `<img src="${user.photo_url}" style="width:100%;height:100%;object-fit:cover;" />`
          : `<span>${user.name[0]?.toUpperCase() ?? '?'}</span>`}
      </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });

/* ── Page component ────────────────────────────── */

export const Discover = () => {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [radius, setRadius] = useState(5);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const { lat, lng, setLocation } = useLocationStore();
  const watchIdRef = useRef<number | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchNearbyUsers = useCallback(
    async (latitude: number, longitude: number, r: number) => {
      setLoading(true);
      try {
        const res = await usersAPI.getNearby(latitude, longitude, r);
        setUsers(res.data);
        setError('');
      } catch {
        setError('Could not load nearby users. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

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
      { enableHighAccuracy: true, timeout: 12000 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const handleRefresh = () => {
    if (lat && lng) {
      hasFetchedRef.current = false;
      fetchNearbyUsers(lat, lng, radius);
      hasFetchedRef.current = true;
    }
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (lat && lng) fetchNearbyUsers(lat, lng, newRadius);
  };

  const onlineCount = users.filter((u) => u.online).length;

  return (
    <Layout>
      {/* ── Map ── */}
      <div className="relative w-full" style={{ height: '45vh', minHeight: 280 }}>
        {mapCenter ? (
          <MapContainer
            center={mapCenter}
            zoom={14}
            style={{ width: '100%', height: '100%' }}
            zoomControl={true}
            attributionControl={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains="abcd"
              maxZoom={20}
            />
            <MapSync center={mapCenter} />

            {/* Self marker */}
            <Marker position={mapCenter} icon={selfIcon} />

            {/* User markers */}
            {users.map((user) =>
              user.lat && user.lng ? (
                <Marker
                  key={user.id}
                  position={[Number(user.lat), Number(user.lng)]}
                  icon={createUserIcon(user)}
                >
                  <Popup>
                    <div className="p-2 min-w-[140px]">
                      <p className="font-semibold text-sm text-[#F2F4F8]">{user.name}, {user.age}</p>
                      <p className="text-xs text-[#F2F4F8]/50 mt-0.5">
                        {parseFloat(String(user.distance_km)).toFixed(1)} km away
                      </p>
                      {user.online && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Online now
                        </span>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ) : null
            )}
          </MapContainer>
        ) : (
          <div className="w-full h-full bg-[#1A1D23] flex flex-col items-center justify-center gap-3">
            {error ? (
              <p className="text-[#FF6B6B]/80 text-sm px-8 text-center">{error}</p>
            ) : (
              <>
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-[#4F8CFF]/30 radar-ring-1" />
                  <span className="absolute inset-0 rounded-full bg-[#4F8CFF]/20 radar-ring-2" />
                  <span className="w-4 h-4 rounded-full bg-[#4F8CFF] border-2 border-white/80 shadow-glow-blue relative z-10" />
                </div>
                <p className="text-[#F2F4F8]/40 text-sm">Acquiring location…</p>
              </>
            )}
          </div>
        )}

        {/* Floating controls overlay */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <select
            value={radius}
            onChange={(e) => handleRadiusChange(Number(e.target.value))}
            className="bg-[#1A1D23]/90 backdrop-blur-sm border border-white/10 text-[#F2F4F8] text-xs font-medium px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#4F8CFF] cursor-pointer"
          >
            <option value={1}>1 km</option>
            <option value={2}>2 km</option>
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
          </select>
        </div>
      </div>

      {/* ── Users section ── */}
      <div className="max-w-5xl mx-auto px-4 py-5 pb-6">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#F2F4F8]">
              {loading
                ? 'Searching…'
                : users.length > 0
                ? `${users.length} ${users.length === 1 ? 'person' : 'people'} nearby`
                : 'No one nearby'}
            </h2>
            {onlineCount > 0 && (
              <p className="text-xs text-emerald-400/80 mt-0.5">{onlineCount} online now</p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={!lat || !lng || loading}
            className="flex items-center gap-1.5 text-xs font-medium text-[#4F8CFF] hover:text-[#3a6fe0] disabled:opacity-30 transition-colors"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && !mapCenter && (
          <div className="bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 text-[#FF6B6B]/80 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {/* Skeleton loaders */}
        {loading && users.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#1A1D23] rounded-2xl border border-white/[0.06] overflow-hidden animate-pulse">
                <div className="h-48 bg-white/5" />
                <div className="p-4 space-y-2">
                  <div className="h-3.5 bg-white/5 rounded-lg w-2/3" />
                  <div className="h-3 bg-white/5 rounded-lg w-full" />
                  <div className="h-8 bg-white/5 rounded-xl mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* User cards */}
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-in">
            {users.map((user) => (
              <ProfileCard key={user.id} user={user} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && users.length === 0 && !error && (
          <div className="text-center py-16 animate-fade-in">
            <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-[#4F8CFF]/20 radar-ring-1" />
              <span className="absolute inset-0 rounded-full bg-[#4F8CFF]/15 radar-ring-2" />
              <span className="absolute inset-0 rounded-full bg-[#4F8CFF]/10 radar-ring-3" />
              <RadarIcon className="w-8 h-8 text-[#4F8CFF]/60 relative z-10" />
            </div>
            <p className="text-[#F2F4F8]/60 font-medium">No one nearby right now</p>
            <p className="text-[#F2F4F8]/30 text-sm mt-1">Try expanding the radius</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const RadarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75A6.75 6.75 0 0115.75 9M6.75 9a5.25 5.25 0 0110.5 0M3 9a9 9 0 0118 0M12 9h.008v.008H12V9z" />
  </svg>
);
