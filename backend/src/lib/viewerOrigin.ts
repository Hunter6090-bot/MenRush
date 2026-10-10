import { query } from '../db';

/**
 * The viewer's stored location: the only origin radius queries use. Client
 * lat/lng never sets the query point directly; it can only move the stored
 * location through userService.updateLocation, which ignores implausible jumps.
 */
export async function viewerStoredLocation(
  userId: string,
): Promise<{ lat: number; lng: number } | null> {
  const res = await query(
    `SELECT lat, lng FROM profiles
      WHERE user_id = $1 AND location IS NOT NULL AND lat IS NOT NULL AND lng IS NOT NULL`,
    [userId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
