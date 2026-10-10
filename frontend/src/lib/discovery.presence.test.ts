import { describe, it, expect } from 'vitest';
import { countLiveOnline, isUserOnlineNow, isUserPulsing } from './discovery';

describe('Live presence honesty', () => {
  it('treats online flag as Live — not radius or filter membership', () => {
    expect(isUserOnlineNow({ online: true })).toBe(true);
    expect(isUserOnlineNow({ online: false })).toBe(false);
    expect(isUserOnlineNow({})).toBe(false);
    expect(isUserOnlineNow({ online: null })).toBe(false);
  });

  it('keeps last_seen within 1 hour live after they leave', () => {
    expect(
      isUserOnlineNow({
        online: false,
        last_seen: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      }),
    ).toBe(true);
    expect(
      isUserOnlineNow({
        online: false,
        last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      }),
    ).toBe(false);
  });

  it('counts only online-now users among a nearby roster', () => {
    expect(
      countLiveOnline([
        { online: true },
        { online: false },
        { online: true },
        { online: undefined },
        {},
      ]),
    ).toBe(2);
  });

  it('does not treat Pulse alone as Live online presence', () => {
    const pulsingOffline = {
      online: false,
      is_pulsing: true,
      pulse_expires_at: new Date(Date.now() + 60_000).toISOString(),
    };
    expect(isUserPulsing(pulsingOffline)).toBe(true);
    expect(isUserOnlineNow(pulsingOffline)).toBe(false);
    expect(countLiveOnline([pulsingOffline])).toBe(0);
  });
});
