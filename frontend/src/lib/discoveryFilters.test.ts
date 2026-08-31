import { describe, expect, it } from 'vitest';
import {
  AGE_CLAMP_MAX,
  AGE_CLAMP_MIN,
  AGE_SELECT_OPTIONS,
  DISCOVERY_FILTER_CATEGORIES,
  DEFAULT_DISCOVERY_FILTERS,
  MORE_FILTER_CATEGORY_IDS,
  PRIMARY_DISCOVERY_FILTER_CATEGORIES,
  applyDiscoveryClientFilters,
  buildInterestTags,
  buildNearbyApiFilters,
  clampAge,
  countActiveDiscoveryFilters,
  countMoreFilterSelections,
  getMoreFilterCategories,
  hasActiveAgeFilter,
  resolveAgeRange,
  withAgeFrom,
  withAgeRange,
  withAgeTo,
} from './discoveryFilters';
import type { NearbyUser } from '../components/ProfileCard';

function user(partial: Partial<NearbyUser> & Pick<NearbyUser, 'id' | 'name'>): NearbyUser {
  return {
    age: 28,
    online: true,
    distance_km: 1,
    interests: [],
    ...partial,
  };
}

describe('discovery more filters', () => {
  it('exposes vibe, scene and connection without adding a nav surface', () => {
    const ids = DISCOVERY_FILTER_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([...MORE_FILTER_CATEGORY_IDS, 'looking_for']));
    expect(getMoreFilterCategories().map((c) => c.id)).toEqual([...MORE_FILTER_CATEGORY_IDS]);
    expect(PRIMARY_DISCOVERY_FILTER_CATEGORIES.map((c) => c.id)).not.toEqual(
      expect.arrayContaining([...MORE_FILTER_CATEGORY_IDS]),
    );
  });

  it('composes vibe/scene/connection with looking-for, mood and status', () => {
    const people = [
      user({
        id: '1',
        name: 'A',
        interests: ['Kinky', 'Gym', 'Friends'],
        looking_for: 'Chat',
        online: true,
        mood: 'down_to_chat',
      }),
      user({
        id: '2',
        name: 'B',
        interests: ['Vanilla', 'Bar'],
        looking_for: 'Date',
        online: false,
        mood: 'at_a_bar',
      }),
      user({
        id: '3',
        name: 'C',
        interests: ['Kinky', 'Gym'],
        looking_for: 'Chat',
        online: true,
        mood: 'down_to_chat',
      }),
    ];
    const state = {
      ...DEFAULT_DISCOVERY_FILTERS,
      intent: 'Chat',
      interests: ['Kinky', 'Gym', 'Friends'],
      status: ['online' as const],
      mood: 'down_to_chat' as const,
    };
    expect(countMoreFilterSelections(state)).toBe(3);
    expect(countActiveDiscoveryFilters(state)).toBe(6);
    const result = applyDiscoveryClientFilters(people, state);
    expect(result.map((u) => u.id)).toEqual(['1']);
  });

  it('sends more-filter tags through the existing nearby interests query', () => {
    const state = {
      ...DEFAULT_DISCOVERY_FILTERS,
      intent: 'Chat',
      interests: ['Kinky', 'Sauna', 'Poly'],
    };
    expect(buildInterestTags(state)).toEqual(['Kinky', 'Sauna', 'Poly']);
    expect(buildNearbyApiFilters(state)).toMatchObject({
      interests: ['Kinky', 'Sauna', 'Poly'],
      lookingFor: 'chat',
    });
  });
});

describe('discovery age From–To range', () => {
  it('lists every integer 18 through 99 for native selects', () => {
    expect(AGE_CLAMP_MIN).toBe(18);
    expect(AGE_CLAMP_MAX).toBe(99);
    expect(AGE_SELECT_OPTIONS[0]).toBe(18);
    expect(AGE_SELECT_OPTIONS[AGE_SELECT_OPTIONS.length - 1]).toBe(99);
    expect(AGE_SELECT_OPTIONS).toHaveLength(82);
    expect(DEFAULT_DISCOVERY_FILTERS.ageFrom).toBe(18);
    expect(DEFAULT_DISCOVERY_FILTERS.ageTo).toBe(99);
    expect(hasActiveAgeFilter(DEFAULT_DISCOVERY_FILTERS)).toBe(false);
  });

  it('clamps values and snaps To up when From > To', () => {
    expect(clampAge(12)).toBe(18);
    expect(clampAge(140)).toBe(99);

    const snapped = withAgeFrom(DEFAULT_DISCOVERY_FILTERS, 45);
    expect(snapped.ageFrom).toBe(45);
    expect(snapped.ageTo).toBe(99);

    const inverted = withAgeFrom({ ...DEFAULT_DISCOVERY_FILTERS, ageTo: 30 }, 50);
    expect(inverted.ageFrom).toBe(50);
    expect(inverted.ageTo).toBe(50);

    const toLow = withAgeTo({ ...DEFAULT_DISCOVERY_FILTERS, ageFrom: 40 }, 25);
    expect(toLow.ageFrom).toBe(40);
    expect(toLow.ageTo).toBe(40);

    const range = withAgeRange(DEFAULT_DISCOVERY_FILTERS, 17, 120);
    expect(range.ageFrom).toBe(18);
    expect(range.ageTo).toBe(99);
    expect(resolveAgeRange(withAgeRange(DEFAULT_DISCOVERY_FILTERS, 55, 40))).toEqual({
      minAge: 55,
      maxAge: 55,
    });
  });

  it('wires From–To through nearby API filters and client age filter', () => {
    const state = withAgeRange(DEFAULT_DISCOVERY_FILTERS, 45, 55);
    expect(buildNearbyApiFilters(state)).toMatchObject({ minAge: 45, maxAge: 55 });
    expect(hasActiveAgeFilter(state)).toBe(true);
    expect(countActiveDiscoveryFilters(state)).toBe(1);
    const people = [
      user({ id: 'young', name: 'Y', age: 30 }),
      user({ id: 'mid', name: 'M', age: 50 }),
      user({ id: 'older', name: 'O', age: 70 }),
      user({ id: 'under', name: 'U', age: 17 }),
    ];
    expect(applyDiscoveryClientFilters(people, state).map((u) => u.id)).toEqual(['mid']);
  });

  it('never surfaces under-18 even with open 18–99 range', () => {
    const people = [
      user({ id: 'ok', name: 'Ok', age: 25 }),
      user({ id: 'teen', name: 'Teen', age: 17 }),
    ];
    expect(applyDiscoveryClientFilters(people, DEFAULT_DISCOVERY_FILTERS).map((u) => u.id)).toEqual([
      'ok',
    ]);
    expect(buildNearbyApiFilters(DEFAULT_DISCOVERY_FILTERS)).toMatchObject({
      minAge: 18,
      maxAge: 99,
    });
  });
});
