import { useEffect, useRef } from 'react';
import { usersAPI } from '../api/client';
import { FEATURES } from '../lib/featureFlags';
import { requestDeviceLocation } from '../lib/deviceLocation';
import { useAuthStore, useLocationStore } from './store';

const MIN_PUSH_MS = 20_000;
const MIN_MOVE_METERS = 40;
/** Keep last_seen fresh while the app is open so Nearby "Active now" stays honest (20m window). */
const HEARTBEAT_MS = 8 * 60 * 1000;
/** Re-try when first fix fails (permission prompt, cold GPS). */
const RETRY_MS = 25_000;

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6_371_000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(x)));
}

/**
 * Keeps the signed-in user's profile location in sync with device GPS.
 * Members consent to location at signup (Terms §6.2). High-accuracy first,
 * low-accuracy fallback — never invents city pins. 18+ only.
 */
export function useLiveLocationPublisher() {
  const token = useAuthStore((s) => s.token);
  const isVerified = useAuthStore((s) => s.user?.is_verified);
  const setLocation = useLocationStore((s) => s.setLocation);
  const lastPushRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const deniedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (FEATURES.requireIdVerification && !isVerified) return;
    if (typeof window === 'undefined') return;

    deniedRef.current = false;

    const pushCoords = (latitude: number, longitude: number, force = false) => {
      setLocation(latitude, longitude);
      const last = lastPushRef.current;
      const now = Date.now();
      const movedEnough =
        !last || distanceMeters(last.lat, last.lng, latitude, longitude) >= MIN_MOVE_METERS;
      const waitedEnough = !last || now - last.at >= MIN_PUSH_MS;
      if (!force && last && !movedEnough && !waitedEnough) return;

      lastPushRef.current = { lat: latitude, lng: longitude, at: now };
      void usersAPI.updateLocation(latitude, longitude).catch(() => {});
    };

    const acquire = async (force = false) => {
      if (deniedRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      const result = await requestDeviceLocation();
      if (!result.ok) {
        if (result.error === 'denied') deniedRef.current = true;
        return;
      }
      pushCoords(result.lat, result.lng, force);
    };

    void acquire(true);

    // watchPosition for continuous updates when permission already granted.
    let watchId: number | null = null;
    if (window.isSecureContext && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        ({ coords }) => pushCoords(coords.latitude, coords.longitude),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) deniedRef.current = true;
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
      );
    }

    const heartbeatId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const last = lastPushRef.current;
      if (last) {
        void usersAPI.updateLocation(last.lat, last.lng).catch(() => {});
        lastPushRef.current = { ...last, at: Date.now() };
        return;
      }
      void acquire(true);
    }, HEARTBEAT_MS);

    // Cold GPS / first prompt often fails once — retry while we have no pin.
    const retryId = window.setInterval(() => {
      if (lastPushRef.current || deniedRef.current) return;
      void acquire(true);
    }, RETRY_MS);

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (!lastPushRef.current && !deniedRef.current) void acquire(true);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      window.clearInterval(heartbeatId);
      window.clearInterval(retryId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, isVerified, setLocation]);
}
