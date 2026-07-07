import type { NearbyUser } from '../components/ProfileCard';

const TRIBE_TAGS = [
  'Twink', 'Twunk', 'Otter', 'Bear', 'Cub', 'Daddy', 'Wolf', 'Jock', 'Leather', 'Rugged', 'Geek',
];

/** Matches backend `/users/nearby` clamp: Math.min(Math.max(radius, 1), 50). */
export const MAX_RADIUS_KM = 50;

/** "All" uses the widest search the API allows (~31 miles). */
export const RADIUS_ALL_KM = MAX_RADIUS_KM;

const KM_PER_MILE = 1.60934;

/** Every whole mile from 1 up to the API cap. */
export const RADIUS_MILE_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1) as readonly number[];

export type RadiusMilesSelection = 'all' | number;

/** Quick-pick mile presets on Discover (toggle on second click). */
export const QUICK_RADIUS_MILES = [1, 5, 25] as const;
export type QuickRadiusMiles = (typeof QUICK_RADIUS_MILES)[number];

export const DEFAULT_RADIUS_KM = 5;

/** @deprecated Use QUICK_RADIUS_MILES */
export const DESKTOP_RADIUS_MILES = QUICK_RADIUS_MILES;
export type DesktopRadiusMiles = QuickRadiusMiles;

export function isQuickRadiusActive(radiusKm: number, miles: QuickRadiusMiles): boolean {
  return Math.abs(clampRadiusKm(radiusKm) - radiusSelectionToKm(miles)) < 0.2;
}

export const INTENT_FILTERS = ['All', 'Chat', 'Drinks', 'Date', 'NSA'] as const;
export type IntentFilter = (typeof INTENT_FILTERS)[number];

export function milesToKm(miles: number): number {
  return Math.round(miles * KM_PER_MILE * 10) / 10;
}

export function kmToMiles(km: number): number {
  return km / KM_PER_MILE;
}

export function clampRadiusKm(km: number): number {
  return Math.min(Math.max(km, 1), MAX_RADIUS_KM);
}

export function kmToRadiusSelection(km: number): RadiusMilesSelection {
  const clamped = clampRadiusKm(km);
  if (clamped >= RADIUS_ALL_KM - 0.5) return 'all';
  const miles = Math.round(kmToMiles(clamped));
  if (miles >= 1 && miles <= RADIUS_MILE_OPTIONS.length) return miles;
  return RADIUS_MILE_OPTIONS.reduce((best, option) =>
    Math.abs(milesToKm(option) - clamped) < Math.abs(milesToKm(best) - clamped) ? option : best,
  );
}

export function radiusSelectionToKm(selection: RadiusMilesSelection): number {
  if (selection === 'all') return RADIUS_ALL_KM;
  return clampRadiusKm(milesToKm(selection));
}

export function formatRadiusMiles(km: number): string {
  const selection = kmToRadiusSelection(km);
  if (selection === 'all') return 'All';
  return `${selection} mile${selection === 1 ? '' : 's'}`;
}

export function formatRadiusMilesLabel(selection: RadiusMilesSelection): string {
  if (selection === 'all') return 'All';
  return `${selection} mile${selection === 1 ? '' : 's'}`;
}

export function formatDistanceMiles(user: NearbyUser): string {
  const km = Number(user.distance_km ?? 0);
  if (!Number.isFinite(km) || km <= 0) return 'Nearby';
  const miles = km * 0.621371;
  if (miles < 0.1) return '< 0.1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export function formatActiveStatus(user: NearbyUser): string {
  if (user.online) return 'Active now';
  if (!user.last_seen) return 'Recently';
  const diffMs = Date.now() - new Date(user.last_seen).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Active now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return 'Recently';
}

export function getTribeTag(user: NearbyUser): string {
  const interests = user.interests ?? [];
  const tribe = interests.find((tag) => TRIBE_TAGS.includes(tag));
  return tribe ?? interests[0] ?? 'Nearby';
}

export function matchesIntentFilter(user: NearbyUser, filter: IntentFilter): boolean {
  if (filter === 'All') return true;
  const mood = (user.mood ?? '').toLowerCase();
  const lookingFor = ((user as NearbyUser & { looking_for?: string }).looking_for ?? '').toLowerCase();
  const interests = (user.interests ?? []).map((t) => t.toLowerCase());

  switch (filter) {
    case 'Chat':
      return user.online || mood.includes('chat') || interests.includes('chat');
    case 'Drinks':
      return mood.includes('drink') || lookingFor.includes('drink') || interests.includes('drinks');
    case 'Date':
      return lookingFor.includes('dat') || mood.includes('date') || interests.includes('dating');
    case 'NSA':
      return lookingFor.includes('nsa') || mood.includes('nsa') || interests.includes('nsa');
    default:
      return true;
  }
}
