import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Root } from 'react-dom/client';
import { Link, useNavigate } from 'react-router-dom';
import { EventDTO, Mood, profileMetaAPI, pulseAPI, usersAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { NearbyUser } from '../components/ProfileCard';
import { Layout } from '../components/Layout';
import { PulseFab } from '../components/PulseFab';
import { MoodPicker } from '../components/MoodPicker';
import {
  MAX_RADIUS_KM,
  RADIUS_MILE_OPTIONS,
  clampRadiusKm,
  kmToRadiusSelection,
  radiusSelectionToKm,
} from '../lib/discoveryFormat';
import { ProfileDrawer } from '../components/ProfileDrawer';
import { createMapMarkerElement, MapMarker } from '../components/MapMarker';

import { ActivationBanner } from '../components/ActivationBanner';
import { DiscoveryFilterPills } from '../components/DiscoveryFilterPills';
import { DiscoveryFilterPanel } from '../components/DiscoveryFilterPanel';
import { NearbyProfileGrid } from '../components/NearbyProfileGrid';
import { DiscoveryShellPublisher } from '../context/DiscoveryShellContext';
import { formatRadiusMiles } from '../lib/discoveryFormat';
import type { ProfileSetupSnapshot } from '../lib/profileSetup';
import {
  DEFAULT_DISCOVERY_FILTERS,
  applyDiscoveryClientFilters,
  buildNearbyApiFilters,
  type DiscoveryFilterState,
} from '../lib/discoveryFilters';
import { EventsRail } from '../components/EventsRail';
import { isUserPulsing, distanceMeters } from '../lib/discovery';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  discoveryResultBucket,
  trackEventOnce,
} from '../observability/analytics';
import {
  geoJsonCircle,
  RADIUS_CIRCLE_LAYER,
  RADIUS_CIRCLE_SOURCE,
} from '../lib/mapRadiusCircle';
import { ROUTE_LABELS } from '../lib/routeLabels';
import { useIsDesktopLayout } from '../hooks/useMediaQuery';


const INJECT_ID = '__discover_styles__';
if (typeof document !== 'undefined' && !document.getElementById(INJECT_ID)) {
  const s = document.createElement('style');
  s.id = INJECT_ID;
  s.textContent = `
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
  'Live location on your phone needs a secure (HTTPS) link. Open the team tunnel URL — not the plain IP address — then allow location in your browser.';

const BROWSER_GPS_DENIED_NOTICE =
  'Allow location in your browser settings to use live discovery — you already agreed to this when you joined.';

/** Min interval between nearby roster API calls during live GPS. */
const NEARBY_FETCH_MIN_MS = 20_000;
/** Min movement before panning the map (avoids constant easeTo flicker). */
const MAP_PAN_MIN_METERS = 50;
/** Min movement before re-querying nearby users on GPS drift. */
const NEARBY_REFETCH_MIN_METERS = 80;

export const Discover = () => {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [likedUsers, setLikedUsers] = useState<Set<string>>(new Set());
  /** Mutual only — messaging requires match both ways. */
  const [matchedUsers, setMatchedUsers] = useState<Set<string>>(new Set());
  const [likesHydrated, setLikesHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [radius, setRadius] = useState<number>(5);
  const [discoveryFilters, setDiscoveryFilters] = useState<DiscoveryFilterState>(DEFAULT_DISCOVERY_FILTERS);
  const [pulseUntil, setPulseUntil] = useState<Date | null>(null);
  const [nextPulseAllowedAt, setNextPulseAllowedAt] = useState<string | null>(null);
  const [pulseIsPremium, setPulseIsPremium] = useState(false);
  const [pulseError, setPulseError] = useState('');
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  /** True when GPS denied and no saved pin — never invent a city (was London). */
  const [needsLocationGate, setNeedsLocationGate] = useState(false);
  const [activationProfile, setActivationProfile] = useState<ProfileSetupSnapshot | null>(null);
  const [safetyNotice, setSafetyNotice] = useState<{ msg: string; tone: 'success' | 'error' } | null>(null);
  const [matchToast, setMatchToast] = useState<{ name: string; id: string } | null>(null);
  const [matchingUserId, setMatchingUserId] = useState<string | null>(null);
  /** Men found at max radius when current radius is empty — expand teaser. */
  const [beyondRadiusCount, setBeyondRadiusCount] = useState(0);
  const [matchCoachDismissed, setMatchCoachDismissed] = useState(() => {
    try {
      return localStorage.getItem('menrush_match_coach_dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [pulseNudgeDismissed, setPulseNudgeDismissed] = useState(() => {
    try {
      return localStorage.getItem('menrush_pulse_nudge_dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [mood, setMood] = useState<Mood | null>(null);
  const [moodSaving, setMoodSaving] = useState(false);

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
  const isDesktopLayout = useIsDesktopLayout();

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  const tokenMissing = !mapboxToken || mapboxToken === '__SET_ME__';

  useEffect(() => {
    usersAPI
      .getMe()
      .then((res) => {
        setActivationProfile(res.data as ProfileSetupSnapshot);
        if (res.data?.mood) setMood(res.data.mood as Mood);
      })
      .catch(() => {});
    profileMetaAPI
      .getMood()
      .then((res) => setMood(res.data.mood ?? null))
      .catch(() => {});
    // Hydrate Match CTA after reload — outbound likes + mutual matches (separate).
    Promise.all([
      usersAPI.getSentLikes().catch(() => ({ data: { ids: [] as string[] } })),
      usersAPI.getMatches().catch(() => ({ data: [] as Array<{ id: string }> })),
    ])
      .then(([sentRes, matchesRes]) => {
        const sent = sentRes.data?.ids ?? [];
        const mutual = (matchesRes.data ?? []).map((m: { id: string }) => m.id).filter(Boolean);
        setMatchedUsers((prev) => new Set([...prev, ...mutual]));
        const likedIds = [...sent, ...mutual];
        if (likedIds.length > 0) {
          setLikedUsers((prev) => new Set([...prev, ...likedIds]));
        }
      })
      .finally(() => setLikesHydrated(true));
  }, []);

  const handleMoodSelect = useCallback(async (next: Mood | null) => {
    setMoodSaving(true);
    try {
      const res = await profileMetaAPI.setMood(next);
      setMood(res.data.mood ?? null);
    } catch {
      /* keep previous mood */
    } finally {
      setMoodSaving(false);
    }
  }, []);

  const fetchNearbyUsers = useCallback(
    async (
      latitude: number,
      longitude: number,
      r: number,
      filters: DiscoveryFilterState,
      options?: { background?: boolean },
    ) => {
      if (!options?.background) setLoading(true);
      try {
        await usersAPI.updateLocation(latitude, longitude).catch(() => {});
        const apiFilters = buildNearbyApiFilters(filters);
        const res = await usersAPI.getNearby(latitude, longitude, r, apiFilters);
        setUsers(res.data);
        // Cold density: count men outside current radius so Expand is intentional.
        if (res.data.length === 0 && r < MAX_RADIUS_KM - 0.5) {
          try {
            const wider = await usersAPI.getNearby(latitude, longitude, MAX_RADIUS_KM, apiFilters);
            setBeyondRadiusCount(wider.data?.length ?? 0);
          } catch {
            setBeyondRadiusCount(0);
          }
        } else {
          setBeyondRadiusCount(0);
        }
        trackEventOnce(
          'first_discovery_load',
          { outcome: 'succeeded', result_bucket: discoveryResultBucket(res.data.length) },
          'first_discovery_load',
        );
        setError('');
      } catch {
        setBeyondRadiusCount(0);
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
        fetchNearbyUsers(latitude, longitude, radius, discoveryFilters);
      }
    },
    [fetchNearbyUsers, radius, setLocation, discoveryFilters],
  );

  const applyLiveGps = useCallback(
    (latitude: number, longitude: number, options?: { force?: boolean }) => {
      const recoveringFromFallback = usingFallbackLocationRef.current;
      if (recoveringFromFallback) {
        usingFallbackLocationRef.current = false;
      }
      hasLiveGpsRef.current = true;
      setNeedsLocationGate(false);

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
      fetchNearbyUsers(latitude, longitude, radius, discoveryFilters, { background: isBackground });
    },
    [fetchNearbyUsers, mapCenter, radius, setLocation, discoveryFilters],
  );

  // Customer-facing "enable location" action for the fallback notice.
  const handleEnableLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationNotice('This browser cannot share location. Try Chrome or Safari on your phone.');
      return;
    }
    if (!window.isSecureContext) {
      setLocationNotice(INSECURE_GPS_NOTICE);
      setNeedsLocationGate(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setNeedsLocationGate(false);
        useDiscoveryLocation(coords.latitude, coords.longitude, '', true);
      },
      () => {
        setNeedsLocationGate(true);
        setLocationNotice(BROWSER_GPS_DENIED_NOTICE);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, [useDiscoveryLocation]);

  const applyLocationFallback = useCallback(() => {
    if (hasFetchedRef.current || hasLiveGpsRef.current) return;

    usingFallbackLocationRef.current = true;

    const saved = savedProfileLocationRef.current;
    if (saved) {
      setNeedsLocationGate(false);
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

    // Location-first product: do not invent a city centre pin. Gate until GPS or saved pin.
    setNeedsLocationGate(true);
    setLoading(false);
    setLocationNotice(
      window.isSecureContext ? BROWSER_GPS_DENIED_NOTICE : INSECURE_GPS_NOTICE,
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
        const denied = positionError.code === positionError.PERMISSION_DENIED;
        trackEventOnce(
          'location_permission_outcome',
          {
            outcome: denied ? 'denied' : 'unavailable',
          },
          'location_permission_outcome',
        );
        if (denied && window.isSecureContext) {
          setLocationNotice(BROWSER_GPS_DENIED_NOTICE);
        }
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
      fetchNearbyUsers(lat, lng, radius, discoveryFilters, { background: true });
    }, NEARBY_FETCH_MIN_MS);
    return () => window.clearInterval(id);
  }, [lat, lng, radius, discoveryFilters, fetchNearbyUsers]);

  const handleRadiusChange = useCallback(
    (next: number) => {
      const clamped = clampRadiusKm(next);
      setRadius(clamped);
      if (lat != null && lng != null) fetchNearbyUsers(lat, lng, clamped, discoveryFilters);
    },
    [lat, lng, discoveryFilters, fetchNearbyUsers],
  );

  const handleRadiusCycle = () => {
    if (radius >= MAX_RADIUS_KM - 0.5) return;
    const current = kmToRadiusSelection(radius);
    if (current === 'all') return;
    const idx = RADIUS_MILE_OPTIONS.indexOf(current);
    const next =
      idx >= 0 && idx < RADIUS_MILE_OPTIONS.length - 1
        ? RADIUS_MILE_OPTIONS[idx + 1]
        : 'all';
    handleRadiusChange(radiusSelectionToKm(next));
  };

  const handleDiscoveryFiltersChange = useCallback(
    (next: DiscoveryFilterState) => {
      setDiscoveryFilters(next);
      if (lat != null && lng != null) fetchNearbyUsers(lat, lng, radius, next);
    },
    [lat, lng, radius, fetchNearbyUsers],
  );

  const handleStartPulse = useCallback(
    async (durationMin: 60 | 90 | 120) => {
      try {
        const res = await pulseAPI.start(durationMin);
        setPulseUntil(new Date(res.data.expires_at));
        setNextPulseAllowedAt(null);
        setPulseError('');
        if (lat != null && lng != null) fetchNearbyUsers(lat, lng, radius, discoveryFilters);
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
    [lat, lng, radius, discoveryFilters, fetchNearbyUsers],
  );

  const handleStopPulse = useCallback(async () => {
    try {
      await pulseAPI.stop();
      setPulseUntil(null);
      const state = await pulseAPI.getMe().catch(() => null);
      setNextPulseAllowedAt(state?.data?.next_pulse_allowed_at ?? null);
      if (lat != null && lng != null) fetchNearbyUsers(lat, lng, radius, discoveryFilters);
    } catch {
      // swallow
    }
  }, [lat, lng, radius, discoveryFilters, fetchNearbyUsers]);

  const handleLike = useCallback(
    async (user: NearbyUser) => {
      // Chat only when mutual — messaging API requires both-way match.
      if (matchedUsers.has(user.id)) {
        navigate(`/messages/${user.id}`);
        return;
      }
      if (likedUsers.has(user.id)) {
        setSafetyNotice({
          msg: `Match already sent to ${user.name}. Chat unlocks when he matches back · consent first.`,
          tone: 'success',
        });
        window.setTimeout(() => setSafetyNotice(null), 4000);
        return;
      }
      setMatchingUserId(user.id);
      try {
        const res = await usersAPI.likeUser(user.id);
        setLikedUsers((p) => new Set([...p, user.id]));
        if (res.data?.match) {
          setMatchedUsers((p) => new Set([...p, user.id]));
          setMatchToast({ name: user.name, id: user.id });
          window.setTimeout(() => setMatchToast(null), 6000);
        } else {
          setSafetyNotice({
            msg: `Match sent to ${user.name}. Chat unlocks if he matches back · consent first.`,
            tone: 'success',
          });
          window.setTimeout(() => setSafetyNotice(null), 4000);
        }
      } catch (err: unknown) {
        const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error;
        setSafetyNotice({
          msg:
            typeof apiError === 'string' && apiError.length > 0
              ? apiError
              : 'Could not send match. Try again in a moment.',
          tone: 'error',
        });
        window.setTimeout(() => setSafetyNotice(null), 4000);
      } finally {
        setMatchingUserId(null);
      }
    },
    [likedUsers, matchedUsers, navigate],
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
      if (map.getLayer(RADIUS_CIRCLE_LAYER)) map.removeLayer(RADIUS_CIRCLE_LAYER);
      if (map.getSource(RADIUS_CIRCLE_SOURCE)) map.removeSource(RADIUS_CIRCLE_SOURCE);
      map.remove();
      mapRef.current = null;
      selfMarkerRef.current = null;
      selfDotRef.current = null;
      setMapLoaded(false);
    };
    // mapCenter excluded — GPS updates recenter via applyLiveGps/easeTo, not map teardown.
  }, [mapboxToken, tokenMissing, isDesktopLayout]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || lat == null || lng == null) return;

    const data = geoJsonCircle(lng, lat, radius);
    const existing = map.getSource(RADIUS_CIRCLE_SOURCE) as mapboxgl.GeoJSONSource | undefined;

    if (existing) {
      existing.setData(data);
      return;
    }

    map.addSource(RADIUS_CIRCLE_SOURCE, { type: 'geojson', data });
    map.addLayer({
      id: RADIUS_CIRCLE_LAYER,
      type: 'line',
      source: RADIUS_CIRCLE_SOURCE,
      paint: {
        'line-color': '#C4832A',
        'line-width': 2,
        'line-dasharray': [2, 2],
        'line-opacity': 0.75,
      },
    });
  }, [mapLoaded, lat, lng, radius]);

  const onlineCount = users.filter((u) => u.online).length;
  const nearbyCount = users.length;
  const sortedUsers = [...users].sort((a, b) => {
    const ap = isUserPulsing(a) ? 1 : 0;
    const bp = isUserPulsing(b) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return parseFloat(String(a.distance_km)) - parseFloat(String(b.distance_km));
  });

  const displayUsers = applyDiscoveryClientFilters(sortedUsers, discoveryFilters);

  const togglePulseHeader = useCallback(async () => {
    if (pulseUntil) await handleStopPulse();
    else await handleStartPulse(90);
  }, [pulseUntil, handleStartPulse, handleStopPulse]);

  return (
    <Layout>
      <DiscoveryShellPublisher
        nearbyCount={nearbyCount}
        radiusLabel={formatRadiusMiles(radius)}
        pulseOn={!!pulseUntil}
        togglePulse={() => void togglePulseHeader()}
      />
      <h1 className="sr-only">Nearby discovery map</h1>

      {activationProfile ? (
        <ActivationBanner profile={activationProfile} onEnableLocation={handleEnableLocation} />
      ) : null}

      {/* First Match coach — likes cold since July; no swipe, one tap. */}
      {!needsLocationGate &&
      likesHydrated &&
      !loading &&
      !matchCoachDismissed &&
      likedUsers.size === 0 &&
      displayUsers.length > 0 ? (
        <div
          className="mx-3 mb-3 rounded-2xl border border-[rgba(196,131,42,0.5)] bg-[rgba(196,131,42,0.12)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          role="status"
          data-testid="match-coach"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-extrabold text-[#F0E0C0]">
                Men nearby — tap Match on a card
              </p>
              <p className="mt-1 text-[12px] text-[#A89070]">
                No swiping. One tap sends interest. Chat unlocks when it&apos;s mutual · consent
                first · 18+ only.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMatchCoachDismissed(true);
                try {
                  localStorage.setItem('menrush_match_coach_dismissed', '1');
                } catch {
                  /* ignore */
                }
              }}
              className="shrink-0 rounded-full border border-[rgba(196,131,42,0.45)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#A89070] hover:text-[#F0E0C0]"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      {safetyNotice ? (
        <div
          role="status"
          className="mx-3 mb-2 rounded-xl border px-3 py-2 text-[12px] font-medium"
          style={{
            borderColor:
              safetyNotice.tone === 'success' ? 'rgba(143,199,115,0.4)' : 'rgba(196,131,42,0.45)',
            background:
              safetyNotice.tone === 'success' ? 'rgba(143,199,115,0.12)' : 'rgba(196,131,42,0.1)',
            color: safetyNotice.tone === 'success' ? '#8FC773' : '#F0E0C0',
          }}
        >
          {safetyNotice.msg}
        </div>
      ) : null}

      {matchToast ? (
        <div
          role="status"
          data-testid="match-toast"
          className="mx-3 mb-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[rgba(196,131,42,0.55)] bg-[rgba(196,131,42,0.18)] px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.4)]"
        >
          <div>
            <p className="text-[14px] font-extrabold text-[#F0E0C0]">Match with {matchToast.name}</p>
            <p className="mt-0.5 text-[12px] text-[#A89070]">
              You both said yes. Chat when ready — consent first. Pulse to get seen by more men nearby.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const id = matchToast.id;
                setMatchToast(null);
                navigate(`/messages/${id}`);
              }}
              className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
            >
              Open chat
            </button>
            {!pulseUntil ? (
              <button
                type="button"
                data-testid="match-toast-pulse"
                onClick={() => {
                  setMatchToast(null);
                  void handleStartPulse(90).catch(() => {});
                }}
                className="rounded-full border border-[rgba(196,131,42,0.55)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#C4832A] transition-colors hover:bg-[rgba(196,131,42,0.12)]"
              >
                Start Pulse
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!needsLocationGate &&
      !loading &&
      nearbyCount === 0 &&
      !pulseUntil &&
      !pulseNudgeDismissed &&
      lat != null &&
      lng != null ? (
        <div
          className="mx-3 mb-3 rounded-2xl border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.1)] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          role="status"
          data-testid="pulse-nudge"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-extrabold text-[#F0E0C0]">Quiet map? Start Pulse</p>
              <p className="mt-1 text-[12px] text-[#A89070]">
                90 minutes of priority visibility so men nearby see you first. Be intentional · 18+ only.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleStartPulse(90).catch(() => {})}
                className="rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
              >
                Start Pulse
              </button>
              <button
                type="button"
                onClick={() => {
                  setPulseNudgeDismissed(true);
                  try {
                    localStorage.setItem('menrush_pulse_nudge_dismissed', '1');
                  } catch {
                    /* ignore */
                  }
                }}
                className="rounded-full border border-[rgba(196,131,42,0.45)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#A89070] transition-colors hover:text-[#F0E0C0]"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {needsLocationGate ? (
        <div
          className="mx-3 mb-3 rounded-2xl border border-[rgba(196,131,42,0.5)] bg-[rgba(196,131,42,0.12)] px-5 py-6 text-center shadow-[0_12px_32px_rgba(0,0,0,0.4)]"
          role="dialog"
          aria-labelledby="location-gate-title"
          data-testid="location-gate"
        >
          <p id="location-gate-title" className="text-[17px] font-extrabold text-[#F0E0C0]">
            Location unlocks Nearby
          </p>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[#A89070]">
            MenRush is live proximity — we never place you on a random city map. Allow location (18+
            only · shared only while you use the app) to see men around you right now.
          </p>
          <button
            type="button"
            onClick={handleEnableLocation}
            className="mt-4 rounded-full bg-[#C4832A] px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
          >
            Enable location
          </button>
          {locationNotice ? (
            <p className="mt-3 text-[11px] text-[#A89070]">{locationNotice}</p>
          ) : null}
        </div>
      ) : null}

      <div className="hidden lg:block lg:h-full lg:overflow-y-auto px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-2xl font-extrabold text-[var(--cream)]">Nearby</h2>
          <DiscoveryFilterPills radiusKm={radius} onRadiusChange={handleRadiusChange} />
        </div>
        {!needsLocationGate ? (
          <div
            className="mb-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/80 px-4 py-3"
            data-testid="discover-mood-strip"
          >
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[#A89070]">
              Your mood · shown nearby · 18+
            </p>
            <div className={moodSaving ? 'pointer-events-none opacity-60' : ''}>
              <MoodPicker current={mood} onSelect={handleMoodSelect} />
            </div>
          </div>
        ) : null}
        <DiscoveryFilterPanel
          variant="inline"
          value={discoveryFilters}
          onChange={handleDiscoveryFiltersChange}
          className="mb-4"
        />
        <div className="relative mb-5 h-[45vh] min-h-[280px] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[#11100E] shadow-[var(--shadow-md)]">
          <div ref={isDesktopLayout ? mapContainerRef : undefined} className="absolute inset-0" />
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[rgba(30,21,8,0.85)] px-4 py-2 text-[13px] text-[var(--cream-muted)] backdrop-blur-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--status-online)]" />
            {nearbyCount} in your radius · {formatRadiusMiles(radius)}
          </div>
        </div>
        {!needsLocationGate ? (
          <NearbyProfileGrid
            users={displayUsers}
            loading={loading}
            onSelect={setSelectedUser}
            onMatch={handleLike}
            likedUserIds={likedUsers}
            mutualUserIds={matchedUsers}
            matchingUserId={matchingUserId}
            onExpandRadius={handleRadiusCycle}
            onFinishProfile={() => navigate('/profile/setup')}
            onStartPulse={() => void handleStartPulse(90)}
            pulseOn={!!pulseUntil}
            onOpenHotSpots={() => navigate('/hot-spots')}
            radiusLabel={formatRadiusMiles(radius)}
            beyondRadiusCount={beyondRadiusCount}
          />
        ) : null}
      </div>

      <div className="relative lg:hidden">
        <div className="space-y-4 overflow-y-auto px-4 py-4 pb-24">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flex-1 text-xl font-extrabold text-[var(--cream)]">Nearby</h2>
            <DiscoveryFilterPills radiusKm={radius} onRadiusChange={handleRadiusChange} />
          </div>

          {!needsLocationGate ? (
            <div
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/80 px-3 py-2.5"
              data-testid="discover-mood-strip-mobile"
            >
              <p className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-[#A89070]">
                Your mood · 18+
              </p>
              <div className={moodSaving ? 'pointer-events-none opacity-60' : ''}>
                <MoodPicker current={mood} onSelect={handleMoodSelect} />
              </div>
            </div>
          ) : null}

          <DiscoveryFilterPanel
            variant="inline"
            value={discoveryFilters}
            onChange={handleDiscoveryFiltersChange}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              data-testid="nearby-counts"
              className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)]/85 px-3 py-1.5 shadow-md backdrop-blur-sm"
            >
              <p className="text-[11px] font-bold tracking-wide text-[var(--cream-soft)] whitespace-nowrap">
                {loading && nearbyCount === 0 ? (
                  <span className="text-[var(--cream-muted)]">Scanning…</span>
                ) : nearbyCount === 0 ? (
                  <button type="button" onClick={handleRadiusCycle} className="text-[var(--copper)]">
                    EXPAND YOUR RADIUS →
                  </button>
                ) : (
                  <>
                    <span className="font-black text-[var(--copper)]">{nearbyCount}</span> NEARBY
                    <span className="mx-1.5 text-[var(--cream-muted)]">·</span>
                    <span className="font-black text-[var(--copper)]">{onlineCount}</span> ONLINE NOW
                  </>
                )}
              </p>
            </div>

            <div
              className="flex items-center overflow-hidden rounded-full border bg-[var(--bg-elevated)]/85 backdrop-blur-sm"
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

          {locationNotice ? (
            <div
              role="status"
              data-testid="location-notice"
              className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/90 px-3 py-2 text-[11px] font-medium leading-snug text-[var(--cream-soft)] shadow-md backdrop-blur-sm"
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
                  : 'Allow in browser'}
              </button>
            </div>
          ) : null}

          {pulseError ? (
            <div className="rounded-md border border-[#A45E18] bg-[#3D1A1A] px-3 py-2 text-xs text-[var(--cream)]">
              {pulseError}
            </div>
          ) : null}

          <div className="relative h-[36vh] min-h-[220px] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[#11100E] shadow-[var(--shadow-md)]">
            <div ref={isDesktopLayout ? undefined : mapContainerRef} className="absolute inset-0" />

            {tokenMissing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0A06] px-6 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--copper)]/40 bg-[var(--copper)]/15">
                  <span className="text-2xl text-[var(--copper)]">·</span>
                </div>
                <p className="text-sm font-bold text-[var(--cream)]">Map is taking a break</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--cream-muted)]">
                  We can’t load the map right now. You can still browse who’s nearby below.
                </p>
              </div>
            ) : null}

            {!tokenMissing && !mapCenter ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0A06]/80 backdrop-blur-sm">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[var(--copper)]/20" />
                  <span className="relative z-10 h-5 w-5 rounded-full border-2 border-[var(--cream)] bg-[var(--copper)]" />
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-widest text-[var(--cream-muted)]">
                  {error || 'Finding nearby matches'}
                </p>
              </div>
            ) : null}

            <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[rgba(30,21,8,0.85)] px-3 py-1.5 text-[12px] text-[var(--cream-muted)] backdrop-blur-sm">
              <span className="inline-flex h-2 w-2 rounded-full bg-[var(--status-online)]" />
              {nearbyCount} in your radius · {formatRadiusMiles(radius)}
            </div>
          </div>

          {!needsLocationGate ? (
            <>
              <EventsRail lat={lat} lng={lng} onSelect={(ev: EventDTO) => navigate(`/rooms/${ev.id}`)} />
              <NearbyProfileGrid
                users={displayUsers}
                loading={loading}
                onSelect={setSelectedUser}
                onMatch={handleLike}
                likedUserIds={likedUsers}
                mutualUserIds={matchedUsers}
                matchingUserId={matchingUserId}
                onExpandRadius={handleRadiusCycle}
                onFinishProfile={() => navigate('/profile/setup')}
                onStartPulse={() => void handleStartPulse(90)}
                pulseOn={!!pulseUntil}
                onOpenHotSpots={() => navigate('/hot-spots')}
                radiusLabel={formatRadiusMiles(radius)}
                beyondRadiusCount={beyondRadiusCount}
              />
            </>
          ) : null}
        </div>

        <PulseFab
          isPulsing={!!pulseUntil}
          pulseExpiresAt={pulseUntil ? pulseUntil.toISOString() : undefined}
          nextPulseAllowedAt={nextPulseAllowedAt ?? undefined}
          isPremium={pulseIsPremium}
          onStartPulse={handleStartPulse}
          onStopPulse={handleStopPulse}
        />
      </div>

      <ProfileDrawer
        user={selectedUser}
        liked={selectedUser ? likedUsers.has(selectedUser.id) : false}
        mutual={selectedUser ? matchedUsers.has(selectedUser.id) : false}
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
        onSafetyNotice={(msg, tone) => {
          setSafetyNotice({ msg, tone: tone ?? 'success' });
          window.setTimeout(() => setSafetyNotice(null), 4000);
        }}
        onBlocked={() => {
          if (!selectedUser) return;
          setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
          setSelectedUser(null);
        }}
      />
    </Layout>
  );
};
