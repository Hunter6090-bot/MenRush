import { describe, expect, it } from 'vitest';
import {
  AGE_PRESETS,
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
  getAgeRange,
  getMoreFilterCategories,
  hasCustomAge,
  resolveAgeRange,
  withAgePreset,
  withCustomAge,
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

function tagsFor(id: string): readonly string[] {
  const category = DISCOVERY_FILTER_CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`missing category ${id}`);
  return category.tags;
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

  it('ships hookup-coded looking_for / vibe / scene / connection lists', () => {
    expect(tagsFor('looking_for')).toEqual([
      'All',
      'NSA',
      'Hookup',
      'Casual',
      'FWB',
      'Discreet',
      'Hosting',
      'Can Travel',
      'Right Now',
      'Oral',
      'Anal',
      'Rim',
      'JO',
      'Threesome',
    ]);
    expect(tagsFor('vibe')).toEqual([
      'Kinky',
      'Vanilla',
      'Horny',
      'Filthy',
      'Rough',
      'Oral',
      'Anal',
      'Rim',
      'JO',
      'Dominant',
      'Submissive',
      'Sober',
      'PnP-Free',
    ]);
    expect(tagsFor('scene')).toEqual([
      'Sauna',
      'Cruising',
      'Darkroom',
      'Glory hole',
      'Hotel',
      'Private',
      'Club',
      'After hours',
      'Car',
      'Toilets',
      'House Party',
      'Gym',
      'Bar',
    ]);
    expect(tagsFor('connection')).toEqual([
      'Group',
      'Couples',
      'Poly',
      'Threesome',
      'Gangbang',
      'Cam',
      'Overnight',
      'Host',
      'Travel',
      'Now',
      'Short-term',
    ]);
    for (const datingCoded of [
      'Chat',
      'Drinks',
      'Date',
      'Dating',
      'Romantic',
      'Chill',
      'Coffee',
      'Cinema',
      'Festival',
      'Beach',
      'Friends',
      'Networking',
      'Dates',
      'Activity',
      'Long-term',
    ]) {
      expect(JSON.stringify(DISCOVERY_FILTER_CATEGORIES)).not.toContain(`"${datingCoded}"`);
    }
  });

  it('appends body and tribe type tags without sexual-health coding', () => {
    expect(tagsFor('body')).toEqual([
      'Slim',
      'Athletic',
      'Muscular',
      'Stocky',
      'Chubby',
      'Hairy',
      'Smooth',
      'Tatted',
      'Average',
      'Toned',
      'Large',
      'Dad bod',
    ]);
    expect(tagsFor('tribe')).toEqual([
      'Twink',
      'Twunk',
      'Otter',
      'Bear',
      'Cub',
      'Daddy',
      'Wolf',
      'Jock',
      'Leather',
      'Rugged',
      'Geek',
      'Pup',
      'Chub',
      'Muscle',
    ]);
  });

  it('composes vibe/scene/connection with looking-for, mood and status', () => {
    const people = [
      user({
        id: '1',
        name: 'A',
        interests: ['Kinky', 'Gym', 'Group'],
        looking_for: 'Hookup',
        online: true,
        mood: 'down_to_chat',
      }),
      user({
        id: '2',
        name: 'B',
        interests: ['Vanilla', 'Bar'],
        looking_for: 'Casual',
        online: false,
        mood: 'at_a_bar',
      }),
      user({
        id: '3',
        name: 'C',
        interests: ['Kinky', 'Gym'],
        looking_for: 'Hookup',
        online: true,
        mood: 'down_to_chat',
      }),
    ];
    const state = {
      ...DEFAULT_DISCOVERY_FILTERS,
      intent: 'Hookup',
      interests: ['Kinky', 'Gym', 'Group'],
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
      intent: 'Hookup',
      interests: ['Kinky', 'Sauna', 'Poly'],
    };
    expect(buildInterestTags(state)).toEqual(['Kinky', 'Sauna', 'Poly', 'Hookup']);
    expect(buildNearbyApiFilters(state)).toMatchObject({
      interests: ['Kinky', 'Sauna', 'Poly', 'Hookup'],
      lookingFor: undefined,
    });
  });

  it('keeps NSA on the lookingFor API path', () => {
    const state = { ...DEFAULT_DISCOVERY_FILTERS, intent: 'NSA' };
    expect(buildNearbyApiFilters(state)).toMatchObject({ lookingFor: 'nsa' });
  });
});

describe('discovery age presets and custom range', () => {
  it('adds 60+ and narrows 50+ to 50–59', () => {
    expect(AGE_PRESETS.map((p) => p.id)).toEqual([
      'any',
      '18-21',
      '22-29',
      '30-39',
      '40-49',
      '50+',
      '60+',
    ]);
    expect(getAgeRange('50+')).toEqual({ minAge: 50, maxAge: 59 });
    expect(getAgeRange('60+')).toEqual({ minAge: 60, maxAge: 99 });
  });

  it('clamps custom ages and clears presets when custom is set', () => {
    const withCustom = withCustomAge(DEFAULT_DISCOVERY_FILTERS, 17, 120);
    expect(withCustom.agePreset).toBe('any');
    expect(withCustom.customAgeMin).toBe(18);
    expect(withCustom.customAgeMax).toBe(99);
    expect(hasCustomAge(withCustom)).toBe(true);
    expect(clampAge(12)).toBe(18);
    expect(clampAge(140)).toBe(99);

    const withPreset = withAgePreset(withCustom, '30-39');
    expect(withPreset.agePreset).toBe('30-39');
    expect(withPreset.customAgeMin).toBeUndefined();
    expect(withPreset.customAgeMax).toBeUndefined();
    expect(resolveAgeRange(withPreset)).toEqual({ minAge: 30, maxAge: 39 });
  });

  it('wires custom min/max through nearby API filters and client age filter', () => {
    const state = withCustomAge(DEFAULT_DISCOVERY_FILTERS, 45, 55);
    expect(buildNearbyApiFilters(state)).toMatchObject({ minAge: 45, maxAge: 55 });
    const people = [
      user({ id: 'young', name: 'Y', age: 30 }),
      user({ id: 'mid', name: 'M', age: 50 }),
      user({ id: 'older', name: 'O', age: 70 }),
    ];
    expect(applyDiscoveryClientFilters(people, state).map((u) => u.id)).toEqual(['mid']);
    expect(countActiveDiscoveryFilters(state)).toBe(1);
  });
});
