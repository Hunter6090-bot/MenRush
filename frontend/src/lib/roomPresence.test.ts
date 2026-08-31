import { describe, expect, it } from 'vitest';
import {
  dropRoomParticipant,
  liveOccupancy,
  liveRoomParticipants,
  mergePresenceJoin,
  replacePresenceRoster,
  ROOM_DROP_TIMEOUT_MS,
} from './roomPresence';

describe('roomPresence', () => {
  it('counts only live tiles for occupancy', () => {
    const list = [
      { user_id: 'a', name: 'Bear', isLive: true },
      { user_id: 'b', name: 'Ghost', isLive: false },
      { user_id: 'c', name: 'Cub' },
    ];
    expect(liveOccupancy(list)).toBe(2);
    expect(liveRoomParticipants(list).map((p) => p.user_id)).toEqual(['a', 'c']);
  });

  it('drops a leaver from the roster and occupancy instantly', () => {
    const list = [
      { user_id: 'a', name: 'Bear', isLive: true },
      { user_id: 'b', name: 'Cub', isLive: true },
    ];
    const next = dropRoomParticipant(list, 'b');
    expect(next.map((p) => p.user_id)).toEqual(['a']);
    expect(liveOccupancy(next)).toBe(1);
  });

  it('presence-sync replaces the roster and does not keep ghosts', () => {
    const prev = [
      { user_id: 'a', name: 'Bear', isLive: true },
      { user_id: 'ghost', name: 'Gone', isLive: true },
    ];
    const incoming = [{ user_id: 'a', name: 'Bear', photo_url: '/uploads/room-temp/a.jpg' }];
    const next = replacePresenceRoster(incoming, prev.find((p) => p.user_id === 'self'));
    expect(next.map((p) => p.user_id)).toEqual(['a']);
    expect(next[0].photo_url).toBe('/uploads/room-temp/a.jpg');
    expect(liveOccupancy(next)).toBe(1);
  });

  it('keeps the local self tile if the sync snapshot omits it', () => {
    const self = { user_id: 'me', name: 'Temp Me', isSelf: true, isLive: true };
    const next = replacePresenceRoster([{ user_id: 'a', name: 'Bear' }], self);
    expect(next.map((p) => p.user_id).sort()).toEqual(['a', 'me']);
  });

  it('join upserts without leaking a second tile', () => {
    const list = [{ user_id: 'a', name: 'Old', isLive: true }];
    const next = mergePresenceJoin(list, {
      user_id: 'a',
      name: 'Room Name',
      photo_url: '/uploads/room-temp/a.jpg',
    });
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('Room Name');
    expect(next[0].photo_url).toBe('/uploads/room-temp/a.jpg');
  });

  it('drop timeout is a few seconds, not instant and not a long linger', () => {
    expect(ROOM_DROP_TIMEOUT_MS).toBeGreaterThanOrEqual(2000);
    expect(ROOM_DROP_TIMEOUT_MS).toBeLessThanOrEqual(8000);
  });
});
