import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, useNavigate } from 'react-router-dom';
import { EventDTO, HotSpotDTO, Mood, hotSpotsAPI, profileMetaAPI, pulseAPI, usersAPI } from '../api/client';
import { useLocationStore, useAuthStore } from '../hooks/store';
import { NearbyUser } from '../components/ProfileCard';
import { Layout } from '../components/Layout';
import { PulseFab } from '../components/PulseFab';
import { MoodPicker } from '../components/MoodPicker';
import {
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_KM,
  clampRadiusKm,
} from '../lib/discoveryFormat';
import { ProfileDrawer } from '../components/ProfileDrawer';
import { createMapMarkerElement, MapMarker } from '../components/MapMarker';
import { createHotSpotPinElement, HotSpotPin } from '../components/HotSpotPin';

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
import { ProximitySlider } from '../components/ProximitySlider';

/** Map panel: swipe up to hide, swipe down to show, expand for large map. */
type MapPanelMode = 'hidden' | 'default' | 'expanded';
const MAP_PANEL_STORAGE_KEY = 'menrush_nearby_map_panel';
const DISCOVER_RADIUS_KEY = 'menrush_default_radius_km';

function readMapPanelMode(): MapPanelMode {
  try {
    const raw = localStorage.getItem(MAP_PANEL_STORAGE_KEY);
    if (raw === 'hidden' || raw === 'default' || raw === 'expanded') return raw;
  } catch {
    /* ignore */
  }
  return 'default';
}

function mapPanelHeightCss(mode: MapPanelMode): string {
  if (mode === 'hidden') return '0px';
  if (mode === 'expanded') return 'min(72vh, 640px)';
  return 'min(38vh, 360px)';
}

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
    .discover-map-panel {
      transition: height 0.28s ease, min-height 0.28s ease, opacity 0.2s ease;
      will-change: height;
    }
    .discover-map-panel.is-hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);
}

const INSECURE_GPS_NOTICE =
  'Live location on your phone needs a secure (HTTPS) link. Open menrush.com (HTTPS), then allow location in your browser.';

const BROWSER_GPS_DENIED_NOTICE =
  'Location is blocked. Allow it in browser or phone settings, then tap Allow location. Your exact pin is not shown publicly — only approximate distance.';

/** Min interval between nearby roster API calls during live GPS. */
const NEARBY_FETCH_MIN_MS = 20_000;
/** Min movement before panning the map (avoids constant easeTo flicker). */
const MAP_PAN_MIN_METERS = 50;
/** Min movement before re-querying nearby users on GPS drift. */
const NEARBY_REFETCH_MIN_METERS = 80;

export const Discover = () => {
  const authUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [likedUsers, setLikedUsers] = useState<Set<string>>(new Set());
  /** Mutual only — messaging requires match both ways. */
  const [matchedUsers, setMatchedUsers] = useState<Set<string>>(new Set());
  const [likesHydrated, setLikesHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [radius, setRadius] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(DISCOVER_RADIUS_KEY));
      if (Number.isFinite(saved) && saved > 0) return clampRadiusKm(saved);
    } catch {
      /* ignore */
    }
    return DEFAULT_RADIUS_KM;
  });
  const [mapPanelMode, setMapPanelMode] = useState<MapPanelMode>(() => readMapPanelMode());
  const mapDragRef = useRef<{ startY: number; mode: MapPanelMode } | null>(null);
  const [discoveryFilters, setDiscoveryFilters] = useState<DiscoveryFilterState>(DEFAULT_DISCOVERY_FILTERS);
  const [pulseUntil, setPulseUntil] = useState<Date | null>(null);
  const [nextPulseAllowedAt, setNextPulseAllowedAt] = useState<string | null>(null);
  const [pulseIsPremium, setPulseIsPremium] = useState(false);
  const [pulseError, setPulseError] = useState('');
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);
  const { lat, lng, setLocation } = useLocationStore();
  /** Seed from last known pin so returning to Nearby never jumps to a fake city. */
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(() =>
    lat != null && lng != null ? [lat, lng] : null,
  );
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  /** True when no GPS and no saved pin — never invent a city centre. */
  const [needsLocationGate, setNeedsLocationGate] = useState(
    () => lat == null || lng == null,
  );
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
  const hotSpotMarkersRef = useRef<
    Map<string, { marker: mapboxgl.Marker; root: Root; spot: HotSpotDTO }>
  >(new Map());
  const selfMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const selfDotRef = useRef<HTMLDivElement | null>(null);
  const selfRootRef = useRef<Root | null>(null);
  const [hotSpots, setHotSpots] = useState<HotSpotDTO[]>([]);
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
        const d = res.data as { name?: string; photo_url?: string | null; age?: number };
        useAuthStore.getState().patchUser({
          name: d.name,
          photo_url: d.photo_url ?? undefined,
          age: d.age,
        });
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

  /** Drop every "allow location" surface the moment we have a usable pin. */
  const clearLocationPrompts = useCallback((latitude: number, longitude: number) => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    setNeedsLocationGate(false);
    setLocationNotice('');
    setActivationProfile((prev) =>
      prev ? { ...prev, lat: latitude, lng: longitude } : { lat: latitude, lng: longitude },
    );
  }, []);

  const useDiscoveryLocation = useCallback(
    (latitude: number, longitude: number, notice = '', forceRefresh = false) => {
      setLocation(latitude, longitude);
      setMapCenter([latitude, longitude]);
      if (notice) {
        setLocationNotice(notice);
      } else {
        clearLocationPrompts(latitude, longitude);
      }
      if (forceRefresh || !hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchNearbyUsers(latitude, longitude, radius, discoveryFilters);
      }
    },
    [clearLocationPrompts, fetchNearbyUsers, radius, setLocation, discoveryFilters],
  );

  const applyLiveGps = useCallback(
    (latitude: number, longitude: number, options?: { force?: boolean }) => {
      const recoveringFromFallback = usingFallbackLocationRef.current;
      if (recoveringFromFallback) {
        usingFallbackLocationRef.current = false;
      }
      hasLiveGpsRef.current = true;
      clearLocationPrompts(latitude, longitude);

      setLocation(latitude, longitude);

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
    [clearLocationPrompts, fetchNearbyUsers, mapCenter, radius, setLocation, discoveryFilters],
  );

  // Customer-facing "enable location" — high accuracy then low-accuracy fallback.
  const handleEnableLocation = useCallback(() => {
    void (async () => {
      setLocationNotice('');
      setLoading(true);
      const { requestDeviceLocation } = await import('../lib/deviceLocation');
      const result = await requestDeviceLocation();
      if (!result.ok) {
        setNeedsLocationGate(true);
        setLocationNotice(result.message);
        setLoading(false);
        return;
      }
      // Always go through live-GPS path so gate + banner clear immediately.
      applyLiveGps(result.lat, result.lng, { force: true });
      setLoading(false);
    })();
  }, [applyLiveGps]);

  const applyLocationFallback = useCallback(() => {
    if (hasFetchedRef.current || hasLiveGpsRef.current) return;

    usingFallbackLocationRef.current = true;

    const fromProfile = savedProfileLocationRef.current;
    const fromStore = useLocationStore.getState();
    const saved =
      fromProfile ??
      (fromStore.lat != null && fromStore.lng != null
        ? { lat: fromStore.lat, lng: fromStore.lng }
        : null);

    if (saved) {
      setNeedsLocationGate(false);
      useDiscoveryLocation(
        saved.lat,
        saved.lng,
        window.isSecureContext
          ? 'Using your last saved location — refreshing GPS…'
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

  // Seed Nearby from last known pin immediately (store / prior session) — never London.
  // Also clears the gate/banner the moment the shared location store gets a fix
  // (e.g. from useLiveLocationPublisher on another screen).
  useEffect(() => {
    if (lat == null || lng == null) return;
    clearLocationPrompts(lat, lng);
    if (hasLiveGpsRef.current) return;
    if (hasFetchedRef.current) return;
    savedProfileLocationRef.current = { lat, lng };
    useDiscoveryLocation(lat, lng, '', true);
  }, [lat, lng, clearLocationPrompts, useDiscoveryLocation]);

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
      applyLocationFallback();
      return;
    }

    let cancelled = false;

    // Prefer shared helper (cached → high → low) so mobile gets a fix faster.
    void (async () => {
      const { requestDeviceLocation } = await import('../lib/deviceLocation');
      if (cancelled) return;
      const result = await requestDeviceLocation();
      if (cancelled) return;
      if (result.ok) {
        trackEventOnce(
          'location_permission_outcome',
          { outcome: 'granted' },
          'location_permission_outcome',
        );
        applyLiveGps(result.lat, result.lng, { force: true });
        return;
      }
      if (result.error === 'denied' && window.isSecureContext) {
        setLocationNotice(BROWSER_GPS_DENIED_NOTICE);
      }
      if (!hasFetchedRef.current && !hasLiveGpsRef.current) {
        if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = window.setTimeout(() => {
          applyLocationFallback();
        }, window.isSecureContext ? 3500 : 2500);
      }
    })();

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        trackEventOnce(
          'location_permission_outcome',
          { outcome: 'granted' },
          'location_permission_outcome',
        );
        applyLiveGps(coords.latitude, coords.longitude);
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
        // Never leave a sticky error if we already have a live pin.
        if (hasLiveGpsRef.current || hasFetchedRef.current) {
          setLocationNotice('');
          setNeedsLocationGate(false);
          return;
        }
        if (denied && window.isSecureContext) {
          setLocationNotice(BROWSER_GPS_DENIED_NOTICE);
        }
        if (!hasFetchedRef.current && !hasLiveGpsRef.current) {
          if (fallbackTimerRef.current !== null) window.clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = window.setTimeout(() => {
            applyLocationFallback();
          }, window.isSecureContext ? 4000 : 2500);
        }
        setError('');
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 15_000 },
    );
    return () => {
      cancelled = true;
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
      try {
        localStorage.setItem(DISCOVER_RADIUS_KEY, String(clamped));
      } catch {
        /* ignore */
      }
      if (lat != null && lng != null) {
        void fetchNearbyUsers(lat, lng, clamped, discoveryFilters);
      }
    },
    [lat, lng, discoveryFilters, fetchNearbyUsers],
  );

  /**
   * Expand search radius — was stepping one tiny mile tier (felt broken).
   * If we already know men exist farther out, jump to max. Otherwise big steps.
   */
  const handleRadiusCycle = useCallback(() => {
    if (radius >= MAX_RADIUS_KM - 0.5) return;

    if (beyondRadiusCount > 0) {
      handleRadiusChange(MAX_RADIUS_KM);
      return;
    }

    // Big, noticeable jumps: ~5 → 25 → 50 → 100 mi (API max)
    const stepsKm = [5, 10, 25, 50, 80, MAX_RADIUS_KM];
    const next = stepsKm.find((km) => km > radius + 0.4) ?? MAX_RADIUS_KM;
    handleRadiusChange(next);
  }, [radius, beyondRadiusCount, handleRadiusChange]);

  const setMapPanel = useCallback((mode: MapPanelMode) => {
    setMapPanelMode(mode);
    try {
      localStorage.setItem(MAP_PANEL_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const onMapHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      mapDragRef.current = { startY: e.clientY, mode: mapPanelMode };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [mapPanelMode],
  );

  const onMapHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = mapDragRef.current;
      mapDragRef.current = null;
      if (!drag) return;
      const dy = e.clientY - drag.startY;
      // Swipe up (negative dy) → hide / shrink. Swipe down → show / expand.
      if (dy < -40) {
        if (drag.mode === 'expanded') setMapPanel('default');
        else setMapPanel('hidden');
      } else if (dy > 40) {
        if (drag.mode === 'hidden') setMapPanel('default');
        else if (drag.mode === 'default') setMapPanel('expanded');
      }
    },
    [setMapPanel],
  );

  // Mapbox needs resize when the collapsible panel changes height.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t1 = window.setTimeout(() => map.resize(), 50);
    const t2 = window.setTimeout(() => map.resize(), 320);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [mapPanelMode, isDesktopLayout]);

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
    // Never open Mapbox on a fake city. Wait for last-known or live GPS.
    if (mapCenter == null) return;

    const startCenter = mapCenter;
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
        positionOptions: { enableHighAccuracy: true, maximumAge: 15_000 },
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
    selfEl.style.width = '48px';
    selfEl.style.height = '48px';
    selfDotRef.current = selfEl;
    const selfRoot = createRoot(selfEl);
    selfRootRef.current = selfRoot;
    const selfUser = useAuthStore.getState().user;
    selfRoot.render(
      <MapMarker
        user={{
          id: selfUser?.id ?? 'self',
          name: selfUser?.name ?? 'You',
          photo_url: selfUser?.photo_url,
          age: selfUser?.age,
          isPulsing: false,
        }}
        size={48}
      />,
    );
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
      hotSpotMarkersRef.current.forEach(({ marker, root }) => {
        marker.remove();
        setTimeout(() => root.unmount(), 0);
      });
      hotSpotMarkersRef.current.clear();
      if (map.getLayer(RADIUS_CIRCLE_LAYER)) map.removeLayer(RADIUS_CIRCLE_LAYER);
      if (map.getSource(RADIUS_CIRCLE_SOURCE)) map.removeSource(RADIUS_CIRCLE_SOURCE);
      map.remove();
      mapRef.current = null;
      selfMarkerRef.current = null;
      selfDotRef.current = null;
      const root = selfRootRef.current;
      selfRootRef.current = null;
      if (root) setTimeout(() => root.unmount(), 0);
      setMapLoaded(false);
    };
    // Depend on "has center" not every GPS tick — later moves use easeTo in applyLiveGps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapCenter coords intentionally excluded
  }, [mapboxToken, tokenMissing, isDesktopLayout, mapCenter != null]);

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
        age: user.age,
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

  // Always show Hot Spot pins (dim when empty, solid when check-ins present).
  useEffect(() => {
    if (lat == null || lng == null) {
      setHotSpots([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await hotSpotsAPI.listNearby(lat, lng, Math.max(radius, 25));
        if (!cancelled) setHotSpots(res.data.spots ?? []);
      } catch {
        if (!cancelled) setHotSpots([]);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lat, lng, radius]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const visibleIds = new Set<string>();

    hotSpots.forEach((spot) => {
      if (!Number.isFinite(spot.latitude) || !Number.isFinite(spot.longitude)) return;
      visibleIds.add(spot.id);
      const lngLat: [number, number] = [spot.longitude, spot.latitude];
      const existing = hotSpotMarkersRef.current.get(spot.id);
      const pinData = {
        id: spot.id,
        name: spot.name,
        category_icon: spot.category_icon,
        live_count_exact: spot.live_count_exact,
      };

      if (existing) {
        existing.marker.setLngLat(lngLat);
        const prevOccupied = existing.spot.live_count_exact > 0;
        const nextOccupied = spot.live_count_exact > 0;
        if (
          prevOccupied !== nextOccupied ||
          existing.spot.live_count_exact !== spot.live_count_exact ||
          existing.spot.name !== spot.name ||
          existing.spot.category_icon !== spot.category_icon
        ) {
          existing.root.render(<HotSpotPin spot={pinData} size={36} />);
        }
        existing.spot = spot;
        return;
      }

      const { element, root } = createHotSpotPinElement(pinData, () => navigate('/hot-spots'), 36);
      const marker = new mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat(lngLat)
        .addTo(map);
      hotSpotMarkersRef.current.set(spot.id, { marker, root, spot });
    });

    hotSpotMarkersRef.current.forEach(({ marker, root }, spotId) => {
      if (visibleIds.has(spotId)) return;
      marker.remove();
      setTimeout(() => root.unmount(), 0);
      hotSpotMarkersRef.current.delete(spotId);
    });
  }, [hotSpots, mapLoaded, navigate]);

  useEffect(() => {
    if (!mapLoaded || lat == null || lng == null) return;
    selfMarkerRef.current?.setLngLat([lng, lat]);
  }, [mapLoaded, lat, lng]);

  useEffect(() => {
    const root = selfRootRef.current;
    if (!root || !mapLoaded) return;
    const size = pulseUntil ? 56 : 48;
    const el = selfDotRef.current;
    if (el) {
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
    }
    root.render(
      <MapMarker
        user={{
          id: authUser?.id ?? 'self',
          name: authUser?.name ?? 'You',
          photo_url: authUser?.photo_url,
          age: authUser?.age,
          isPulsing: !!pulseUntil,
        }}
        size={size}
      />,
    );
  }, [mapLoaded, pulseUntil, authUser?.id, authUser?.name, authUser?.photo_url, authUser?.age]);

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
        <ActivationBanner
          profile={{
            ...activationProfile,
            // Prefer live store coords so the banner drops the moment GPS works.
            lat: lat ?? activationProfile.lat,
            lng: lng ?? activationProfile.lng,
          }}
          onEnableLocation={handleEnableLocation}
        />
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
              <p className="mt-1 text-[12px] text-[var(--cream-muted)]">
                No swiping. One tap sends interest. Chat unlocks when it&apos;s mutual · consent
               .
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
              className="shrink-0 rounded-full border border-[rgba(196,131,42,0.45)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--cream-muted)] hover:text-[#F0E0C0]"
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
            <p className="mt-0.5 text-[12px] text-[var(--cream-muted)]">
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
              <p className="text-[14px] font-extrabold text-[var(--cream)]">Quiet map? Start Pulse</p>
              <p className="mt-1 text-[13px] text-[var(--cream-muted)]">
                Get 90 minutes of priority visibility and appear first to men nearby.
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
                className="rounded-full border border-[rgba(196,131,42,0.45)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--cream-muted)] transition-colors hover:text-[var(--cream)]"
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
            Allow location to unlock Nearby
          </p>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-[var(--cream-muted)]">
            We need your device location to show men near you. Your exact pin is not shown to others
            — they only see approximate distance. You can adjust your search radius once location is
            on. Shared only while you use the app.
          </p>
          <button
            type="button"
            onClick={handleEnableLocation}
            className="mt-4 rounded-full bg-[#C4832A] px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-wide text-[#1A0E03] transition-colors hover:bg-[#E0A14A]"
          >
            Allow location
          </button>
          {locationNotice ? (
            <p className="mt-3 text-[11px] text-[var(--cream-muted)]">{locationNotice}</p>
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
            <p className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--cream-muted)]">
              Your mood · shown nearby
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
        <div className="relative mb-4 h-[min(48vh,520px)] min-h-[300px] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[#11100E] shadow-[var(--shadow-md)]">
          <div ref={isDesktopLayout ? mapContainerRef : undefined} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between gap-2 p-3">
            <div className="pointer-events-auto">
              <ProximitySlider
                value={radius}
                onChange={(km) => handleRadiusChange(km)}
                variant="map"
              />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border border-[rgba(196,131,42,0.45)] bg-[color-mix(in_srgb,#FFF8F0_90%,transparent)] px-4 py-2 text-[13px] font-semibold text-[#3D2B0E] shadow-md backdrop-blur-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-[#3D7A2E]" />
            {nearbyCount} in your radius · {formatRadiusMiles(radius)}
            {nearbyCount === 0 && radius < MAX_RADIUS_KM - 0.5 ? (
              <button
                type="button"
                className="pointer-events-auto ml-1 font-extrabold text-[#B8732A] underline-offset-2 hover:underline"
                onClick={handleRadiusCycle}
              >
                Expand
              </button>
            ) : null}
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
        <div className="overflow-y-auto pb-24">
          {/* ── Map first: clean, collapsible (swipe up hide / down show / expand) ── */}
          <div
            className={`discover-map-panel relative w-full overflow-hidden border-b border-[var(--border-default)] bg-[#11100E] ${
              mapPanelMode === 'hidden' ? 'is-hidden' : ''
            }`}
            style={{
              height: mapPanelHeightCss(mapPanelMode),
              minHeight: mapPanelMode === 'hidden' ? 0 : 120,
            }}
            data-testid="discover-map-panel"
            data-map-mode={mapPanelMode}
          >
            <div ref={isDesktopLayout ? undefined : mapContainerRef} className="absolute inset-0" />

            {tokenMissing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0A06] px-6 text-center">
                <p className="text-sm font-bold text-[var(--cream)]">Map is taking a break</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--cream-muted)]">
                  Browse who&apos;s nearby below.
                </p>
              </div>
            ) : null}

            {!tokenMissing && !mapCenter ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0A06]/90 px-5 text-center backdrop-blur-sm">
                {needsLocationGate ? (
                  <>
                    <p className="text-sm font-extrabold text-[var(--cream)]">Location required</p>
                    <p className="mt-2 max-w-xs text-xs leading-relaxed text-[var(--cream-muted)]">
                      Grant location to load the map around you.
                    </p>
                    <button
                      type="button"
                      onClick={handleEnableLocation}
                      className="mt-4 rounded-full bg-[#C4832A] px-4 py-2 text-[12px] font-extrabold uppercase tracking-wide text-[#1A0E03]"
                    >
                      Allow location
                    </button>
                  </>
                ) : (
                  <p className="text-xs font-medium uppercase tracking-widest text-[var(--cream-muted)]">
                    {error || 'Getting your location…'}
                  </p>
                )}
              </div>
            ) : null}

            {/* Floating map controls */}
            {mapPanelMode !== 'hidden' ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
                <div className="pointer-events-auto">
                  <ProximitySlider
                    value={radius}
                    onChange={(km) => handleRadiusChange(km)}
                    variant="map"
                  />
                </div>
                <div className="pointer-events-auto flex flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setMapPanel(mapPanelMode === 'expanded' ? 'default' : 'expanded')
                    }
                    data-testid="map-expand-toggle"
                    className="rounded-full border border-[rgba(196,131,42,0.45)] bg-[color-mix(in_srgb,#FFF8F0_92%,transparent)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#3D2B0E] shadow-md backdrop-blur-md"
                  >
                    {mapPanelMode === 'expanded' ? 'Shrink map' : 'Expand map'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapPanel('hidden')}
                    data-testid="map-hide"
                    className="rounded-full border border-[rgba(196,131,42,0.4)] bg-[color-mix(in_srgb,#FFF8F0_92%,transparent)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#5C4A32] shadow-md backdrop-blur-md"
                  >
                    Hide map
                  </button>
                </div>
              </div>
            ) : null}

            {mapPanelMode !== 'hidden' ? (
              <div className="pointer-events-none absolute bottom-10 left-3 z-10 flex items-center gap-2 rounded-full border border-[rgba(196,131,42,0.45)] bg-[color-mix(in_srgb,#FFF8F0_90%,transparent)] px-3 py-1.5 text-[12px] font-semibold text-[#3D2B0E] shadow-md backdrop-blur-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#3D7A2E]" />
                {nearbyCount} nearby · {formatRadiusMiles(radius)}
              </div>
            ) : null}

            {/* Drag handle — swipe up to hide, swipe down to expand */}
            {mapPanelMode !== 'hidden' ? (
              <div
                role="slider"
                aria-label="Map height. Swipe up to hide, swipe down to expand."
                aria-valuemin={0}
                aria-valuemax={2}
                aria-valuenow={mapPanelMode === 'default' ? 1 : 2}
                tabIndex={0}
                data-testid="map-drag-handle"
                onPointerDown={onMapHandlePointerDown}
                onPointerUp={onMapHandlePointerUp}
                onPointerCancel={() => {
                  mapDragRef.current = null;
                }}
                className="absolute inset-x-0 bottom-0 z-20 flex cursor-grab touch-none flex-col items-center active:cursor-grabbing"
                style={{ touchAction: 'none' }}
              >
                <div className="flex w-full flex-col items-center bg-gradient-to-t from-[rgba(13,10,6,0.75)] via-[rgba(13,10,6,0.35)] to-transparent pb-2 pt-6">
                  <span className="mb-1 h-1.5 w-10 rounded-full bg-[#F0E0C0]/90 shadow-sm" />
                  <span className="rounded-full bg-[color-mix(in_srgb,#FFF8F0_88%,transparent)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#3D2B0E]">
                    Swipe up to hide · down to enlarge
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* When map hidden: show bar to pull it back */}
          {mapPanelMode === 'hidden' ? (
            <button
              type="button"
              data-testid="map-show-bar"
              onClick={() => setMapPanel('default')}
              onPointerDown={onMapHandlePointerDown}
              onPointerUp={onMapHandlePointerUp}
              className="flex w-full items-center justify-center gap-2 border-b border-[var(--border-default)] bg-[var(--bg-elevated)]/90 px-4 py-2.5 text-[12px] font-extrabold uppercase tracking-wide text-[var(--copper)]"
            >
              <span className="h-1 w-8 rounded-full bg-[var(--copper)]/60" aria-hidden />
              Show map
              <span className="h-1 w-8 rounded-full bg-[var(--copper)]/60" aria-hidden />
            </button>
          ) : null}

          <div className="space-y-3 px-4 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <div
                data-testid="nearby-counts"
                className="inline-flex min-h-[36px] items-center rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)]/85 px-3 py-1.5 shadow-md backdrop-blur-sm"
              >
                <p className="text-[11px] font-bold tracking-wide text-[var(--cream-soft)] whitespace-nowrap">
                  {loading && nearbyCount === 0 ? (
                    <span className="text-[var(--cream-muted)]">Scanning…</span>
                  ) : nearbyCount === 0 ? (
                    <button
                      type="button"
                      onClick={handleRadiusCycle}
                      data-testid="expand-radius-chip"
                      className="text-[var(--copper)]"
                    >
                      EXPAND YOUR RADIUS →
                    </button>
                  ) : (
                    <>
                      <span className="font-black text-[var(--copper)]">{nearbyCount}</span> NEARBY
                      <span className="mx-1.5 text-[var(--cream-muted)]">·</span>
                      <span className="font-black text-[var(--copper)]">{onlineCount}</span> ONLINE
                    </>
                  )}
                </p>
              </div>
              <DiscoveryFilterPills radiusKm={radius} onRadiusChange={handleRadiusChange} />
              <div
                className="ml-auto flex items-center overflow-hidden rounded-full border bg-[var(--bg-elevated)]/85 backdrop-blur-sm"
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
                  {locationNotice.startsWith('Using your last saved location') ||
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

            {/* Compact filters + mood under map, not above */}
            <details className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/60 px-3 py-2">
              <summary className="cursor-pointer text-[12px] font-extrabold uppercase tracking-wide text-[var(--cream-muted)]">
                Filters & mood
              </summary>
              <div className="mt-3 space-y-3">
                {!needsLocationGate ? (
                  <div data-testid="discover-mood-strip-mobile">
                    <MoodPicker current={mood} onSelect={handleMoodSelect} />
                  </div>
                ) : null}
                <DiscoveryFilterPanel
                  variant="inline"
                  value={discoveryFilters}
                  onChange={handleDiscoveryFiltersChange}
                />
              </div>
            </details>

            {/* Profiles: two squares per row, directly under map */}
            {!needsLocationGate ? (
              <>
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
                <EventsRail
                  lat={lat}
                  lng={lng}
                  onSelect={(ev: EventDTO) => navigate(`/rooms/${ev.id}`)}
                />
              </>
            ) : null}
          </div>
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
