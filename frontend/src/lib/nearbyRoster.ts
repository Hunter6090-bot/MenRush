import { isUserPulsing, type DiscoveryPresence } from './discovery';

/**
 * Stable fingerprint for Nearby roster identity.
 * Background GPS polls must not replace `users` (and re-render Grid + markers)
 * when nothing visible changed.
 *
 * PERF next pass: if marker count grows past ~80 on phone, switch Mapbox HTML
 * markers to a clustered GeoJSON layer and keep pins for tapped selection only.
 */
export function nearbyRosterFingerprint(
  users: Array<
    DiscoveryPresence & {
      id: string;
      name?: string | null;
      photo_url?: string | null;
      looking_for?: string | null;
      lat?: number | null;
      lng?: number | null;
      is_verified?: boolean | null;
      age?: number | null;
    }
  >,
): string {
  if (!Array.isArray(users) || users.length === 0) return '';
  return users
    .map((u) => {
      const dist = u.distance_label ?? u.distance_km ?? '';
      return [
        u.id,
        u.online ? '1' : '0',
        u.photo_url ?? '',
        String(dist),
        isUserPulsing(u) ? '1' : '0',
        u.name ?? '',
        u.age ?? '',
        u.lat ?? '',
        u.lng ?? '',
        u.is_verified ? '1' : '0',
        u.looking_for ?? '',
      ].join('\u0001');
    })
    .join('\u0002');
}
