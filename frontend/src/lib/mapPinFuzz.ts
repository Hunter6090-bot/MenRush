/** Map pin discretion / location randomization — mirrors backend mapPinFuzz. */

export const MAP_PIN_FUZZ_DEFAULT_M = 320;
export const MAP_PIN_FUZZ_MIN_M = 80;
export const MAP_PIN_FUZZ_MAX_M = 800;

/** Quiet discrete steps for the map Discretion slider (metres). */
export const MAP_PIN_FUZZ_STEPS_M: readonly number[] = [
  80, 120, 160, 200, 250, 320, 400, 500, 650, 800,
];

export function clampMapPinFuzzM(meters: number): number {
  if (!Number.isFinite(meters)) return MAP_PIN_FUZZ_DEFAULT_M;
  return Math.min(MAP_PIN_FUZZ_MAX_M, Math.max(MAP_PIN_FUZZ_MIN_M, Math.round(meters)));
}

export function fuzzRangeMeters(fuzzMaxM: number): { min: number; max: number } {
  const max = clampMapPinFuzzM(fuzzMaxM);
  const min = Math.max(40, Math.round(max * 0.25));
  return { min, max };
}

export function nearestMapPinFuzzStep(meters: number): number {
  const clamped = clampMapPinFuzzM(meters);
  let best = MAP_PIN_FUZZ_STEPS_M[0];
  for (const step of MAP_PIN_FUZZ_STEPS_M) {
    if (Math.abs(step - clamped) < Math.abs(best - clamped)) best = step;
  }
  return best;
}

export function formatFuzzPrivacyNote(fuzzMaxM: number): string {
  const { min, max } = fuzzRangeMeters(fuzzMaxM);
  const lo = Math.round(min / 10) * 10;
  const hi = Math.round(max / 10) * 10;
  return `Pins ~${lo}–${hi} m for privacy`;
}

export function formatFuzzMetersLabel(fuzzMaxM: number): string {
  return `~${clampMapPinFuzzM(fuzzMaxM)} m`;
}

/**
 * Deterministic pin offset — same algorithm as backend `privateMapPointAround`
 * (SHA-256 of seed). Used so your own map pin preview matches what others see.
 */
export async function privateMapPointAround(
  realLat: number,
  realLng: number,
  seed: string,
  fuzzMaxM: number = MAP_PIN_FUZZ_DEFAULT_M,
): Promise<{ lat: number; lng: number }> {
  const data = new TextEncoder().encode(seed);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hash = new Uint8Array(digest);
  const view = new DataView(hash.buffer);
  const { min, max } = fuzzRangeMeters(fuzzMaxM);
  const span = max - min + 1;
  const meters = min + (view.getUint16(0, false) % span);
  const bearing = ((view.getUint16(2, false) % 360) * Math.PI) / 180;
  const dLat = (meters / 1000 / 111) * Math.cos(bearing);
  const longitudeScale = Math.max(Math.cos((realLat * Math.PI) / 180), 0.2);
  const dLng = (meters / 1000 / (111 * longitudeScale)) * Math.sin(bearing);
  return {
    lat: Number((realLat + dLat).toFixed(6)),
    lng: Number((realLng + dLng).toFixed(6)),
  };
}
