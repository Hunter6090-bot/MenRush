import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Root } from 'react-dom/client';
import { Link, useNavigate } from 'react-router-dom';
import { EventDTO, pulseAPI, usersAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { NearbyUser } from '../components/ProfileCard';
import { Layout } from '../components/Layout';
import { SilhouetteAvatar } from '../components/SilhouetteAvatar';
import { PulsingAvatar } from '../components/PulsingAvatar';
import { PulseFab } from '../components/PulseFab';
import { ProximitySlider, RADIUS_OPTIONS } from '../components/ProximitySlider';
import { ProfileDrawer } from '../components/ProfileDrawer';
import { createMapMarkerElement, MapMarker } from '../components/MapMarker';
import { getPhotoUrl, UserAvatar } from '../components/UserAvatar';
import { TribePillRow } from '../components/TribePillRow';
import { EventsRail } from '../components/EventsRail';
import { MoodBadge } from '../components/MoodPicker';
import { getDistanceLabel, isUserPulsing, distanceMeters } from '../lib/discovery';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  discoveryResultBucket,
  trackEventOnce,
} from '../observability/analytics';
import { ROUTE_LABELS } from '../lib/routeLabels';


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
    .mapboxgl-map,
    .mapboxgl-canvas-container,
    .mapboxgl-canvas {
      width: 100% !important;
      height: 100% !important;
    }
    .map-self-dot {
      width: 18px; height: 18px; border-radius: 50%;
      background: var(--copper);
      border: 3px solid var(--cream);
      box-shadow: 0 0 0 6px rgba(196,131,42,0.18), 0 2px 10px rgba(196,131,42,0.55);
      position: relative;
    }
    .map-self-dot--pulsing {
      width: 22px; height: 22px;
      box-shadow: 0 0 0 8px rgba(196,131,42,0.28), 0 0 24px rgba(196,131,42,0.75);
      animation: pulse-breathe 2s ease-in-out infinite;
    }
    .map-self-dot--pulsing::before,
    .map-self-dot--pulsing::after {
      content: '';
      position: absolute;
      inset: -10px;
      border-radius: 50%;
      border: 2px solid rgba(196,131,42,0.65);
      pointer-events: none;
    }
    .map-self-dot--pulsing::before { animation: pulse-ring 2s ease-out infinite; }
    .map-self-dot--pulsing::after { animation: pulse-ring 2s ease-out 1s infinite; }
  `;
  document.head.appendChild(s);
}

const DEFAULT_DISCOVERY_CENTER: [number, number] = [51.5136, -0.1365];
const INSECURE_GPS_NOTICE =
  'Live location on your phone needs a secure (HTTPS) link. Open the team tunnel URL — not the plain IP address — then allow location.';

/** Min interval between nearby roster API calls during live GPS. */
const NEARBY_FETCH_MIN_MS = 20_000;
/** Min movement before panning the map (avoids constant easeTo flicker). */
const MAP_PAN_MIN_METERS = 50;
/** Min movement before re-querying nearby users on GPS drift. */
const NEARBY_REFETCH_MIN_METERS = 80;

export const Discover = () => {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [likedUsers, setLikedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [radius, setRadius] = useState<number>(5);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [pulseUntil, setPulseUntil] = useState<Date | null>(null);
  const [nextPulseAllowedAt, setNextPulseAllowedAt] = useState<string | null>(null);
  const [pulseIsPremium, setPulseIsPremium] = useState(false);
  const [pulseError, setPulseError] = useState('');
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');

  const { lat, lng, setLocation } = useLocationStore();
  const watchIdRef = useRef<number | null>(null);
  const hasFetchedRef = useRef(false);
  const savedProfileLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastGpsFetchRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const lastMapPanRef = useRef<{ lat: number; lng: number } | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const usingFallbackLocationRef = useRef(false);
  const hasLiveGpsRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; root: Root; user: NearbyUser }>>(new Map());
  const selfMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const selfDotRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const tokenMissing = !mapboxToken || mapboxToken === '__SET_ME__';

  const fetchNearbyUsers = useCallback(
    async (
      latitude: number,
      longitude: number,
      r: number,
      tags?: string[],
      options?: { background?: boolean },
    ) => {
      if (!options?.background) setLoading(true);
      try {
        await usersAPI.updateLocation(latitude, longitude).catch(() => {});
        const res = await usersAPI.getNearby(
          latitude,
          longitude,
          r,
          tags && tags.length > 0 ? { interests: tags } : undefined,
        );
        setUsers(res.data);
        trackEventOnce(
          'first_discovery_load',
          { outcome: 'succeeded', result_bucket: discoveryResultBucket(res.data.length) },
          'first_discovery_load',
        );
        setError('');
      } catch {
        trackEventOnce(
          'first_discovery_load',
          { outcome: 'failed', result_bucket: 'unknown' },
          'first_discovery_load',
        );
        setError('Could not load nearby users.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const useDiscoveryLocation = useCallback(
    (latitude: number, longitude: number, notice = '', forceRefresh = false) => {
      setLocation(latitude, longitude);
      setMapCenter([latitude, longitude]);
      setLocationNotice(notice);
      if (forceRefresh || !hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchNearbyUsers(latitude, longitude, radius, tagFilters);
      }
    },
    [fetchNearbyUsers, radius, setLocation, tagFilters],
  );

  const applyLiveGps = useCallback(
    (latitude: number, longitude: number, options?: { force?: boolean }) => {
      const recoveringFromFallback = usingFallbackLocationRef.current;
      if (recoveringFromFallback) {
        usingFallbackLocationRef.current = false;
      }
      hasLiveGpsRef.current = true;

      setLocation(latitude, longitude);
      setLocationNotice('');

      const farFromPin =
        mapCenter != null &&
        distanceMeters(mapCenter[0], mapCenter[1], latitude, longitude) >= MAP_PAN_MIN_METERS;
      const shouldRecenter =
        !mapRef.current || recoveringFromFallback || options?.force || farFromPin;

      if (!mapCenter || shouldRecenter) {
        setMapCenter([latitude, longitude]);
      }

      if (mapRef.current) {
        selfMarkerRef.current?.setLngLat([longitude, latitude]);
        if (shouldRecenter) {
          lastMapPanRef.current = { lat: latitude, lng: longitude };
          mapRef.current.easeTo({ center: [longitude, latitude], duration: 700 });
        }
      }

      const now = Date.now();
      const lastFetch = lastGpsFetchRef.current;
      const movedEnough =
        !lastFetch ||
        distanceMeters(lastFetch.lat, lastFetch.lng, latitude, longitude) >= NEARBY_REFETCH_MIN_METERS;
      const waitedEnough = !lastFetch || now - lastFetch.at >= NEARBY_FETCH_MIN_MS;
      const shouldFetch =
        options?.force ||
        recoveringFromFallback ||
        !hasFetchedRef.current ||
        (movedEnough && waitedEnough);

      if (!shouldFetch) return;

      const isBackground = lastFetch != null && !recoveringFromFallback;
      hasFetchedRef.current = true;
      lastGpsFetchRef.current = { lat: latitude, lng: longitude, at: now };
      fetchNearbyUsers(latitude, longitude, radius, tagFilters, { background: isBackground });
    },
    [fetchNearbyUsers, mapCenter, radius, setLocation, tagFilters],
  );

  // Customer-facing "enable location" action for the fallback notice.
  const handleEnableLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    if (!window.isSecureContext) {
      setLocationNotice(INSECURE_GPS_NOTICE);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        useDiscoveryLocation(coords.latitude, coords.longitude, '', true);
      },
      () => {
        // Still blocked — keep the friendly fallback notice in place.
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [useDiscoveryLocation]);

  const applyLocationFallback = useCallback(() => {
    if (hasFetchedRef.current || hasLiveGpsRef.current) return;

    usingFallbackLocationRef.current = true;

    const saved = savedProfileLocationRef.current;
    if (saved) {
      useDiscoveryLocation(
        saved.lat,
        saved.lng,
        window.isSecureContext
          ? 'Using your last saved location.'
          : INSECURE_GPS_NOTICE,
        true,
      );
      return;
    }

    useDiscoveryLocation(
      DEFAULT_DISCOVERY_CENTER[0],
      DEFAULT_DISCOVERY_CENTER[1],
      window.isSecureContext
        ? 'Location access is off. Showing people near central London for now.'
        : INSECURE_GPS_NOTICE,
    );
  }, [useDiscoveryLocation]);

  useEffect(() => {
    pulseAPI
      .getMe()
      .then((res) => {
        const expiresAt = res.data?.pulse_expires_at;
        setPulseUntil(expiresAt ? new Date(expiresAt) : null);
        setNextPulseAllowedAt(res.data?.next_pulse_allowed_at ?? null);
        setPulseIsPremium(!!res.data?.is_premium);
      })
      .catch(() => {});

    usersAPI
      .getMe()
      .then((r) => {
        const until = r.data?.pulse_expires_at || r.data?.available_until;
        if (until) {
          const d = new Date(until);
          if (d.getTime() > Date.now()) {
            setPulseUntil((current) => current ?? d);
          }
        }
        if (r.data?.lat != null && r.data?.lng != null) {
          const savedLat = Number(r.data.lat);
          const savedLng = Number(r.data.lng);
          savedProfileLocationRef.current = { lat: savedLat, lng: savedLng };
          if (!hasLiveGpsRef.current && !hasFetchedRef.current) {
            useDiscoveryLocation(savedLat, savedLng, '', true);
          }
        }
      })
      .catch(() => {});
  }, [useDiscoveryLocation]);

  // Render map tiles immediately while GPS resolves; saved profile / GPS recentre later.
  useEffect(() => {
    if (tokenMissing) return;
    setMapCenter((current) => current ?? DEFAULT_DISCOVERY_CENTER);
  }, [tokenMissing]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setLocationNotice(INSECURE_GPS_NOTICE);
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = window.setTimeout(() => {
        applyLocationFallback();
      }, 2500);
    }
  }, [applyLocationFallback]);

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
      trackEventOnce(
        'location_permission_outcome',
        { outcome: 'unsupported' },
        'location_permission_outcome',
      );
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        trackEventOnce(
          'location_permission_outcome',
          { outcome: 'granted' },
          'location_permission_outcome',
        );
        const { latitude, longitude } = coords;
        applyLiveGps(latitude, longitude);
      },
      (positionError) => {
        trackEventOnce(
          'location_permission_outcome',
          {
            outcome: positionError.code === positionError.PERMISSION_DENIED ? 'denied' : 'unavailable',
          },
          'location_permission_outcome',
        );
        if (!hasFetchedRef.current && !hasLiveGpsRef.current) {
          if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = window.setTimeout(() => {
            applyLocationFallback();
          }, window.isSecureContext ? 8000 : 2500);
        }
        setError('');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
    };
  }, [applyLiveGps, applyLocationFallback]);

  // Live proximity: refresh the nearby roster every 20s using the latest location.
  useEffect(() => {
    if (lat == null || lng == null) return;
    const id = window.setInterval(() => {
      fetchNearbyUsers(lat, lng, radius, tagFilters, { background: true });
    }, NEARBY_FETCH_MIN_MS);
    return () => window.clearInterval(id);
  }, [lat, lng, radius, tagFilters, fetchNearbyUsers]);

  const handleRadiusChange = useCallback(
    (next: (typeof RADIUS_OPTIONS)[number]) => {
      setRadius(next);
      if (lat != null && lng != null) fetchNearbyUsers(lat, lng, next, tagFilters);
    },
    [lat, lng, tagFilters, fetchNearbyUsers],
  );

  const handleRadiusCycle = () => {
    const i = RADIUS_OPTIONS.indexOf(radius as (typeof RADIUS_OPTIONS)[number]);
    const next = RADIUS_OPTIONS[(i + 1) % RADIUS_OPTIONS.length];
    handleRadiusChange(next);
  };

  const toggleTag = useCallback(
    (tag: string) => {
      setTagFilters((prev) => {
        const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
        if (lat != null && lng != null) fetchNearbyUsers(lat, lng, radius, next);
        return next;
      });
    },
    [lat, lng, radius, fetchNearbyUsers],
  );

  const clearTags = useCallback(() => {
    setTagFilters([]);
    if (lat != null && lng != null) fetchNearbyUsers(lat, lng, radius, []);
  }, [lat, lng, radius, fetchNearbyUsers]);

  const handleStartPulse = useCallback(
    async (durationMin: 60 | 90 | 120) => {
      try {
        const res = await pulseAPI.start(durationMin);
        setPulseUntil(new Date(res.data.expires_at));
        setNextPulseAllowedAt(null);
        setPulseError('');
        if (lat != null && lng != null) fetchNearbyUsers(lat, lng, radius, tagFilters);
      } catch (err: any) {
        const cooldownAt = err?.response?.data?.next_pulse_allowed_at;
        if (cooldownAt) {
          setNextPulseAllowedAt(cooldownAt);
        }
        const msg = err?.response?.data?.error === 'cooldown'
          ? 'Pulse is cooling down.'
          : err?.response?.data?.error || 'Could not start Pulse.';
        setPulseError(msg);
        setTimeout(() => setPulseError(''), 4000);
        throw err;
      }
    },
    [lat, lng, radius, tagFilters, fetchNearbyUsers],
  );

  const handleStopPulse = useCallback(async () => {
    try {
      await pulseAPI.stop();
      setPulseUntil(null);
      const state = await pulseAPI.getMe().catch(() => null);
      setNextPulseAllowedAt(state?.data?.next_pulse_allowed_at ?? null);
      if (lat != null && lng != null) fetchNearbyUsers(lat, lng, radius, tagFilters);
    } catch {
      // swallow
    }
  }, [lat, lng, radius, tagFilters, fetchNearbyUsers]);

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
    if (!selectedUser) return;
    const fresh = users.find((user) => user.id === selectedUser.id);
    if (fresh) setSelectedUser(fresh);
  }, [users, selectedUser]);

  useEffect(() => {
    if (tokenMissing || !mapContainerRef.current) return;

    if (mapRef.current) return;

    const startCenter = mapCenter ?? DEFAULT_DISCOVERY_CENTER;
    mapboxgl.accessToken = mapboxToken!;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [startCenter[1], startCenter[0]],
      zoom: 14,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserHeading: false,
      }),
      'bottom-right',
    );
    const resizeMap = () => map.resize();
    map.on('load', () => {
      resizeMap();
      setMapLoaded(true);
    });
    window.addEventListener('resize', resizeMap);
    requestAnimationFrame(resizeMap);
    window.setTimeout(resizeMap, 100);
    window.setTimeout(resizeMap, 500);

    const selfEl = document.createElement('div');
    selfEl.className = 'map-self-dot';
    selfDotRef.current = selfEl;
    selfMarkerRef.current = new mapboxgl.Marker({ element: selfEl })
      .setLngLat([startCenter[1], startCenter[0]])
      .addTo(map);

    mapRef.current = map;
    return () => {
      window.removeEventListener('resize', resizeMap);
      markersRef.current.forEach(({ marker, root }) => {
        marker.remove();
        setTimeout(() => root.unmount(), 0);
      });
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      selfMarkerRef.current = null;
      selfDotRef.current = null;
      setMapLoaded(false);
    };
    // mapCenter excluded — GPS updates recenter via applyLiveGps/easeTo, not map teardown.
  }, [mapboxToken, tokenMissing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const visibleIds = new Set<string>();

    users.forEach((user) => {
      if (user.lat == null || user.lng == null) return;
      visibleIds.add(user.id);
      const isPulsing = isUserPulsing(user);
      const markerUser = {
        id: user.id,
        name: user.name,
        photo_url: user.photo_url,
        isPulsing,
        isVerified: !!(user as any).is_verified,
      };
      const lngLat: [number, number] = [Number(user.lng), Number(user.lat)];
      const existing = markersRef.current.get(user.id);

      if (existing) {
        const prevLat = Number(existing.user.lat);
        const prevLng = Number(existing.user.lng);
        const nextLat = Number(user.lat);
        const nextLng = Number(user.lng);
        if (
          Number.isFinite(prevLat) &&
          Number.isFinite(prevLng) &&
          (prevLat !== nextLat || prevLng !== nextLng)
        ) {
          existing.marker.setLngLat(lngLat);
        }
        const prev = existing.user;
        const visualChanged =
          prev.name !== user.name ||
          prev.photo_url !== user.photo_url ||
          isUserPulsing(prev) !== isPulsing ||
          !!(prev as any).is_verified !== !!(user as any).is_verified;
        if (visualChanged) {
          const markerSize = isPulsing ? 52 : 44;
          existing.root.render(<MapMarker user={markerUser} size={markerSize} />);
          const el = existing.marker.getElement();
          el.style.width = `${markerSize}px`;
          el.style.height = `${markerSize}px`;
        }
        existing.user = user;
        return;
      }

      const { element, root } = createMapMarkerElement(
        markerUser,
        () => setSelectedUser(user),
        isPulsing ? 52 : 44,
      );

      const marker = new mapboxgl.Marker({ element })
        .setLngLat(lngLat)
        .addTo(map);

      markersRef.current.set(user.id, { marker, root, user });
    });

    markersRef.current.forEach(({ marker, root }, userId) => {
      if (visibleIds.has(userId)) return;
      marker.remove();
      setTimeout(() => root.unmount(), 0);
      markersRef.current.delete(userId);
    });
  }, [users, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || lat == null || lng == null) return;
    selfMarkerRef.current?.setLngLat([lng, lat]);
  }, [mapLoaded, lat, lng]);

  useEffect(() => {
    const dot = selfDotRef.current;
    if (!dot) return;
    dot.className = pulseUntil ? 'map-self-dot map-self-dot--pulsing' : 'map-self-dot';
  }, [pulseUntil]);

  const onlineCount = users.filter((u) => u.online).length;
  const nearbyCount = users.length;
  const sortedUsers = [...users].sort((a, b) => {
    const ap = isUserPulsing(a) ? 1 : 0;
    const bp = isUserPulsing(b) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return parseFloat(String(a.distance_km)) - parseFloat(String(b.distance_km));
  });

  return (
    <Layout>
      <h1 className="sr-only">Nearby discovery map</h1>
      <div
        className="fixed left-0 right-0 top-[var(--mobile-header-height)] z-0 bottom-[var(--mobile-tab-bar-height)] bg-[#0D0A06] lg:left-[var(--desktop-sidebar-width)] lg:top-[var(--desktop-workspace-header)] lg:bottom-0"
      >
        <div className="absolute left-0 right-0 top-[104px] bottom-[188px] z-0 overflow-hidden border-y border-[var(--border-default)] bg-[#11100E] lg:top-0 lg:bottom-0 lg:right-[360px] lg:border-y-0 lg:border-r">
          <div className="absolute inset-0">
            <div ref={mapContainerRef} className="h-full w-full" />
          </div>

          {tokenMissing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center bg-[#0D0A06]">
              <div className="w-14 h-14 rounded-full bg-[var(--copper)]/15 border border-[var(--copper)]/40 flex items-center justify-center mb-3">
                <span className="text-[var(--copper)] text-2xl">·</span>
              </div>
              <p className="text-[var(--cream)] text-sm font-bold">Map is taking a break</p>
              <p className="text-[var(--cream-muted)] text-xs mt-1 max-w-xs leading-relaxed">
                We can’t load the map right now. You can still browse who’s nearby below.
              </p>
              {import.meta.env.DEV && (
                <p className="text-[var(--cream-muted)]/70 text-[10px] mt-2 max-w-xs leading-relaxed">
                  Dev note: set <code className="text-[var(--copper)]">VITE_MAPBOX_TOKEN</code> in{' '}
                  <code className="text-[var(--copper)]">frontend/.env</code> and restart the dev server.
                </p>
              )}
            </div>
          )}

          {!tokenMissing && !mapCenter && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0A06]/80 backdrop-blur-sm">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-[var(--copper)]/20 animate-pulse-ring" />
                <span className="w-5 h-5 rounded-full bg-[var(--copper)] border-2 border-[var(--cream)] relative z-10" />
              </div>
              <p className="text-[var(--cream-muted)] text-xs font-medium tracking-widest uppercase mt-3">
                {error || 'Finding nearby matches'}
              </p>
            </div>
          )}

          <div className="absolute top-3 left-3 z-30 pointer-events-auto">
            <ProximitySlider value={radius} onChange={handleRadiusChange} variant="map" />
          </div>
        </div>

        <div
          data-testid="nearby-counts"
          className="absolute top-[112px] left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)]/85 backdrop-blur-sm border border-[var(--border-default)] shadow-md"
        >
          <p className="text-[11px] font-bold text-[var(--cream-soft)] tracking-wide whitespace-nowrap">
            {loading && nearbyCount === 0 ? (
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

        {locationNotice && (
          <div
            role="status"
            data-testid="location-notice"
            className="absolute left-3 right-3 top-[152px] z-20 max-w-[340px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/90 px-3 py-2 text-[11px] font-medium leading-snug text-[var(--cream-soft)] shadow-md backdrop-blur-sm sm:max-w-sm"
          >
            <p>{locationNotice}</p>
            <button
              type="button"
              onClick={handleEnableLocation}
              data-testid="enable-location"
              className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-[var(--copper)]/50 bg-[var(--copper)]/15 px-2.5 py-1 text-[11px] font-bold text-[var(--copper)] transition-colors hover:bg-[var(--copper)]/25"
            >
              {locationNotice === 'Using your last saved location.' ||
              locationNotice === INSECURE_GPS_NOTICE
                ? 'Refresh location'
                : 'Enable location'}
            </button>
          </div>
        )}

        <div className="absolute z-30 right-[var(--fab-offset)] top-3 flex items-center gap-2">
          <div
            className="flex items-center rounded-full overflow-hidden border bg-[var(--bg-elevated)]/85 backdrop-blur-sm"
            style={{ borderColor: 'var(--border-default)' }}
            role="group"
            aria-label="Discovery surface"
          >
            <span
              className="px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em]"
              style={{ background: 'var(--copper)', color: 'var(--bg-primary)' }}
              aria-current="page"
            >
              {ROUTE_LABELS.map}
            </span>
            <Link
              to="/stream"
              className="px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] transition-colors hover:text-[var(--copper)]"
              style={{ color: 'var(--cream-soft)' }}
              aria-label={`Switch to ${ROUTE_LABELS.liveProfileList}`}
            >
              {ROUTE_LABELS.liveProfileList}
            </Link>
          </div>
        </div>

        {pulseError && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-3 py-2 rounded-md bg-[#3D1A1A] border border-[#8B4513] text-[var(--cream)] text-xs">
            {pulseError}
          </div>
        )}

        <PulseFab
          isPulsing={!!pulseUntil}
          pulseExpiresAt={pulseUntil ? pulseUntil.toISOString() : undefined}
          nextPulseAllowedAt={nextPulseAllowedAt ?? undefined}
          isPremium={pulseIsPremium}
          onStartPulse={handleStartPulse}
          onStopPulse={handleStopPulse}
        />

        {/* Filter rail — Intent + multi-select Tribes */}
        <div
          className="absolute top-12 left-0 right-0 z-20 pointer-events-auto px-1 pt-1 pb-1"
          style={{
            background:
              'linear-gradient(to bottom, rgba(13,10,6,0.85), rgba(13,10,6,0.4) 80%, transparent)',
          }}
        >
          <TribePillRow
            selected={tagFilters}
            onToggle={toggleTag}
            onClear={tagFilters.length > 0 ? clearTags : undefined}
          />
        </div>

        <div
          className="absolute left-0 right-0 z-20 pointer-events-none max-lg:bottom-0 lg:bottom-auto lg:right-0 lg:top-0 lg:w-[360px] lg:pointer-events-auto lg:border-l lg:border-[var(--border-default)] lg:bg-[#0A0806]/95 lg:backdrop-blur-sm"
        >
          <div
            className="h-12 pointer-events-none max-lg:block lg:hidden"
            style={{ background: 'linear-gradient(to top, #0D0A06, transparent)' }}
          />
          <div className="pointer-events-auto space-y-2 pb-2 max-lg:pb-2 lg:flex lg:h-full lg:flex-col lg:overflow-hidden lg:pb-0">
            <div className="hidden shrink-0 border-b border-[var(--border-default)] px-5 py-4 lg:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--cream-muted)]">
                Nearby now
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--cream)]">
                {loading && nearbyCount === 0 ? 'Scanning…' : `${nearbyCount} in range`}
              </p>
            </div>
            <div className="hidden min-h-0 flex-1 overflow-y-auto lg:block">
              <DesktopNearbyList
                users={sortedUsers}
                loading={loading}
                onSelect={setSelectedUser}
              />
            </div>
            <div className="lg:hidden">
              <EventsRail lat={lat} lng={lng} onSelect={(ev: EventDTO) => navigate(`/rooms/${ev.id}`)} />
              <UserStrip
                users={sortedUsers}
                loading={loading}
                onSelect={setSelectedUser}
              />
            </div>
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

const DesktopNearbyList: React.FC<UserStripProps> = ({ users, loading, onSelect }) => {
  if (loading && users.length === 0) {
    return (
      <div className="space-y-2 px-3 py-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-sm font-bold text-[var(--cream)]">No one nearby</p>
        <p className="mt-1 text-xs text-[var(--cream-muted)]">Pulse on the map to refresh discovery.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2 py-2">
      {users.map((user) => {
        const distLabel = getDistanceLabel(user);
        const isPulsing = isUserPulsing(user);
        return (
          <button
            key={user.id}
            type="button"
            onClick={() => onSelect(user)}
            className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-card)]/80"
          >
            <UserAvatar name={user.name} photoUrl={user.photo_url} online={user.online} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-[var(--cream)]">{user.name}</p>
                {isPulsing ? (
                  <span className="rounded-full bg-[var(--copper)]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--copper)]">
                    Live
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-[var(--cream-muted)]">
                {user.headline || user.mood || `${user.age} · nearby`}
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold text-[var(--copper)]">
              {user.distance_label ?? distLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
};

interface UserStripCardProps {
  user: NearbyUser;
  onSelect: () => void;
}

const UserStripCard: React.FC<UserStripCardProps> = ({ user, onSelect }) => {
  const distance = parseFloat(String(user.distance_km));
  const distLabel = getDistanceLabel(user);
  const fullPhotoUrl = getPhotoUrl(user.photo_url);
  const isPulsing = isUserPulsing(user);

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
          <PulsingAvatar isPulsing={isPulsing} size={24} intensity={isPulsing ? "live" : "subtle"}>
            <div
              className="w-full h-full rounded-full"
              style={{ background: isPulsing ? 'var(--copper)' : 'transparent' }}
            />
          </PulsingAvatar>
        </div>
        {user.online && !isPulsing && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-nn-online border border-nn-elevated" />
        )}
      </div>
      <div className="flex-1 px-2 py-1.5 flex flex-col justify-between">
        <div>
          <p className="text-[13px] font-black text-[var(--cream)] truncate">{user.name}</p>
          {user.mood ? (
            <div className="mt-0.5">
              <MoodBadge mood={user.mood} small />
            </div>
          ) : user.headline ? (
            <p className="text-[11px] text-[var(--cream-soft)] truncate">{user.headline}</p>
          ) : null}
        </div>
        <p className="text-[11px] font-bold text-[var(--copper)]">{user.distance_label ?? distLabel}</p>
      </div>
    </button>
  );
};
