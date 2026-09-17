import { test, expect } from '@playwright/test';
import {
  mapToCruisingCategory,
  formatLastActiveTime,
  getDirectionsUrl,
  isValidCoordinateSpot,
} from '../src/lib/cruising';

test.describe('Cruising Search Phase 1', () => {
  test('category mapping covers outdoor types correctly', () => {
    expect(
      mapToCruisingCategory({
        name: 'Ockham Common',
        description: 'Woodland',
        category_slug: 'parks-trails',
      }),
    ).toBe('woods');

    expect(
      mapToCruisingCategory({
        name: 'A31 Hog’s Back Rest Lay-by',
        description: 'Car park',
        category_slug: 'parking',
      }),
    ).toBe('layby');

    expect(
      mapToCruisingCategory({
        name: 'Eastney Beach Huts',
        description: 'Public park',
        category_slug: 'open-spaces',
      }),
    ).toBe('beach');

    expect(
      mapToCruisingCategory({
        name: 'Southampton Common',
        description: 'Public park',
        category_slug: 'open-spaces',
      }),
    ).toBe('park');

    expect(
      mapToCruisingCategory({
        name: 'Sweatbox Sauna',
        description: 'Central London sauna & wellness',
        category_slug: 'saunas',
      }),
    ).toBe('sauna');

    expect(
      mapToCruisingCategory({
        name: 'Pleasuredrome',
        description: 'South London bathhouse',
        category_slug: 'saunas',
        venue_type: 'bathhouse',
      }),
    ).toBe('sauna');

    expect(
      mapToCruisingCategory({
        name: 'Tropics Day Spa',
        city: 'Portsmouth',
        category_slug: 'saunas',
        venue_type: 'sauna',
      }),
    ).toBe('sauna');
  });

  test('formatLastActiveTime shows honest placeholder when no checkins', () => {
    expect(
      formatLastActiveTime({
        has_active_checkins: false,
        live_count_exact: 0,
      }),
    ).toBe('No recent check-ins');
  });

  test('getDirectionsUrl generates valid coordinates link', () => {
    const hogsUrl = getDirectionsUrl(51.2260632, -0.6727582, 'A31 Hog’s Back Rest Lay-by');
    expect(hogsUrl).toContain('51.2260632');
    expect(hogsUrl).toContain('-0.6727582');

    const wisleyUrl = getDirectionsUrl(51.3171538, -0.453855, 'Wisley (Ockham Common)');
    expect(wisleyUrl).toContain('51.3171538');
    expect(wisleyUrl).toContain('-0.453855');
  });

  test('isValidCoordinateSpot rejects spots with missing or invalid coordinates', () => {
    expect(isValidCoordinateSpot({ latitude: 51.2260632, longitude: -0.6727582 })).toBe(true);
    expect(isValidCoordinateSpot({ latitude: 51.3171538, longitude: -0.453855 })).toBe(true);
    expect(isValidCoordinateSpot({ latitude: 0, longitude: 0 })).toBe(false);
    expect(isValidCoordinateSpot({ latitude: null as any, longitude: -0.5 })).toBe(false);
  });
});
