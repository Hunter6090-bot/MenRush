import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { usersAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { ProfileCard, NearbyUser } from '../components/ProfileCard';
import { Layout } from '../components/Layout';
import { getPhotoUrl } from '../components/UserAvatar';

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

const createUserIcon = (user: NearbyUser) => {
  const fullPhotoUrl = getPhotoUrl(user.photo_url);
  return L.divIcon({
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
        ${fullPhotoUrl
          ? `<img src="${fullPhotoUrl}" style="width:100%;height:100%;object-fit:cover;" />`
          : `<span>${user.name[0]?.toUpperCase() ?? '?'}</span>`}
      </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
};

/* ── Page component ────────────────────────────── */

export const Discover = () => {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [likedUsers, setLikedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [radius, setRadius] = useState(5);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(100);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const { lat, lng, setLocation } = useLocationStore();
  const watchIdRef = useRef<number | null>(null);
  const hasFetchedRef = useRef(false);
  const navigate = useNavigate();

  const fetchNearbyUsers = useCallback(
    async (latitude: number, longitude: number, r: number, filters?: any) => {
      setLoading(true);
      try {
        const res = await usersAPI.getNearby(latitude, longitude, r, filters);
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
          fetchNearbyUsers(latitude, longitude, radius, { minAge, maxAge, interests: selectedInterests });
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
      fetchNearbyUsers(lat, lng, radius, { minAge, maxAge, interests: selectedInterests });
      hasFetchedRef.current = true;
    }
  };

  const handleRadiusChange = (newRadius: number) => {
    setRadius(newRadius);
    if (lat && lng) fetchNearbyUsers(lat, lng, newRadius, { minAge, maxAge, interests: selectedInterests });
  };

  const applyFilters = () => {
    setShowFilters(false);
    if (lat && lng) fetchNearbyUsers(lat, lng, radius, { minAge, maxAge, interests: selectedInterests });
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const onlineCount = users.filter((u) => u.online).length;

  const INTEREST_OPTIONS = [
    'Travel', 'Music', 'Food', 'Sports', 'Art', 'Technology',
    'Gaming', 'Photography', 'Fitness', 'Movies', 'Books', 'Cooking',
    'Dancing', 'Hiking', 'Coffee', 'Fashion', 'Yoga', 'Skateboarding',
    'Climbing', 'Cycling',
  ];

  return (
    <Layout>
      {/* ── Filter Modal ── */}
      {showFilters && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1A1D23] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#F2F4F8]">Discovery Filters</h3>
              <button onClick={() => setShowFilters(false)} className="text-[#F2F4F8]/40 hover:text-[#F2F4F8] transition-colors">
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Age Range */}
              <div>
                <label className="block text-xs font-bold text-[#F2F4F8]/40 uppercase tracking-widest mb-3">Age Range: {minAge} - {maxAge}</label>
                <div className="flex gap-4">
                  <input
                    type="range"
                    min="18"
                    max="100"
                    value={minAge}
                    onChange={(e) => setMinAge(Math.min(Number(e.target.value), maxAge))}
                    className="flex-1 accent-[#4F8CFF]"
                  />
                  <input
                    type="range"
                    min="18"
                    max="100"
                    value={maxAge}
                    onChange={(e) => setMaxAge(Math.max(Number(e.target.value), minAge))}
                    className="flex-1 accent-[#4F8CFF]"
                  />
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="block text-xs font-bold text-[#F2F4F8]/40 uppercase tracking-widest mb-3">Filter by Interests</label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {INTEREST_OPTIONS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleInterest(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        selectedInterests.includes(tag)
                          ? 'bg-[#4F8CFF] border-[#4F8CFF] text-white shadow-glow-blue/40'
                          : 'bg-white/5 border-white/10 text-[#F2F4F8]/60 hover:bg-white/10'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={applyFilters}
                className="w-full py-3.5 rounded-2xl bg-[#4F8CFF] hover:bg-[#3a6fe0] text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

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
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
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
                    <div className="p-2 min-w-[160px]">
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
                      <button
                        onClick={async () => {
                          if (likedUsers.has(user.id)) {
                            navigate(`/messages/${user.id}`);
                            return;
                          }
                          try {
                            await usersAPI.likeUser(user.id);
                            setLikedUsers(prev => new Set([...prev, user.id]));
                          } catch {}
                        }}
                        className="mt-2 w-full py-1.5 rounded-lg bg-[#4F8CFF] hover:bg-[#3a6fe0] text-white text-xs font-semibold transition-colors"
                      >
                        {likedUsers.has(user.id) ? 'Message' : 'Like'}
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ) : null
            )}
          </MapContainer>
        ) : (
          <div className="w-full h-full bg-[#222632] flex flex-col items-center justify-center gap-3">
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
            className="bg-[#222632]/90 backdrop-blur-sm border border-white/10 text-[#F2F4F8] text-xs font-medium px-2.5 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#4F8CFF] cursor-pointer"
          >
            <option value={1}>1 km</option>
            <option value={2}>2 km</option>
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
          </select>

          <button
            onClick={() => setShowFilters(true)}
            className="flex items-center justify-center gap-1.5 bg-[#222632]/90 backdrop-blur-sm border border-white/10 text-[#F2F4F8] text-xs font-medium px-2.5 py-1.5 rounded-xl hover:bg-white/5 transition-all"
          >
            <FilterIcon className="w-3.5 h-3.5" />
            Filters
          </button>
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

const FilterIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
