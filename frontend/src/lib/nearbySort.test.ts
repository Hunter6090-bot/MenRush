import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import type { NearbyUser } from '../components/ProfileCard';
import {
  DEFAULT_NEARBY_SORT,
  NEARBY_SORT_LABELS,
  NEARBY_SORT_STORAGE_KEY,
  isNearbySortMode,
  readNearbySort,
  sortNearbyUsers,
  writeNearbySort,
} from './nearbySort';

function user(partial: Partial<NearbyUser> & Pick<NearbyUser, 'id' | 'name'>): NearbyUser {
  return {
    age: 28,
    online: true,
    distance_km: 1,
    interests: [],
    ...partial,
  };
}

describe('nearby sort modes', () => {
  it('defaults to Nearest and uses Brand-safe short labels', () => {
    expect(DEFAULT_NEARBY_SORT).toBe('nearest');
    expect(NEARBY_SORT_LABELS.nearest).toBe('Nearest');
    expect(NEARBY_SORT_LABELS.latest).toBe('Latest');
    expect(Object.values(NEARBY_SORT_LABELS).join(' ')).not.toMatch(/Date|Dating|Friends|Romantic/i);
    expect(isNearbySortMode('nearest')).toBe(true);
    expect(isNearbySortMode('latest')).toBe(true);
    expect(isNearbySortMode('distance')).toBe(false);
  });

  it('Nearest sorts by ascending distance only', () => {
    const now = Date.now();
    const people = [
      user({
        id: 'far-new',
        name: 'FarNew',
        distance_km: 4,
        created_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      user({
        id: 'near-vet',
        name: 'NearVet',
        distance_km: 0.4,
        created_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      user({
        id: 'mid',
        name: 'Mid',
        distance_km: 1.2,
        created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    expect(sortNearbyUsers(people, 'nearest').map((u) => u.id)).toEqual([
      'near-vet',
      'mid',
      'far-new',
    ]);
  });

  it('Latest surfaces fresh faces before veterans, joiners before visitors', () => {
    const now = Date.now();
    const people = [
      user({
        id: 'vet-close',
        name: 'Vet',
        distance_km: 0.2,
        created_at: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      user({
        id: 'visitor',
        name: 'Visitor',
        distance_km: 2,
        created_at: new Date(now - 50 * 24 * 60 * 60 * 1000).toISOString(),
        is_visitor: true,
        visitor_expires_at: new Date(now + 36 * 60 * 60 * 1000).toISOString(),
      }),
      user({
        id: 'joiner-older',
        name: 'JoinerOld',
        distance_km: 3,
        created_at: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      user({
        id: 'joiner-newer',
        name: 'JoinerNew',
        distance_km: 3.5,
        created_at: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    expect(sortNearbyUsers(people, 'latest').map((u) => u.id)).toEqual([
      'joiner-newer',
      'joiner-older',
      'visitor',
      'vet-close',
    ]);
  });

  it('Latest among non-fresh ranks by created_at then distance', () => {
    const now = Date.now();
    const people = [
      user({
        id: 'older-near',
        name: 'A',
        distance_km: 0.5,
        created_at: new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString(),
      }),
      user({
        id: 'newer-far',
        name: 'B',
        distance_km: 3,
        created_at: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    expect(sortNearbyUsers(people, 'latest').map((u) => u.id)).toEqual([
      'newer-far',
      'older-near',
    ]);
  });
});

describe('nearby sort persistence', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads default Nearest and persists Latest for the session', () => {
    expect(readNearbySort()).toBe('nearest');
    writeNearbySort('latest');
    expect(store.get(NEARBY_SORT_STORAGE_KEY)).toBe('latest');
    expect(readNearbySort()).toBe('latest');
    writeNearbySort('nearest');
    expect(readNearbySort()).toBe('nearest');
  });
});
