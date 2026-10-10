import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spotAfterCheckToggle } from './hotSpotCounts';

// #368: a Ghost or hidden member is never in the live count, so their check-out must
// not lower it. Steamer Quay showed 1 instead of the real 2 on the Ghost's own sheet.
describe('Ghost check-out keeps the live count', () => {
  const steamerQuay = {
    id: 'steamer-quay',
    is_checked_in: true,
    live_count: 2,
    live_count_exact: 2,
    has_active_checkins: true,
  };

  it('uses the server count after a Ghost check-out (unchanged at 2)', () => {
    const server = { ...steamerQuay, is_checked_in: false };
    const next = spotAfterCheckToggle(steamerQuay, server, false);
    expect(next.is_checked_in).toBe(false);
    expect(next.live_count).toBe(2);
    expect(next.live_count_exact).toBe(2);
  });

  it('with no server spot, only flips the check-in and leaves the count alone', () => {
    const next = spotAfterCheckToggle(steamerQuay, null, false);
    expect(next.is_checked_in).toBe(false);
    expect(next.live_count).toBe(2);
    expect(next.live_count_exact).toBe(2);
    expect(next.has_active_checkins).toBe(true);
  });

  it('a Ghost check-in with no server spot does not add 1', () => {
    const before = { ...steamerQuay, is_checked_in: false };
    const next = spotAfterCheckToggle(before, undefined, true, { my_checkin_anonymous: false } as never);
    expect(next.is_checked_in).toBe(true);
    expect(next.live_count).toBe(2);
  });

  it('the map sheet does not guess counts with an optimistic +1 / -1', () => {
    const src = readFileSync(resolve(__dirname, '../pages/Discover.tsx'), 'utf8');
    expect(src).not.toMatch(/adjustHotSpotLiveCount/);
    expect(src).toMatch(/spotAfterCheckToggle\(spot, res\.data\?\.spot, false\)/);
  });
});
