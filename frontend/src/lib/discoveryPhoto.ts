/**
 * Nearby Map / Cruise grid face: prefer Map photo when set so the main shot
 * can stay private. Full profile paths keep using photo_url unchanged.
 */
export function discoveryPhotoUrl(
  mapPhotoUrl?: string | null,
  mainPhotoUrl?: string | null,
): string | null {
  const map = typeof mapPhotoUrl === 'string' ? mapPhotoUrl.trim() : '';
  if (map) return map;
  const main = typeof mainPhotoUrl === 'string' ? mainPhotoUrl.trim() : '';
  return main || null;
}
