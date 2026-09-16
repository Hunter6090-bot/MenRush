import { describe, it, expect } from 'vitest';
import {
  clampMapPinFuzzM,
  formatFuzzPrivacyNote,
  fuzzRangeMeters,
  MAP_PIN_FUZZ_DEFAULT_M,
  nearestMapPinFuzzStep,
} from './mapPinFuzz';

describe('mapPinFuzz', () => {
  it('preserves historical 80–320 m band at default', () => {
    expect(fuzzRangeMeters(MAP_PIN_FUZZ_DEFAULT_M)).toEqual({ min: 80, max: 320 });
    expect(formatFuzzPrivacyNote(320)).toBe('Pins ~80–320 m for privacy');
  });

  it('clamps and snaps to quiet steps', () => {
    expect(clampMapPinFuzzM(50)).toBe(80);
    expect(clampMapPinFuzzM(900)).toBe(800);
    expect(nearestMapPinFuzzStep(300)).toBe(320);
    expect(formatFuzzPrivacyNote(800)).toBe('Pins ~200–800 m for privacy');
  });
});
