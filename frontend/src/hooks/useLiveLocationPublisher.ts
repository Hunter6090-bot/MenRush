import { useEffect, useRef } from 'react';
import { usersAPI } from '../api/client';
import { FEATURES } from '../lib/featureFlags';
import { useAuthStore, useLocationStore } from './store';

const MIN_PUSH_MS = 20_000;
const MIN_MOVE_METERS = 40;

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
 * Members consent to location at signup (Terms §6.2) — this hook collects GPS
 * without extra in-app consent prompts. Match live location, Nearby, and chat
 * maps all read from this — not seeded pins.
 */
export function useLiveLocationPublisher() {
  const token = useAuthStore((s) => s.token);
  const isVerified = useAuthStore((s) => s.user?.is_verified);
  const setLocation = useLocationStore((s) => s.setLocation);
  const lastPushRef = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    if (FEATURES.requireIdVerification && !isVerified) return;
    if (typeof window === 'undefined' || !window.isSecureContext || !navigator.geolocation) return;

    const push = (latitude: number, longitude: number, force = false) => {
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

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => push(coords.latitude, coords.longitude, true),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => push(coords.latitude, coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [token, isVerified, setLocation]);
}