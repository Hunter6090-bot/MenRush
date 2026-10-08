import { describe, expect, it } from 'vitest';
import { getDistanceLabel, memberDistanceLabel, metaAfterDistance } from './discovery';

describe('member distance label (coarse, fuzzed, server-owned)', () => {
  it('shows the server label as-is, never re-deriving precision from km', () => {
    expect(getDistanceLabel({ distance_km: '0.80', distance_label: '<1 mi' })).toBe('<1 mi');
    expect(getDistanceLabel({ distance_km: '4.83', distance_label: '3 mi' })).toBe('3 mi');
  });

  it('reads Nearby when distance is hidden (keys absent) or empty', () => {
    expect(getDistanceLabel({})).toBe('Nearby');
    expect(getDistanceLabel({ distance_km: null, distance_label: null })).toBe('Nearby');
    expect(getDistanceLabel({ distance_km: '', distance_label: '  ' })).toBe('Nearby');
    expect(memberDistanceLabel({})).toBeNull();
  });

  it('keeps the legacy km fallback when no label is sent', () => {
    expect(getDistanceLabel({ distance_km: 1.93 })).toBe('1.2 mi');
  });
});

describe('metaAfterDistance', () => {
  it('drops a second Nearby so a card never reads "Nearby · Nearby"', () => {
    expect(metaAfterDistance('Nearby', ['Nearby', 'Active now'])).toBe('Active now');
    expect(metaAfterDistance('nearby', ['Nearby', 'Nearby'])).toBe('');
  });

  it('keeps tribe and status after a real distance', () => {
    expect(metaAfterDistance('3 mi', ['Bear', 'Active now'])).toBe('Bear · Active now');
    expect(metaAfterDistance('3 mi', ['', null, 'Recently'])).toBe('Recently');
  });
});
