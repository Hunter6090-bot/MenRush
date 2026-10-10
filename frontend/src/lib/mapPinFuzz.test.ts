import { describe, it, expect } from 'vitest';
import {
  clampMapPinFuzzM,
  formatFuzzPrivacyNote,
  fuzzRangeMeters,
  MAP_PIN_FUZZ_DEFAULT_M,
  MAP_PIN_FUZZ_STEPS_M,
  nearestMapPinFuzzStep,
} from './mapPinFuzz';

describe('mapPinFuzz', () => {
  it('preserves historical 80–320 m band at default', () => {
    expect(fuzzRangeMeters(MAP_PIN_FUZZ_DEFAULT_M)).toEqual({ min: 80, max: 320 });
    expect(formatFuzzPrivacyNote(320)).toBe('Your pin is moved 80 to 320 m');
  });

  it('clamps and snaps to quiet steps', () => {
    expect(clampMapPinFuzzM(50)).toBe(80);
    expect(clampMapPinFuzzM(900)).toBe(800);
    expect(nearestMapPinFuzzStep(300)).toBe(320);
    expect(formatFuzzPrivacyNote(800)).toBe('Your pin is moved 200 to 800 m');
  });

  it('shows the exact min and max at every step (no rounding)', () => {
    expect(formatFuzzPrivacyNote(250)).toBe('Your pin is moved 63 to 250 m');
    expect(formatFuzzPrivacyNote(500)).toBe('Your pin is moved 125 to 500 m');
    expect(formatFuzzPrivacyNote(650)).toBe('Your pin is moved 163 to 650 m');
    for (const step of MAP_PIN_FUZZ_STEPS_M) {
      const { min, max } = fuzzRangeMeters(step);
      expect(max).toBe(step);
      expect(formatFuzzPrivacyNote(step)).toBe(`Your pin is moved ${min} to ${max} m`);
    }
  });
});
