import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_FILTER_CATEGORIES,
  DEFAULT_DISCOVERY_FILTERS,
  applyDiscoveryClientFilters,
  countActiveDiscoveryFilters,
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
  it('exposes vibe, scene and connection without a new top-level category set', () => {
    const ids = DISCOVERY_FILTER_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('vibe');
    expect(ids).toContain('scene');
    expect(ids).toContain('connection');
    expect(ids).toContain('looking_for');
  });

  it('composes extra tags with looking-for and status filters', () => {
    const people = [
      user({ id: '1', name: 'A', interests: ['Kinky', 'Gym'], looking_for: 'Chat', online: true }),
      user({ id: '2', name: 'B', interests: ['Vanilla'], looking_for: 'Date', online: false }),
    ];
    const state = {
      ...DEFAULT_DISCOVERY_FILTERS,
      intent: 'Chat',
      interests: ['Kinky', 'Gym'],
      status: ['online' as const],
    };
    expect(countActiveDiscoveryFilters(state)).toBe(4);
    const result = applyDiscoveryClientFilters(people, state);
    expect(result.map((u) => u.id)).toEqual(['1']);
  });
});
