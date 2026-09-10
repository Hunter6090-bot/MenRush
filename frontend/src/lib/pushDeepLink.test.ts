import { describe, expect, it } from 'vitest';
import {
  appendUniqueMessage,
  CONVERSATION_PAGE_SIZE,
  mergeConversationRows,
  peerIdFromMessagesUrl,
  resolveNotificationHref,
  conversationFingerprint,
  conversationPathFromPushNotification,
  sortMessagesChronologically,
} from './pushDeepLink';

function msg(id: string, createdAt: string, body = id) {
  return { id, created_at: createdAt, body };
}

describe('resolveNotificationHref', () => {
  const origin = 'https://menrush.com';

  it('turns a relative chat path into an absolute same-origin href', () => {
    expect(resolveNotificationHref('/messages/abc-123', origin)).toBe(
      'https://menrush.com/messages/abc-123',
    );
  });

  it('keeps same-origin absolute URLs', () => {
    expect(resolveNotificationHref('https://menrush.com/messages/x', origin)).toBe(
      'https://menrush.com/messages/x',
    );
  });

  it('rejects cross-origin absolute URLs', () => {
    expect(resolveNotificationHref('https://evil.example/messages/x', origin)).toBe(
      'https://menrush.com/discover',
    );
  });

  it('falls back when payload url is missing', () => {
    expect(resolveNotificationHref(undefined, origin)).toBe('https://menrush.com/discover');
  });
});

describe('peerIdFromMessagesUrl', () => {
  it('parses relative and absolute message paths', () => {
    expect(peerIdFromMessagesUrl('/messages/peer-1')).toBe('peer-1');
    expect(peerIdFromMessagesUrl('https://menrush.com/messages/peer-2?x=1')).toBe('peer-2');
  });

  it('returns null for non-chat paths', () => {
    expect(peerIdFromMessagesUrl('/discover')).toBeNull();
    expect(peerIdFromMessagesUrl(null)).toBeNull();
  });
});

describe('appendUniqueMessage / mergeConversationRows', () => {
  it('does not duplicate socket deliveries by id', () => {
    const prev = [msg('m1', '2026-09-10T10:00:00.000Z', 'a')];
    expect(appendUniqueMessage(prev, msg('m1', '2026-09-10T10:00:00.000Z', 'a'))).toEqual(prev);
    expect(
      appendUniqueMessage(prev, msg('m2', '2026-09-10T10:00:01.000Z', 'b')),
    ).toEqual([
      msg('m1', '2026-09-10T10:00:00.000Z', 'a'),
      msg('m2', '2026-09-10T10:00:01.000Z', 'b'),
    ]);
  });

  it('inserts out-of-order socket rows by created_at instead of always appending', () => {
    const prev = [
      msg('m1', '2026-09-10T10:00:00.000Z'),
      msg('m3', '2026-09-10T10:00:02.000Z'),
    ];
    expect(appendUniqueMessage(prev, msg('m2', '2026-09-10T10:00:01.000Z')).map((m) => m.id)).toEqual([
      'm1',
      'm2',
      'm3',
    ]);
  });

  it('merges server refresh over an open thread without dropping no-id pending rows', () => {
    const current = [
      msg('m1', '2026-09-10T10:00:00.000Z', 'old'),
      { body: 'pending' },
    ];
    const fromServer = [
      msg('m1', '2026-09-10T10:00:00.000Z', 'old'),
      msg('m2', '2026-09-10T10:00:01.000Z', 'photo'),
    ];
    expect(mergeConversationRows(current, fromServer)).toEqual([
      msg('m1', '2026-09-10T10:00:00.000Z', 'old'),
      msg('m2', '2026-09-10T10:00:01.000Z', 'photo'),
      { body: 'pending' },
    ]);
  });

  it('does not append older rows that slid out of the LIMIT page (P0 reorder)', () => {
    // Simulate open thread that already painted ids 1..50, then a new message
    // arrives so the next getConversation page is 2..51. The old merge appended
    // id 1 at the end → earlier bubble suddenly at the bottom.
    const t0 = Date.parse('2026-09-10T12:00:00.000Z');
    const current = Array.from({ length: 50 }, (_, i) =>
      msg(`m${i + 1}`, new Date(t0 + i * 1000).toISOString()),
    );
    // Socket already appended m51 before the poll returns.
    current.push(msg('m51', new Date(t0 + 50 * 1000).toISOString()));

    const fromServer = Array.from({ length: 50 }, (_, i) =>
      msg(`m${i + 2}`, new Date(t0 + (i + 1) * 1000).toISOString()),
    );

    const merged = mergeConversationRows(current, fromServer);
    expect(merged).toHaveLength(CONVERSATION_PAGE_SIZE);
    expect(merged.map((m) => m.id)).toEqual(
      Array.from({ length: 50 }, (_, i) => `m${i + 2}`),
    );
    // Oldest painted row must not jump to the end.
    expect(merged[merged.length - 1]?.id).toBe('m51');
    expect(merged.some((m) => m.id === 'm1')).toBe(false);
  });

  it('keeps a live socket row newer than the polled page until the next fetch includes it', () => {
    const current = [
      msg('m1', '2026-09-10T10:00:00.000Z'),
      msg('m2', '2026-09-10T10:00:01.000Z'),
      msg('m3', '2026-09-10T10:00:02.000Z'),
    ];
    const fromServer = [
      msg('m1', '2026-09-10T10:00:00.000Z'),
      msg('m2', '2026-09-10T10:00:01.000Z'),
    ];
    expect(mergeConversationRows(current, fromServer).map((m) => m.id)).toEqual([
      'm1',
      'm2',
      'm3',
    ]);
  });

  it('prefers server payload fields when the same id is refreshed', () => {
    const current = [{ id: 'm1', created_at: '2026-09-10T10:00:00.000Z', body: 'stale', view_count: 0 }];
    const fromServer = [
      { id: 'm1', created_at: '2026-09-10T10:00:00.000Z', body: 'photo', view_count: 1 },
    ];
    expect(mergeConversationRows(current, fromServer)).toEqual(fromServer);
  });
});

describe('sortMessagesChronologically', () => {
  it('orders by created_at then id; missing timestamps last', () => {
    expect(
      sortMessagesChronologically([
        msg('b', '2026-09-10T10:00:01.000Z'),
        { id: 'pending' },
        msg('a', '2026-09-10T10:00:00.000Z'),
        msg('c', '2026-09-10T10:00:01.000Z'),
      ]).map((m) => m.id),
    ).toEqual(['a', 'b', 'c', 'pending']);
  });
});

describe('conversationFingerprint', () => {
  it('changes when a new media row appears', () => {
    const before = conversationFingerprint([{ id: '1', message: 'hi', media_url: null }]);
    const after = conversationFingerprint([
      { id: '1', message: 'hi', media_url: null },
      { id: '2', message: '📷 Photo', media_url: '/api/messages/2/media?access=x' },
    ]);
    expect(before).not.toEqual(after);
  });
});

describe('conversationPathFromPushNotification', () => {
  it('recovers the chat path from msg-<peerId> tag when data.url is missing', () => {
    expect(
      conversationPathFromPushNotification({
        url: null,
        tag: 'msg-peer-99',
      }),
    ).toBe('/messages/peer-99');
  });

  it('prefers explicit url over tag', () => {
    expect(
      conversationPathFromPushNotification({
        url: '/messages/peer-1',
        tag: 'msg-peer-2',
      }),
    ).toBe('/messages/peer-1');
  });
});
