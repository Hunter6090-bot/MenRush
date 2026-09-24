import { describe, expect, it, beforeEach } from 'vitest';
import {
  __resetConversationHistoryCacheForTests,
  appendCachedThreadMessage,
  isPreviewSeedMessage,
  PREVIEW_MESSAGE_ID_PREFIX,
  readCachedThread,
  rememberInboxThread,
  stripPreviewSeedMessages,
  threadLikelyHasHistory,
  writeCachedThread,
} from './conversationHistoryCache';

describe('conversationHistoryCache', () => {
  beforeEach(() => {
    __resetConversationHistoryCacheForTests();
  });

  it('returns undefined until a thread is written', () => {
    expect(readCachedThread('peer-a')).toBeUndefined();
    expect(threadLikelyHasHistory('peer-a')).toBe(false);
  });

  it('round-trips full history and marks non-empty', () => {
    writeCachedThread('peer-a', [
      {
        id: 'm1',
        sender_id: 'peer-a',
        receiver_id: 'me',
        message: 'hey',
        created_at: '2026-08-01T12:00:00Z',
      },
    ]);
    expect(readCachedThread('peer-a')).toEqual([
      {
        id: 'm1',
        sender_id: 'peer-a',
        receiver_id: 'me',
        message: 'hey',
        created_at: '2026-08-01T12:00:00Z',
      },
    ]);
    expect(threadLikelyHasHistory('peer-a')).toBe(true);
  });

  it('seeds inbox preview without clobbering real history', () => {
    rememberInboxThread('peer-b', {
      lastMessage: 'from list',
      lastMessageTime: '2026-08-02T10:00:00Z',
      selfId: 'me',
    });
    const seeded = readCachedThread('peer-b');
    expect(seeded).toHaveLength(1);
    expect(seeded![0].message).toBe('from list');
    expect(isPreviewSeedMessage(seeded![0])).toBe(true);
    expect(threadLikelyHasHistory('peer-b')).toBe(true);

    writeCachedThread('peer-b', [
      {
        id: 'real-1',
        sender_id: 'peer-b',
        receiver_id: 'me',
        message: 'real history',
      },
    ]);
    rememberInboxThread('peer-b', {
      lastMessage: 'stale list preview',
      selfId: 'me',
    });
    expect(readCachedThread('peer-b')![0].message).toBe('real history');
  });

  it('marks inbox peers as likely history even without last_message text', () => {
    rememberInboxThread('peer-c', { lastMessage: null, selfId: 'me' });
    expect(threadLikelyHasHistory('peer-c')).toBe(true);
    expect(readCachedThread('peer-c')).toBeUndefined();
  });

  it('strips preview seeds and appends live messages', () => {
    rememberInboxThread('peer-d', { lastMessage: 'preview', selfId: 'me' });
    appendCachedThreadMessage('peer-d', {
      id: 'live-1',
      sender_id: 'peer-d',
      receiver_id: 'me',
      message: 'live',
    });
    const rows = readCachedThread('peer-d')!;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('live-1');
    expect(stripPreviewSeedMessages([{ id: `${PREVIEW_MESSAGE_ID_PREFIX}x` }, { id: 'ok' }])).toEqual([
      { id: 'ok' },
    ]);
  });

  it('writeCachedThread with empty array clears known-non-empty', () => {
    writeCachedThread('peer-e', [
      { id: 'm', sender_id: 'a', receiver_id: 'b', message: 'x' },
    ]);
    writeCachedThread('peer-e', []);
    expect(readCachedThread('peer-e')).toEqual([]);
    expect(threadLikelyHasHistory('peer-e')).toBe(false);
  });
});
