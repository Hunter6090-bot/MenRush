import crypto from 'crypto';

/** Historical default — preserves pre-slider 80–320 m behaviour when max=320. */
export const MAP_PIN_FUZZ_DEFAULT_M = 320;
export const MAP_PIN_FUZZ_MIN_M = 80;
export const MAP_PIN_FUZZ_MAX_M = 800;

export function clampMapPinFuzzM(meters: number): number {
  if (!Number.isFinite(meters)) return MAP_PIN_FUZZ_DEFAULT_M;
  return Math.min(MAP_PIN_FUZZ_MAX_M, Math.max(MAP_PIN_FUZZ_MIN_M, Math.round(meters)));
}

/** Inclusive offset band for a user's max fuzz setting. */
export function fuzzRangeMeters(fuzzMaxM: number): { min: number; max: number } {
  const max = clampMapPinFuzzM(fuzzMaxM);
  // max=320 → min=80 (exact historical band).
  const min = Math.max(40, Math.round(max * 0.25));
  return { min, max };
}

/**
 * Privacy fuzz for map pins: keep people near where they actually are, with a
 * deterministic offset so exact home/street is not public.
 *
 * Seed without viewer position so the pin is stable for everyone viewing this person.
 */
export function privateMapPointAround(
  realLat: number,
  realLng: number,
  seed: string,
  fuzzMaxM: number = MAP_PIN_FUZZ_DEFAULT_M,
): { lat: number; lng: number } {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const { min, max } = fuzzRangeMeters(fuzzMaxM);
  const span = max - min + 1;
  const meters = min + (hash.readUInt16BE(0) % span);
  const bearing = ((hash.readUInt16BE(2) % 360) * Math.PI) / 180;
  const dLat = (meters / 1000 / 111) * Math.cos(bearing);
  const longitudeScale = Math.max(Math.cos((realLat * Math.PI) / 180), 0.2);
  const dLng = (meters / 1000 / (111 * longitudeScale)) * Math.sin(bearing);
  return {
    lat: Number((realLat + dLat).toFixed(6)),
    lng: Number((realLng + dLng).toFixed(6)),
  };
}
