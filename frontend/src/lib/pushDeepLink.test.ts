import { describe, expect, it } from 'vitest';
import {
  appendUniqueMessage,
  mergeConversationRows,
  peerIdFromMessagesUrl,
  resolveNotificationHref,
  conversationFingerprint,
} from './pushDeepLink';

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
    const prev = [{ id: 'm1', body: 'a' }];
    expect(appendUniqueMessage(prev, { id: 'm1', body: 'a' })).toEqual(prev);
    expect(appendUniqueMessage(prev, { id: 'm2', body: 'b' })).toEqual([
      { id: 'm1', body: 'a' },
      { id: 'm2', body: 'b' },
    ]);
  });

  it('merges server refresh over an open thread without dropping local-only rows', () => {
    const current = [
      { id: 'm1', body: 'old' },
      { id: 'local', body: 'pending' },
    ];
    const fromServer = [
      { id: 'm1', body: 'old' },
      { id: 'm2', body: 'photo' },
    ];
    expect(mergeConversationRows(current, fromServer)).toEqual([
      { id: 'm1', body: 'old' },
      { id: 'm2', body: 'photo' },
      { id: 'local', body: 'pending' },
    ]);
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
