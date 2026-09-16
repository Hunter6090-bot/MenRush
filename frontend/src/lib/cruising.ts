/**
 * MenRush Cruising Search — Phase 1
 * Helpers for outdoor / cruising spots:
 * - Category mapping (woods | beach | layby | park)
 * - Honest activity status
 * - One-tap device directions URL
 * - Mapbox static thumbnail URL
 */
import type { HotSpotDTO } from '../api/client';

export type CruisingCategory = 'woods' | 'beach' | 'layby' | 'park';

export const CRUISING_CATEGORIES: CruisingCategory[] = ['woods', 'beach', 'layby', 'park'];

export const CRUISING_CATEGORY_META: Record<
  CruisingCategory,
  { label: string; icon: string; description: string }
> = {
  woods: {
    label: 'Woods',
    icon: '🌲',
    description: 'Woodland, copses and forests',
  },
  beach: {
    label: 'Beach',
    icon: '🏖️',
    description: 'Beaches, dunes and coastal spots',
  },
  layby: {
    label: 'Layby',
    icon: '🅿️',
    description: 'Roadside pull-ins and car parks',
  },
  park: {
    label: 'Park',
    icon: '🌿',
    description: 'Parks, commons, heaths and open trails',
  },
};

/**
 * Sensibly map existing DB seed fields (category_slug, name, description)
 * to one of the 4 Phase 1 Cruising categories:
 * woods | beach | layby | park
 */
export function mapToCruisingCategory(spot: {
  category_slug?: string;
  category_name?: string;
  description?: string | null;
  name?: string;
}): CruisingCategory {
  const text = `${spot.name ?? ''} ${spot.description ?? ''} ${spot.category_name ?? ''}`.toLowerCase();
  const slug = (spot.category_slug ?? '').toLowerCase();

  // 1. Beach (coastal, dunes, sand, naturist shore)
  if (/\b(?:beach|beaches|coast|coastal|dunes?|shore|cove|naturist)\b/i.test(text)) {
    return 'beach';
  }

  // 2. Layby (roadside laybys, pull-ins, truck stops, parking)
  if (
    /\b(?:layby|lay-by|pull-in|rest\s*layby|rest\s*stop|truck\s*stop)\b/i.test(text) ||
    slug === 'parking' ||
    /\bcar\s*park\b/i.test(spot.description ?? '') ||
    /\bcar\s*park\b/i.test(spot.name ?? '')
  ) {
    return 'layby';
  }

  // 3. Woods (woodland, copses, forests, thickets)
  if (
    /\b(?:wood|woods|woodland|copse|copses|forest|forests|thicket|plantation|trees?|spinney|pinetum)\b/i.test(
      text,
    ) ||
    (spot.description ?? '').toLowerCase() === 'woodland'
  ) {
    return 'woods';
  }

  // 4. Park / Open space (public parks, commons, hills, ridges, heaths, downs)
  if (
    /\b(?:park|parks|common|commons|heath|downs|hill|hills|ridge|meadow|gardens?|trail|recreation|open\s*space)\b/i.test(
      text,
    ) ||
    slug === 'parks-trails' ||
    slug === 'open-spaces' ||
    (spot.description ?? '').toLowerCase() === 'public park'
  ) {
    return 'park';
  }

  // Fallbacks based on category slug
  if (slug === 'parking') return 'layby';
  if (slug === 'parks-trails') return 'woods';
  return 'park';
}

/**
 * Honest last active indicator:
 * - Real check-ins if active now
 * - Time elapsed since last activity if recent
 * - Honest placeholder "No recent check-ins" when no signal (Phase 1)
 */
export function formatLastActiveTime(spot: {
  has_active_checkins?: boolean;
  live_count_exact?: number;
  live_count?: number | string;
  last_activity_at?: string | null;
}): string {
  if (spot.has_active_checkins || (spot.live_count_exact ?? 0) > 0) {
    const count = spot.live_count_exact ?? spot.live_count;
    if (typeof count === 'number' && count > 1) {
      return `${count} checked in now`;
    }
    return 'Active now';
  }

  if (spot.last_activity_at) {
    const date = new Date(spot.last_activity_at);
    if (!isNaN(date.getTime())) {
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 60 && diffMins >= 0) {
        return `Active ${Math.max(1, diffMins)}m ago`;
      }
      if (diffHours < 24 && diffHours >= 0) {
        return `Active ${diffHours}h ago`;
      }
      if (diffDays === 1) {
        return 'Active yesterday';
      }
      if (diffDays < 7 && diffDays > 1) {
        return `Active ${diffDays}d ago`;
      }
    }
  }

  return 'No recent check-ins';
}

/**
 * Returns navigation URL for the user's default maps app:
 * - Apple Maps on iOS devices
 * - Google Maps Universal Directions Link on Android and desktop web
 */
export function getDirectionsUrl(lat: number, lng: number, name?: string): string {
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  if (isIOS) {
    const encodedName = name ? `&q=${encodeURIComponent(name)}` : '';
    return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d${encodedName}`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Returns static Mapbox satellite/streets thumbnail URL for a pin location.
 * Falls back to null if token is missing/placeholder.
 */
export function getMapboxStaticThumbnailUrl(
  lat: number,
  lng: number,
  token?: string,
  theme: 'dark' | 'light' = 'dark',
): string | null {
  if (!token || token === '__SET_ME__' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const style = theme === 'dark' ? 'dark-v11' : 'light-v11';
  // Copper pin color #C4832A (c4832a)
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/pin-s+c4832a(${lng},${lat})/${lng},${lat},13.5,0/160x100@2x?access_token=${token}`;
}

/**
 * Filter spots to ensure only valid finite coordinates appear.
 */
export function isValidCoordinateSpot(spot: Partial<HotSpotDTO>): boolean {
  return (
    spot.latitude != null &&
    spot.longitude != null &&
    Number.isFinite(spot.latitude) &&
    Number.isFinite(spot.longitude) &&
    spot.latitude !== 0 &&
    spot.longitude !== 0 &&
    spot.latitude >= -90 &&
    spot.latitude <= 90 &&
    spot.longitude >= -180 &&
    spot.longitude <= 180
  );
}
