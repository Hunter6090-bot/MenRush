import { describe, expect, it } from 'vitest';
import { mapboxStyleForTheme } from './mapTheme';

describe('mapTheme', () => {
  it('returns valid mapbox style URLs for dark and light themes', () => {
    expect(mapboxStyleForTheme('dark')).toBe('mapbox://styles/mapbox/dark-v11');
    expect(mapboxStyleForTheme('light')).toBe('mapbox://styles/mapbox/light-v11');
  });
});
