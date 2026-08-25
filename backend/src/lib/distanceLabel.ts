/** Bucketed distance labels — same privacy steps as nearby profiles. */
export function bucketDistanceLabel(distanceM: number | null | undefined): string {
  if (distanceM == null || !Number.isFinite(distanceM)) return 'Nearby';
  const km = distanceM / 1000;
  if (km < 0.3) return '< 300 m';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 5) return `${(Math.round(km * 2) / 2).toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function bucketDistanceKm(distanceM: number | null | undefined): string {
  if (distanceM == null || !Number.isFinite(distanceM)) return '0.20';
  const km = distanceM / 1000;
  if (km < 0.3) return '0.20';
  if (km < 1) return (Math.round(km * 10) / 10).toFixed(2);
  if (km < 5) return (Math.round(km * 2) / 2).toFixed(2);
  return Math.round(km).toFixed(2);
}
