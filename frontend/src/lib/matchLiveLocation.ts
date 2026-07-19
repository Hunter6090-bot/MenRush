export interface MatchLiveLocationFields {
  live_location_sharing?: boolean;
  lat?: number | string | null;
  lng?: number | string | null;
  location_updated_at?: string | null;
  distance_km?: number | string | null;
  live_lat?: number | string | null;
  live_lng?: number | string | null;
  live_location_updated_at?: string | null;
  live_distance_km?: number | string | null;
}

import { formatDistanceFromKm } from './localeUnits';

export function formatMatchDistanceKm(km: number | string | null | undefined): string | null {
  if (km == null || km === '') return null;
  const value = Number(km);
  if (!Number.isFinite(value)) return null;
  return formatDistanceFromKm(value);
}

export function hasVisibleMatchLocation(match: MatchLiveLocationFields): boolean {
  const lat = Number(match.lat ?? match.live_lat);
  const lng = Number(match.lng ?? match.live_lng);
  const sharing = match.live_location_sharing !== false;
  return sharing && Number.isFinite(lat) && Number.isFinite(lng);
}

export function getMatchCoordinates(match: MatchLiveLocationFields): { lat: number; lng: number } | null {
  if (!hasVisibleMatchLocation(match)) return null;
  return {
    lat: Number(match.lat ?? match.live_lat),
    lng: Number(match.lng ?? match.live_lng),
  };
}