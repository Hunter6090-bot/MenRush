import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { NearbyUser } from '../components/ProfileCard';
import { Layout } from '../components/Layout';
import { CoinFlip } from '../components/CoinFlip';
import { getPhotoUrl } from '../components/UserAvatar';

/* ── Ping dot positions for the decorative map ── */
const PING_POSITIONS = [
  { top: '22%', left: '18%', delay: '0s',   size: 10 },
  { top: '55%', left: '68%', delay: '0.6s', size: 8  },
  { top: '35%', left: '80%', delay: '1.1s', size: 11 },
  { top: '70%', left: '30%', delay: '0.3s', size: 9  },
  { top: '15%', left: '55%', delay: '1.5s', size: 7  },
  { top: '80%', left: '78%', delay: '0.9s', size: 8  },
];

/* ── Inline keyframe injection (once) ── */
const INJECT_ID = '__discover_styles__';
if (typeof document !== 'undefined' && !document.getElementById(INJECT_ID)) {
  const s = document.createElement('style');
  s.id = INJECT_ID;
  s.textContent = `
    @keyframes mapPing {
      0%   { transform: scale(1);   opacity: 0.9; }
      60%  { transform: scale(2.8); opacity: 0; }
      100% { transform: scale(2.8); opacity: 0; }
    }
    @keyframes selfPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(196,131,42,0.7); }
      50%       { box-shadow: 0 0 0 12px rgba(196,131,42,0); }
    }
    @keyframes scanLine {
      0%   { transform: translateY(-100%); opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 0.4; }
      100% { transform: translateY(100vh); opacity: 0; }
    }
    @keyframes radarSweep {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ping-dot {
      animation: mapPing 2.4s ease-out infinite;
    }
    .self-dot {
      animation: selfPulse 2s ease-in-out infinite;
    }
    .scan-line {
      animation: scanLine 4s linear infinite;
    }
    .radar-sweep {
      animation: radarSweep 3s linear infinite;
    }
    .fade-slide-up {
      animation: fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
    }
    .user-card-scroll::-webkit-scrollbar { height: 0; }
    .user-card-scroll { scrollbar-width: none; }
    .copper-btn {
      background: linear-gradient(135deg, #C4832A 0%, #8B4513 100%);
      transition: filter 0.2s, transform 0.15s;
    }
    .copper-btn:hover  { filter: brightness(1.12); }
    .copper-btn:active { transform: scale(0.96); }
  `;
  document.head.appendChild(s);
}

/* ── Page component ─────────────────────────────────── */
export const Discover = () => {
  const [users, setUsers]                   = useState<NearbyUser[]>([]);
  const [likedUsers, setLikedUsers]         = useState<Set<string>>(new Set());
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [radius, setRadius]                 = useState(5);
  const [minAge, setMinAge]                 = useState(18);
  const [maxAge, setMaxAge]                 = useState(100);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [showFilters, setShowFilters]       = useState(false);
  const [mapCenter, setMapCenter]           = useState<[number, number] | null>(null);
  const { lat, lng, setLocation }           = useLocationStore();
  const watchIdRef                          = useRef<number | null>(null);
  const hasFetchedRef                       = useRef(false);
  const navigate                            = useNavigate();

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const onlineCount = users.filter(u => u.online).length;
  const nearbyCount = users.length;

  const INTEREST_OPTIONS = [
    'Travel','Music','Food','Sports','Art','Technology',
    'Gaming','Photography','Fitness','Movies','Books','Cooking',
    'Dancing','Hiking','Coffee','Fashion','Yoga','Skateboarding',
    'Climbing','Cycling',
  ];

  /* ── Horizontal card user (first 6) ── */
  const horizontalUsers = users.slice(0, 6);
  /* ── Vertical list (rest) ── */
  const verticalUsers   = users.slice(6);

  return (
    <Layout>
      {/* ── Filter drawer ──────────────────────────────────── */}
      {showFilters && (
        <div
          className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowFilters(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#1E1508] border border-[#3D2B0E] p-6 pb-8 shadow-2xl animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-[#3D2B0E] mx-auto mb-5" />

            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black tracking-tight text-[#F0E0C0]">Discovery Filters</h3>
              <button
                onClick={() => setShowFilters(false)}
                className="w-8 h-8 rounded-full bg-[#3D2B0E]/60 flex items-center justify-center text-[#A89070] hover:text-[#F0E0C0] transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Radius */}
              <div>
                <label className="block text-[10px] font-black text-[#A89070] uppercase tracking-[.18em] mb-3">
                  Search Radius — {radius} km
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 5, 10, 25].map(r => (
                    <button
                      key={r}
                      onClick={() => handleRadiusChange(r)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        radius === r
                          ? 'bg-gradient-to-r from-[#C4832A] to-[#8B4513] border-[#C4832A] text-white'
                          : 'bg-[#0D0A06] border-[#3D2B0E] text-[#A89070] hover:border-[#C4832A]/40'
                      }`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              </div>

              {/* Age Range */}
              <div>
                <label className="block text-[10px] font-black text-[#A89070] uppercase tracking-[.18em] mb-3">
                  Age Range — {minAge} to {maxAge}
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#A89070] w-6">Min</span>
                    <input
                      type="range" min="18" max="100" value={minAge}
                      onChange={e => setMinAge(Math.min(Number(e.target.value), maxAge))}
                      className="flex-1 accent-[#C4832A]"
                    />
                    <span className="text-xs text-[#F0E0C0] w-6 text-right">{minAge}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#A89070] w-6">Max</span>
                    <input
                      type="range" min="18" max="100" value={maxAge}
                      onChange={e => setMaxAge(Math.max(Number(e.target.value), minAge))}
                      className="flex-1 accent-[#C4832A]"
                    />
                    <span className="text-xs text-[#F0E0C0] w-6 text-right">{maxAge}</span>
                  </div>
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="block text-[10px] font-black text-[#A89070] uppercase tracking-[.18em] mb-3">
                  Interests
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {INTEREST_OPTIONS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleInterest(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        selectedInterests.includes(tag)
                          ? 'bg-gradient-to-r from-[#C4832A] to-[#8B4513] border-[#C4832A] text-white'
                          : 'bg-[#0D0A06] border-[#3D2B0E] text-[#A89070] hover:border-[#C4832A]/40'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={applyFilters}
                className="copper-btn w-full py-3.5 rounded-2xl text-white font-black text-sm tracking-wide shadow-lg"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page body ──────────────────────────────────────── */}
      <div className="flex flex-col min-h-full" style={{ background: '#0D0A06' }}>

        {/* ── In-page top bar ── */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-[#3D2B0E]/60"
          style={{ background: 'rgba(13,10,6,0.92)', backdropFilter: 'blur(12px)' }}
        >
          {/* Coin logo — left */}
          <CoinFlip sizeClass="h-10" qrValue="https://nearnow.app" />

          {/* Live count — center */}
          <div className="flex flex-col items-center">
            {loading ? (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C4832A] animate-pulse" />
                <span className="text-xs font-bold text-[#A89070] tracking-wide">Scanning…</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  {onlineCount > 0 && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                  <span className="text-sm font-black text-[#F0E0C0] tracking-tight">
                    {nearbyCount === 0 ? 'No one nearby' : `${nearbyCount} ${nearbyCount === 1 ? 'person' : 'people'} nearby`}
                  </span>
                </div>
                {onlineCount > 0 && (
                  <span className="text-[10px] text-emerald-400/70 font-medium mt-0.5">
                    {onlineCount} online now
                  </span>
                )}
              </>
            )}
          </div>

          {/* Filter + refresh — right */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={!lat || !lng || loading}
              className="w-9 h-9 rounded-xl bg-[#1E1508] border border-[#3D2B0E] flex items-center justify-center text-[#A89070] hover:text-[#C4832A] hover:border-[#C4832A]/40 disabled:opacity-30 transition-all"
              title="Refresh"
            >
              <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowFilters(true)}
              className="w-9 h-9 rounded-xl bg-[#1E1508] border border-[#3D2B0E] flex items-center justify-center text-[#A89070] hover:text-[#C4832A] hover:border-[#C4832A]/40 transition-all"
              title="Filters"
            >
              <FilterIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Map area — top 50% ── */}
        <div
          className="relative w-full overflow-hidden"
          style={{ height: '44vh', minHeight: 240, background: '#0D0A06' }}
        >
          {/* Grid overlay */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#C4832A" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Radar sweep circle — centered */}
          <div
            className="absolute"
            style={{
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 'min(60vw, 260px)', height: 'min(60vw, 260px)',
            }}
          >
            {/* Concentric rings */}
            {[1, 0.66, 0.33].map((scale, i) => (
              <div
                key={i}
                className="absolute rounded-full border border-[#C4832A]/10"
                style={{
                  inset: `${(1 - scale) * 50}%`,
                }}
              />
            ))}

            {/* Rotating sweep */}
            <div
              className="absolute inset-0 rounded-full radar-sweep"
              style={{
                background: 'conic-gradient(from 0deg, rgba(196,131,42,0) 0%, rgba(196,131,42,0.08) 15%, rgba(196,131,42,0.18) 25%, rgba(196,131,42,0) 40%)',
              }}
            />

            {/* Centre self dot */}
            <div
              className="absolute self-dot rounded-full bg-gradient-to-br from-[#C4832A] to-[#8B4513] border-2 border-[#F0E0C0]/60"
              style={{
                width: 14, height: 14,
                top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
              }}
            />
          </div>

          {/* Animated scan line */}
          <div
            className="scan-line absolute left-0 right-0 h-[2px] pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(196,131,42,0.15) 20%, rgba(196,131,42,0.4) 50%, rgba(196,131,42,0.15) 80%, transparent 100%)',
            }}
          />

          {/* Ping dots — nearby users */}
          {PING_POSITIONS.map((pos, i) => (
            <div
              key={i}
              className="absolute"
              style={{ top: pos.top, left: pos.left, animationDelay: pos.delay }}
            >
              {/* Outer ping ring */}
              <div
                className="ping-dot absolute rounded-full bg-[#C4832A]/40"
                style={{
                  width: pos.size * 2.2,
                  height: pos.size * 2.2,
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  animationDelay: pos.delay,
                }}
              />
              {/* Inner solid dot */}
              <div
                className="relative rounded-full bg-gradient-to-br from-[#C4832A] to-[#8B4513] border border-[#F0E0C0]/30"
                style={{ width: pos.size, height: pos.size }}
              />
            </div>
          ))}

          {/* Status overlay — acquiring / error */}
          {!mapCenter && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0D0A06]/70 backdrop-blur-sm">
              {error ? (
                <div className="text-center px-8">
                  <LocationOffIcon className="w-10 h-10 text-[#8B4513]/60 mx-auto mb-2" />
                  <p className="text-[#F0E0C0]/50 text-sm">{error}</p>
                </div>
              ) : (
                <>
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-[#C4832A]/20 radar-ring-1" />
                    <span className="absolute inset-0 rounded-full bg-[#C4832A]/12 radar-ring-2" />
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#C4832A] to-[#8B4513] border-2 border-[#F0E0C0]/50 relative z-10" />
                  </div>
                  <p className="text-[#A89070] text-xs font-medium tracking-widest uppercase">Acquiring signal</p>
                </>
              )}
            </div>
          )}

          {/* Map corner label */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#0D0A06]/70 backdrop-blur-sm border border-[#3D2B0E]/50 rounded-lg px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C4832A]" />
            <span className="text-[10px] font-bold text-[#A89070] uppercase tracking-widest">Live radar</span>
          </div>

          {/* Radius badge */}
          <div className="absolute bottom-3 right-3">
            <select
              value={radius}
              onChange={e => handleRadiusChange(Number(e.target.value))}
              className="bg-[#0D0A06]/80 backdrop-blur-sm border border-[#3D2B0E]/60 text-[#F0E0C0] text-xs font-bold px-3 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#C4832A] cursor-pointer"
            >
              <option value={1}>1 km</option>
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={25}>25 km</option>
            </select>
          </div>

          {/* Bottom fade into content */}
          <div
            className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, #0D0A06)' }}
          />
        </div>

        {/* ── Bottom half — users ── */}
        <div className="flex-1 px-0 pb-6" style={{ minHeight: '44vh' }}>

          {/* ── Skeleton loaders ── */}
          {loading && users.length === 0 && (
            <div className="px-4 pt-4">
              <div className="flex gap-3 overflow-hidden pb-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 w-36 h-52 rounded-2xl bg-[#1E1508] border border-[#3D2B0E] animate-pulse"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="h-28 rounded-t-2xl bg-[#3D2B0E]/30" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-[#3D2B0E]/40" />
                      <div className="h-2.5 w-1/2 rounded bg-[#3D2B0E]/30" />
                      <div className="h-7 w-full rounded-xl bg-[#3D2B0E]/30 mt-3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Error banner ── */}
          {error && mapCenter && (
            <div className="mx-4 mt-4 bg-[#8B4513]/10 border border-[#8B4513]/20 text-[#F0E0C0]/60 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* ── Empty state ── */}
          {!loading && users.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center fade-slide-up">
              <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-[#C4832A]/15 radar-ring-1" />
                <span className="absolute inset-0 rounded-full bg-[#C4832A]/10 radar-ring-2" />
                <span className="absolute inset-0 rounded-full bg-[#C4832A]/06 radar-ring-3" />
                <RadarIcon className="w-9 h-9 text-[#C4832A]/50 relative z-10" />
              </div>
              <p className="text-[#F0E0C0]/50 font-black tracking-tight text-base">Nobody nearby</p>
              <p className="text-[#A89070] text-sm mt-1 font-medium">Try expanding your radius</p>
              <button
                onClick={() => setShowFilters(true)}
                className="copper-btn mt-5 px-6 py-2.5 rounded-xl text-white text-xs font-black tracking-wide"
              >
                Adjust Filters
              </button>
            </div>
          )}

          {/* ── Horizontal scroll row ── */}
          {!loading && horizontalUsers.length > 0 && (
            <div className="fade-slide-up">
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <span className="text-[10px] font-black text-[#A89070] uppercase tracking-[.18em]">
                  Nearby people
                </span>
                {verticalUsers.length > 0 && (
                  <span className="text-[10px] text-[#C4832A]/70 font-bold">
                    +{verticalUsers.length} more below
                  </span>
                )}
              </div>
              <div className="user-card-scroll flex gap-3 overflow-x-auto px-4 pb-2">
                {horizontalUsers.map((user, idx) => (
                  <HorizontalUserCard
                    key={user.id}
                    user={user}
                    liked={likedUsers.has(user.id)}
                    onLike={async () => {
                      if (likedUsers.has(user.id)) { navigate(`/messages/${user.id}`); return; }
                      try { await usersAPI.likeUser(user.id); setLikedUsers(p => new Set([...p, user.id])); } catch {}
                    }}
                    onMessage={() => navigate(`/messages/${user.id}`)}
                    animDelay={`${idx * 0.07}s`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Vertical list ── */}
          {!loading && verticalUsers.length > 0 && (
            <div className="px-4 mt-2 space-y-3 fade-slide-up">
              <span className="block text-[10px] font-black text-[#A89070] uppercase tracking-[.18em] mb-1 mt-2">
                More nearby
              </span>
              {verticalUsers.map((user, idx) => (
                <VerticalUserRow
                  key={user.id}
                  user={user}
                  liked={likedUsers.has(user.id)}
                  onAction={async () => {
                    if (likedUsers.has(user.id)) { navigate(`/messages/${user.id}`); return; }
                    try { await usersAPI.likeUser(user.id); setLikedUsers(p => new Set([...p, user.id])); } catch {}
                  }}
                  animDelay={`${idx * 0.06}s`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating action button ── */}
      <button
        onClick={handleRefresh}
        disabled={!lat || !lng || loading}
        className="copper-btn fixed bottom-20 right-4 sm:bottom-6 z-[500] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center disabled:opacity-40"
        title="Refresh location"
        style={{ boxShadow: '0 4px 24px rgba(196,131,42,0.35)' }}
      >
        <LocationPinIcon className="w-6 h-6 text-white" />
      </button>
    </Layout>
  );
};

/* ── Horizontal scroll card ─────────────────────────── */
interface CardProps {
  user: NearbyUser;
  liked: boolean;
  onLike: () => void;
  onMessage: () => void;
  animDelay: string;
}

const HorizontalUserCard: React.FC<CardProps> = ({ user, liked, onLike, onMessage, animDelay }) => {
  const distance = parseFloat(String(user.distance_km));
  const distLabel = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
  const fullPhotoUrl = getPhotoUrl(user.photo_url);

  return (
    <div
      className="fade-slide-up flex-shrink-0 w-36 rounded-2xl overflow-hidden border border-[#3D2B0E] flex flex-col"
      style={{
        background: '#1E1508',
        animationDelay: animDelay,
        boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
      }}
    >
      {/* Photo */}
      <div className="relative h-28 bg-gradient-to-br from-[#2A1C0A] to-[#1E1508] flex-shrink-0">
        {fullPhotoUrl ? (
          <img src={fullPhotoUrl} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl font-black text-[#C4832A]/25">{user.name[0]?.toUpperCase()}</span>
          </div>
        )}
        {/* Gradient */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #1E1508 0%, transparent 55%)' }} />
        {/* Online dot */}
        {user.online && (
          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-[#1E1508]" />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col flex-1 gap-1.5">
        <div>
          <p className="text-[#F0E0C0] text-xs font-black leading-tight truncate">{user.name}</p>
          <p className="text-[#A89070] text-[10px] font-medium">{distLabel} away</p>
        </div>
        <button
          onClick={liked ? onMessage : onLike}
          className="copper-btn mt-auto w-full py-1.5 rounded-xl text-white text-[10px] font-black tracking-wide"
        >
          {liked ? 'Message' : 'Connect'}
        </button>
      </div>
    </div>
  );
};

/* ── Vertical list row ──────────────────────────────── */
interface RowProps {
  user: NearbyUser;
  liked: boolean;
  onAction: () => void;
  animDelay: string;
}

const VerticalUserRow: React.FC<RowProps> = ({ user, liked, onAction, animDelay }) => {
  const distance = parseFloat(String(user.distance_km));
  const distLabel = distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`;
  const fullPhotoUrl = getPhotoUrl(user.photo_url);

  return (
    <div
      className="fade-slide-up flex items-center gap-3 p-3 rounded-2xl border border-[#3D2B0E] hover:border-[#C4832A]/25 transition-all"
      style={{ background: '#1E1508', animationDelay: animDelay }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#3D2B0E] flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #2A1C0A, #1E1508)' }}
        >
          {fullPhotoUrl ? (
            <img src={fullPhotoUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-black text-[#C4832A]/40">{user.name[0]?.toUpperCase()}</span>
          )}
        </div>
        {user.online && (
          <span className="absolute bottom-0 right-0 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-[#1E1508]" />
          </span>
        )}
      </div>

      {/* Name + distance */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[#F0E0C0] text-sm font-black truncate">{user.name}</p>
          {user.age && <span className="text-[#A89070] text-xs">{user.age}</span>}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <PinSmIcon className="w-3 h-3 text-[#C4832A]/70 flex-shrink-0" />
          <span className="text-[#A89070] text-xs font-medium">{distLabel}</span>
          {user.headline && (
            <>
              <span className="text-[#3D2B0E] mx-0.5">·</span>
              <span className="text-[#A89070] text-xs truncate">{user.headline}</span>
            </>
          )}
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={onAction}
        className="copper-btn flex-shrink-0 px-4 py-2 rounded-xl text-white text-xs font-black tracking-wide"
      >
        {liked ? 'Message' : 'Connect'}
      </button>
    </div>
  );
};

/* ── Icons ──────────────────────────────────────────── */
const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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

const RadarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75A6.75 6.75 0 0115.75 9M6.75 9a5.25 5.25 0 0110.5 0M3 9a9 9 0 0118 0M12 9h.008v.008H12V9z" />
  </svg>
);

const LocationPinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
  </svg>
);

const LocationOffIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 17.364A9 9 0 005.636 4.636m12.728 12.728A9 9 0 015.636 4.636m12.728 12.728L4.636 4.636" />
  </svg>
);

const PinSmIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
  </svg>
);
