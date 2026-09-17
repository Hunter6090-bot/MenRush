import { describe, it, expect } from 'vitest';
import {
  mapToCruisingCategory,
  formatLastActiveTime,
  getDirectionsUrl,
  getMapboxStaticThumbnailUrl,
  isValidCoordinateSpot,
  CRUISING_CATEGORIES,
  CRUISING_CATEGORY_META,
} from './cruising';

describe('Cruising Search Phase 1 helpers', () => {
  it('includes sauna in CRUISING_CATEGORIES and metadata', () => {
    expect(CRUISING_CATEGORIES).toContain('sauna');
    expect(CRUISING_CATEGORY_META.sauna).toEqual({
      label: 'Sauna',
      icon: '🧖',
      description: 'Licensed saunas, bathhouses and wellness venues',
    });
  });

  describe('mapToCruisingCategory', () => {
    it('maps licensed saunas, bathhouses, and wellness venues to "sauna"', () => {
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
          name: 'The Locker Room',
          category_slug: 'sauna',
          venue_type: 'sauna',
        }),
      ).toBe('sauna');

      expect(
        mapToCruisingCategory({
          name: 'Steam Complex',
          description: 'Digbeth wellness club',
          category_slug: 'saunas',
        }),
      ).toBe('sauna');

      expect(
        mapToCruisingCategory({
          name: 'Covent Garden Health Spa',
          venue_type: 'sauna',
          category_slug: 'saunas',
        }),
      ).toBe('sauna');

      // Priority over beach even if "Brighton" is in the name
      expect(
        mapToCruisingCategory({
          name: 'Brighton Sauna',
          description: 'Seafront-area sauna',
          category_slug: 'saunas',
        }),
      ).toBe('sauna');

      // Priority over park even if "Park" is in the name
      expect(
        mapToCruisingCategory({
          name: 'Preston Park Sauna',
          description: 'Wellness venue',
          category_slug: 'saunas',
        }),
      ).toBe('sauna');

      // Commercial sauna row with category_slug 'saunas'
      expect(
        mapToCruisingCategory({
          name: 'BASE Sauna',
          category_slug: 'saunas',
          is_commercial: true,
        }),
      ).toBe('sauna');

      // Category name "Saunas & spas"
      expect(
        mapToCruisingCategory({
          name: 'Eden Health',
          category_name: 'Saunas & spas',
        }),
      ).toBe('sauna');
    });
    it('maps woodland and forest spots to "woods"', () => {
      expect(
        mapToCruisingCategory({
          name: 'Wisley (Ockham Common)',
          description: 'Woodland',
          category_slug: 'parks-trails',
        }),
      ).toBe('woods');

      expect(
        mapToCruisingCategory({
          name: 'Botley Woods',
          description: 'Woodland',
          category_slug: 'parks-trails',
        }),
      ).toBe('woods');

      expect(
        mapToCruisingCategory({
          name: 'Parkhurst Forest',
          description: 'Woodland',
          category_slug: 'parks-trails',
        }),
      ).toBe('woods');

      expect(
        mapToCruisingCategory({
          name: 'Firestone copse',
          description: 'Woodland',
          category_slug: 'parks-trails',
        }),
      ).toBe('woods');
    });

    it('maps parking and laybys to "layby"', () => {
      expect(
        mapToCruisingCategory({
          name: 'A31 Hog’s Back Rest Lay-by',
          description: 'Car park',
          category_slug: 'parking',
        }),
      ).toBe('layby');

      expect(
        mapToCruisingCategory({
          name: 'Billys lake car park',
          description: 'Car park',
          category_slug: 'parking',
        }),
      ).toBe('layby');

      expect(
        mapToCruisingCategory({
          name: 'Milkham Car Park',
          description: 'Car park',
          category_slug: 'parking',
        }),
      ).toBe('layby');
    });

    it('maps beach and coastal spots to "beach"', () => {
      expect(
        mapToCruisingCategory({
          name: 'Eastney Beach Huts',
          description: 'Public park',
          category_slug: 'open-spaces',
        }),
      ).toBe('beach');

      expect(
        mapToCruisingCategory({
          name: 'Climping Beach Dunes',
          description: 'Public park',
          category_slug: 'open-spaces',
        }),
      ).toBe('beach');
    });

    it('maps parks, commons, and open trails to "park"', () => {
      expect(
        mapToCruisingCategory({
          name: 'Southampton Common',
          description: 'Public park',
          category_slug: 'open-spaces',
        }),
      ).toBe('park');

      expect(
        mapToCruisingCategory({
          name: "St. Catherine's Hill",
          description: 'Public park',
          category_slug: 'open-spaces',
        }),
      ).toBe('park');

      expect(
        mapToCruisingCategory({
          name: 'Fort Widley',
          description: 'Public park',
          category_slug: 'open-spaces',
        }),
      ).toBe('park');
    });
  });

  describe('formatLastActiveTime', () => {
    it('returns honest placeholder "No recent check-ins" when no signals exist', () => {
      expect(formatLastActiveTime({})).toBe('No recent check-ins');
      expect(
        formatLastActiveTime({
          has_active_checkins: false,
          live_count_exact: 0,
          last_activity_at: null,
        }),
      ).toBe('No recent check-ins');
    });

    it('returns active status when live checkins exist', () => {
      expect(
        formatLastActiveTime({
          has_active_checkins: true,
          live_count_exact: 1,
        }),
      ).toBe('Active now');

      expect(
        formatLastActiveTime({
          has_active_checkins: true,
          live_count_exact: 3,
        }),
      ).toBe('3 checked in now');
    });

    it('returns relative active time if recent activity occurred', () => {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(
        formatLastActiveTime({
          last_activity_at: tenMinsAgo,
        }),
      ).toBe('Active 10m ago');

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(
        formatLastActiveTime({
          last_activity_at: twoHoursAgo,
        }),
      ).toBe('Active 2h ago');
    });
  });

  describe('getDirectionsUrl', () => {
    it('returns valid directions URL with lat/lng', () => {
      const url = getDirectionsUrl(51.2260632, -0.6727582, 'A31 Hog’s Back Rest Lay-by');
      expect(url).toContain('51.2260632');
      expect(url).toContain('-0.6727582');
      expect(url.startsWith('https://')).toBe(true);
    });
  });

  describe('getMapboxStaticThumbnailUrl', () => {
    it('returns null when token is missing or placeholder', () => {
      expect(getMapboxStaticThumbnailUrl(51.2, -0.6, undefined)).toBeNull();
      expect(getMapboxStaticThumbnailUrl(51.2, -0.6, '__SET_ME__')).toBeNull();
    });

    it('returns a static map URL when valid token provided', () => {
      const url = getMapboxStaticThumbnailUrl(51.22603, -0.67367, 'pk.test-token');
      expect(url).toContain('api.mapbox.com');
      expect(url).toContain('access_token=pk.test-token');
      expect(url).toContain('-0.67367,51.22603');
    });
  });

  describe('isValidCoordinateSpot', () => {
    it('accepts spots with real finite coordinates', () => {
      expect(isValidCoordinateSpot({ latitude: 51.22603, longitude: -0.67367 })).toBe(true);
      expect(isValidCoordinateSpot({ latitude: 51.31836, longitude: -0.47316 })).toBe(true);
    });

    it('rejects spots with null, zero, NaN or out-of-range coordinates', () => {
      expect(isValidCoordinateSpot({ latitude: null as any, longitude: null as any })).toBe(false);
      expect(isValidCoordinateSpot({ latitude: 0, longitude: 0 })).toBe(false);
      expect(isValidCoordinateSpot({ latitude: NaN, longitude: -0.5 })).toBe(false);
      expect(isValidCoordinateSpot({ latitude: 95, longitude: 0 })).toBe(false);
    });
  });
});
