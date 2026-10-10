import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  __resetTabListCacheForTests,
  readCachedInbox,
  readCachedMatches,
  refreshInbox,
  refreshMatches,
  writeCachedInbox,
  writeCachedMatches,
  warmTabListCaches,
} from './tabListCache';

vi.mock('../api/client', () => ({
  messagesAPI: {
    getConversations: vi.fn(),
  },
  usersAPI: {
    getMatches: vi.fn(),
    getReceivedLikes: vi.fn(),
  },
}));

vi.mock('./conversationHistoryCache', () => ({
  rememberInboxThread: vi.fn(),
}));

import { messagesAPI, usersAPI } from '../api/client';
import { rememberInboxThread } from './conversationHistoryCache';

describe('tabListCache', () => {
  beforeEach(() => {
    __resetTabListCacheForTests();
    vi.mocked(messagesAPI.getConversations).mockReset();
    vi.mocked(usersAPI.getMatches).mockReset();
    vi.mocked(usersAPI.getReceivedLikes).mockReset();
    vi.mocked(rememberInboxThread).mockReset();
  });

  it('returns undefined until inbox is written', () => {
    expect(readCachedInbox()).toBeUndefined();
  });

  it('round-trips inbox including empty list', () => {
    writeCachedInbox([]);
    expect(readCachedInbox()).toEqual([]);
    writeCachedInbox([
      {
        other_user_id: 'u2',
        other_user_name: 'Pete',
        last_message_time: '2026-09-11T12:00:00Z',
        last_message: 'hey',
      },
    ]);
    expect(readCachedInbox()?.[0].other_user_name).toBe('Pete');
  });

  it('round-trips matches and likes', () => {
    writeCachedMatches(
      [{ id: 'm1', name: 'Alex', age: 30, online: true }],
      [{ id: 'l1', name: 'Sam', age: 28, online: false, liked_at: '2026-09-11T10:00:00Z' }],
    );
    const snap = readCachedMatches();
    expect(snap?.matches).toHaveLength(1);
    expect(snap?.likes[0].name).toBe('Sam');
  });

  it('preserves prior likes when writing matches-only', () => {
    writeCachedMatches([{ id: 'm1', name: 'Alex', age: 30 }], [{ id: 'l1', name: 'Sam', age: 28 }]);
    writeCachedMatches([{ id: 'm2', name: 'Ben', age: 32 }]);
    const snap = readCachedMatches();
    expect(snap?.matches[0].name).toBe('Ben');
    expect(snap?.likes[0].name).toBe('Sam');
  });

  it('refreshInbox writes cache and seeds thread previews', async () => {
    vi.mocked(messagesAPI.getConversations).mockResolvedValue({
      data: [
        {
          other_user_id: 'u2',
          other_user_name: 'Pete',
          last_message_time: '2026-09-11T12:00:00Z',
          last_message: 'yo',
        },
      ],
    } as never);

    const rows = await refreshInbox('me');
    expect(rows).toHaveLength(1);
    expect(readCachedInbox()?.[0].last_message).toBe('yo');
    expect(rememberInboxThread).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ lastMessage: 'yo', selfId: 'me' }),
    );
  });

  it('refreshMatches writes matches before likes resolve and dedupes inflight', async () => {
    let resolveLikes!: (v: unknown) => void;
    const likesPromise = new Promise((resolve) => {
      resolveLikes = resolve;
    });

    vi.mocked(usersAPI.getMatches).mockResolvedValue({
      data: [{ id: 'm1', name: 'PeteMatch', age: 36, online: true }],
    } as never);
    vi.mocked(usersAPI.getReceivedLikes).mockReturnValue(likesPromise as never);

    const p1 = refreshMatches();
    const p2 = refreshMatches();
    expect(p1).toBe(p2);
    expect(usersAPI.getMatches).toHaveBeenCalledTimes(1);

    // Allow getMatches microtask to land in cache before likes resolve.
    for (let i = 0; i < 10 && !readCachedMatches()?.matches.length; i += 1) {
      await Promise.resolve();
    }
    expect(readCachedMatches()?.matches[0].name).toBe('PeteMatch');

    resolveLikes({ data: [{ id: 'l1', name: 'Liker', age: 29 }] });
    const snap = await p1;
    expect(snap.likes[0].name).toBe('Liker');
    expect(readCachedMatches()?.likes[0].name).toBe('Liker');
  });

  it('refreshMatches returns cache on failure when warm', async () => {
    writeCachedMatches([{ id: 'm1', name: 'Cached', age: 40 }], []);
    vi.mocked(usersAPI.getMatches).mockRejectedValue(new Error('network'));
    const snap = await refreshMatches();
    expect(snap.matches[0].name).toBe('Cached');
  });

  it('warmTabListCaches kicks both without throwing', () => {
    vi.mocked(messagesAPI.getConversations).mockRejectedValue(new Error('nope'));
    vi.mocked(usersAPI.getMatches).mockRejectedValue(new Error('nope'));
    expect(() => warmTabListCaches('me')).not.toThrow();
  });
});
