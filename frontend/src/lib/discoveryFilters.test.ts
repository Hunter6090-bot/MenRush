import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_FILTER_CATEGORIES,
  DEFAULT_DISCOVERY_FILTERS,
  MORE_FILTER_CATEGORY_IDS,
  PRIMARY_DISCOVERY_FILTER_CATEGORIES,
  applyDiscoveryClientFilters,
  buildInterestTags,
  buildNearbyApiFilters,
  countActiveDiscoveryFilters,
  countMoreFilterSelections,
  getMoreFilterCategories,
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
