import { describe, expect, it } from 'vitest';
import { normalizeInterests } from './ProfileView';

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
