export interface DiscoveryPresence {
  distance_km?: string | number | null;
  distance_label?: string | null;
  is_pulsing?: boolean | null;
  pulse_expires_at?: string | null;
  available_until?: string | null;
}

function hasFutureTimestamp(value?: string | null): boolean {
  if (!value) return false;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) && ts > Date.now();
}

export function isUserPulsing(user: DiscoveryPresence): boolean {
  if (user.is_pulsing) return true;
  return hasFutureTimestamp(user.pulse_expires_at) || hasFutureTimestamp(user.available_until);
}

export function getDistanceLabel(user: DiscoveryPresence): string {
  if (user.distance_label) return user.distance_label;

  const km = Number(user.distance_km ?? 0);
  if (!Number.isFinite(km) || km <= 0) return 'Nearby';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
