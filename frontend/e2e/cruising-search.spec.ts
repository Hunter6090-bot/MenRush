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
        name: "Hog's Back A31 Layby",
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
    const hogsUrl = getDirectionsUrl(51.22603, -0.67367, "Hog's Back A31 Layby");
    expect(hogsUrl).toContain('51.22603');
    expect(hogsUrl).toContain('-0.67367');

    const wisleyUrl = getDirectionsUrl(51.31800, -0.45800, 'Ockham Common');
    expect(wisleyUrl).toContain('51.318');
    expect(wisleyUrl).toContain('-0.458');
  });

  test('isValidCoordinateSpot rejects spots with missing or invalid coordinates', () => {
    expect(isValidCoordinateSpot({ latitude: 51.22603, longitude: -0.67367 })).toBe(true);
    expect(isValidCoordinateSpot({ latitude: 51.31836, longitude: -0.47316 })).toBe(true);
    expect(isValidCoordinateSpot({ latitude: 0, longitude: 0 })).toBe(false);
    expect(isValidCoordinateSpot({ latitude: null as any, longitude: -0.5 })).toBe(false);
  });
});
