/**
 * Locale-aware distance and regional formatting.
 * Internal/API distances stay in km; display follows where the user is (GPS first).
 */

export type DistanceUnitSystem = 'imperial' | 'metric';

const KM_PER_MILE = 1.60934;
const MILES_PER_KM = 1 / KM_PER_MILE;

/** Countries that commonly use miles for everyday distance. */
const IMPERIAL_REGIONS = new Set(['GB', 'US', 'LR', 'MM']);

/** Timezones that imply miles even when locale region is missing. */
const IMPERIAL_TIMEZONES = new Set([
  'Europe/London',
  'Europe/Belfast',
  'Europe/Guernsey',
  'Europe/Isle_of_Man',
  'Europe/Jersey',
]);

const IMPERIAL_TIMEZONE_PREFIXES = ['America/', 'Pacific/Honolulu', 'Pacific/Guam'];

export interface LocaleCoords {
  lat?: number | null;
  lng?: number | null;
}

let activeCoords: LocaleCoords | null = null;

/** Keep in sync with GPS updates (called from the location store). */
export function syncLocaleCoords(lat: number | null, lng: number | null): void {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  activeCoords = { lat, lng };
}

function regionFromBrowserLocale(): string | null {
  if (typeof navigator === 'undefined') return null;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of candidates) {
    try {
      const locale = new Intl.Locale(tag);
      if (locale.region) return locale.region.toUpperCase();
    } catch {
      const match = tag.match(/[-_]([A-Za-z]{2})\b/);
      if (match?.[1]) return match[1].toUpperCase();
    }
  }
  return null;
}

function timezoneFromBrowser(): string | null {
  if (typeof Intl === 'undefined') return null;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

function isImperialTimezone(tz: string | null): boolean {
  if (!tz) return false;
  if (IMPERIAL_TIMEZONES.has(tz)) return true;
  return IMPERIAL_TIMEZONE_PREFIXES.some((prefix) => tz.startsWith(prefix));
}

/** Rough bounding boxes — good enough for unit selection, not geocoding. */
function regionFromCoords(lat: number, lng: number): string | null {
  // United Kingdom + Crown Dependencies + NI
  if (lat >= 49.8 && lat <= 60.95 && lng >= -8.75 && lng <= 1.95) return 'GB';
  // Ireland (Republic) — metric
  if (lat >= 51.35 && lat <= 55.45 && lng >= -10.75 && lng <= -5.45) return 'IE';
  // Continental US (incl. Alaska/Hawaii approx)
  if (
    (lat >= 24.0 && lat <= 49.6 && lng >= -125.0 && lng <= -66.0) ||
    (lat >= 51.0 && lat <= 71.5 && lng >= -172.0 && lng <= -129.0) ||
    (lat >= 18.0 && lat <= 23.0 && lng >= -161.0 && lng <= -154.0)
  ) {
    return 'US';
  }
  return null;
}

export function resolveDistanceUnitSystem(coords: LocaleCoords = activeCoords ?? {}): DistanceUnitSystem {
  const lat = coords.lat;
  const lng = coords.lng;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const geoRegion = regionFromCoords(lat, lng);
    if (geoRegion && IMPERIAL_REGIONS.has(geoRegion)) return 'imperial';
    if (geoRegion) return 'metric';
  }

  const localeRegion = regionFromBrowserLocale();
  if (localeRegion && IMPERIAL_REGIONS.has(localeRegion)) return 'imperial';
  if (localeRegion) return 'metric';

  if (isImperialTimezone(timezoneFromBrowser())) return 'imperial';
  return 'metric';
}

export function resolveLocaleTag(coords: LocaleCoords = activeCoords ?? {}): string {
  const lat = coords.lat;
  const lng = coords.lng;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const geoRegion = regionFromCoords(lat, lng);
    if (geoRegion === 'GB') return 'en-GB';
    if (geoRegion === 'US') return 'en-US';
    if (geoRegion === 'IE') return 'en-IE';
  }

  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en-GB';
}

export function formatDistanceFromKm(
  km: number,
  system: DistanceUnitSystem = resolveDistanceUnitSystem(),
): string {
  if (!Number.isFinite(km) || km <= 0) return 'Nearby';

  if (system === 'imperial') {
    const miles = km * MILES_PER_KM;
    if (miles < 0.2) return '< 0.2 mi';
    if (miles < 10) return `${miles.toFixed(1)} mi`;
    return `${Math.round(miles)} mi`;
  }

  if (km < 0.3) return '< 300 m';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function formatRadiusFromKm(
  km: number,
  system: DistanceUnitSystem = resolveDistanceUnitSystem(),
): string {
  const clamped = Math.min(Math.max(km, 0.8), 50);
  if (clamped >= 49.5) return 'All';

  if (system === 'imperial') {
    const miles = clamped * MILES_PER_KM;
    if (miles < 1) {
      const snapped = Math.round(miles * 2) / 2;
      const milesText = snapped % 1 === 0 ? String(snapped) : snapped.toFixed(1);
      return `${milesText} mile${snapped === 1 ? '' : 's'}`;
    }
    const rounded = Math.round(miles);
    return `${rounded} mile${rounded === 1 ? '' : 's'}`;
  }

  const rounded = Math.round(clamped);
  return `${rounded} km`;
}

export function formatRadiusLabelFromKm(
  km: number,
  system: DistanceUnitSystem = resolveDistanceUnitSystem(),
): string {
  return formatRadiusFromKm(km, system);
}

/** Metric radius picker values (km). Imperial uses mile options elsewhere. */
export const RADIUS_KM_OPTIONS = [1, 2, 5, 10, 20, 30, 50] as const;

export function kmToDisplayRadiusValue(km: number, system: DistanceUnitSystem): number | 'all' {
  const clamped = Math.min(Math.max(km, 0.8), 50);
  if (clamped >= 49.5) return 'all';
  if (system === 'imperial') return Math.max(1, Math.round(clamped * MILES_PER_KM));
  return RADIUS_KM_OPTIONS.reduce((best, option) =>
    Math.abs(option - clamped) < Math.abs(best - clamped) ? option : best,
  );
}

export function displayRadiusValueToKm(value: number | 'all', system: DistanceUnitSystem): number {
  if (value === 'all') return 50;
  if (system === 'imperial') {
    return Math.min(Math.max(Math.round(value * KM_PER_MILE * 10) / 10, 0.8), 50);
  }
  return Math.min(Math.max(value, 1), 50);
}

export { KM_PER_MILE, MILES_PER_KM };