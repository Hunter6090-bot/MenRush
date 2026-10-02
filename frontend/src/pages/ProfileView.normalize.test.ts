import { describe, expect, it } from 'vitest';
import { normalizeInterests, normalizeProfilePayload } from './ProfileView';

describe('normalizeInterests (profile crash guard)', () => {
  it('returns empty for null/undefined/non-array (prevents .map crash)', () => {
    expect(normalizeInterests(null)).toEqual([]);
    expect(normalizeInterests(undefined)).toEqual([]);
    expect(normalizeInterests({})).toEqual([]);
    expect(normalizeInterests('Dating')).toEqual([]);
  });

  it('keeps string tags only', () => {
    expect(normalizeInterests(['Bear', 12, null, 'Gym', ''])).toEqual(['Bear', 'Gym']);
  });
});

describe('normalizeProfilePayload', () => {
  it('preserves distance_km and distance_label from backend', () => {
    const raw = {
      id: 'user-123',
      name: 'Dave',
      age: 32,
      distance_km: '1.40',
      distance_label: '1.4 km',
    };
    const normalized = normalizeProfilePayload(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.distance_km).toBe('1.40');
    expect(normalized?.distance_label).toBe('1.4 km');
  });

  it('handles profiles without location or distance', () => {
    const raw = {
      id: 'user-456',
      name: 'Sam',
    };
    const normalized = normalizeProfilePayload(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.distance_km).toBeUndefined();
    expect(normalized?.distance_label).toBeUndefined();
  });
});
