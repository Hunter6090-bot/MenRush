import { describe, it, expect } from 'vitest';
import { activeHotSpotCountLabel, adjustHotSpotLiveCount, hotSpotCountLabel, isHotSpotActive } from './hotSpotCounts';

describe('hotSpotCounts', () => {
  it('active count label: shows any positive count, including 1; empty only with no count', () => {
    expect(activeHotSpotCountLabel({ has_active_checkins: true, live_count: 1, live_count_exact: null })).toBe('1');
    expect(activeHotSpotCountLabel({ has_active_checkins: true, live_count: '5+', live_count_exact: null })).toBe('5+');
    expect(activeHotSpotCountLabel({ has_active_checkins: true, live_count: 7, live_count_exact: 7 })).toBe('7');
    expect(activeHotSpotCountLabel({ has_active_checkins: true, live_count: null, live_count_exact: 3 })).toBe('');
    expect(activeHotSpotCountLabel({ has_active_checkins: true, live_count: 0 })).toBe('');
    expect(activeHotSpotCountLabel({ has_active_checkins: false, live_count: 0 })).toBe('');
  });

  it('labels use the server display count only, never live_count_exact', () => {
    expect(hotSpotCountLabel({ live_count: '5+', live_count_exact: null })).toBe('5+');
    expect(hotSpotCountLabel({ live_count: 3, live_count_exact: null })).toBe('3');
    expect(hotSpotCountLabel({ live_count: 12, live_count_exact: 12 })).toBe('12');
    // No display count: no digits at all, even if an exact number is present.
    expect(hotSpotCountLabel({ live_count_exact: 7 })).toBe('');
    expect(hotSpotCountLabel({ live_count: 'n/a', live_count_exact: 0 })).toBe('');
  });

  it('active state works without the exact number (Free)', () => {
    expect(isHotSpotActive({ has_active_checkins: true, live_count_exact: null, live_count: '5+' })).toBe(true);
    expect(isHotSpotActive({ has_active_checkins: false, live_count_exact: null, live_count: 0 })).toBe(false);
    expect(isHotSpotActive({ live_count_exact: null, live_count: '5+' })).toBe(true);
    expect(isHotSpotActive({ live_count_exact: null, live_count: 2 })).toBe(true);
    expect(isHotSpotActive({ live_count_exact: 4 })).toBe(true);
    expect(isHotSpotActive({})).toBe(false);
  });

  it('optimistic check-in keeps Free rounded at 5+ and never invents an exact count', () => {
    expect(adjustHotSpotLiveCount({ live_count: 4, live_count_exact: null }, 1)).toEqual({
      live_count: '5+',
      live_count_exact: null,
      has_active_checkins: true,
    });
    expect(adjustHotSpotLiveCount({ live_count: '5+', live_count_exact: null }, 1).live_count).toBe('5+');
    expect(adjustHotSpotLiveCount({ live_count: '5+', live_count_exact: null }, -1).live_count).toBe('5+');
    expect(adjustHotSpotLiveCount({ live_count: 1, live_count_exact: null }, -1)).toEqual({
      live_count: 0,
      live_count_exact: null,
      has_active_checkins: false,
    });
  });

  it('optimistic check-in stays exact for Premium', () => {
    expect(adjustHotSpotLiveCount({ live_count: 6, live_count_exact: 6 }, 1)).toEqual({
      live_count: 7,
      live_count_exact: 7,
      has_active_checkins: true,
    });
    expect(adjustHotSpotLiveCount({ live_count: 1, live_count_exact: 1 }, -1)).toEqual({
      live_count: 0,
      live_count_exact: 0,
      has_active_checkins: false,
    });
  });
});
