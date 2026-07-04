export interface SharedLocation {
  lat: number;
  lng: number;
}

export function formatLocationPayload(lat: number, lng: number): string {
  return JSON.stringify({ lat, lng });
}

export function parseLocationPayload(
  mediaType: string | null | undefined,
  message: string,
): SharedLocation | null {
  if (mediaType !== 'location') return null;
  try {
    const data = JSON.parse(message) as { lat?: unknown; lng?: unknown };
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) return null;
    return { lat: data.lat, lng: data.lng };
  } catch {
    return null;
  }
}
