import { describe, expect, it } from 'vitest';
import { shouldShowPushNotification } from './swPushPolicy';

describe('shouldShowPushNotification', () => {
  it('always shows incoming call pushes even with a focused visible client', () => {
    expect(
      shouldShowPushNotification({
        kind: 'call',
        hasFocusedVisibleClient: true,
        clientPath: '/discover',
        notifPath: '/messages/peer-1',
      }),
    ).toBe(true);
  });

  it('shows call pushes when no client is focused', () => {
    expect(
      shouldShowPushNotification({
        kind: 'call',
        hasFocusedVisibleClient: false,
      }),
    ).toBe(true);
  });

  it('suppresses message pushes only when focused on the same path', () => {
    expect(
      shouldShowPushNotification({
        kind: 'message',
        hasFocusedVisibleClient: true,
        clientPath: '/messages/peer-1',
        notifPath: '/messages/peer-1',
      }),
    ).toBe(false);
  });

  it('shows message pushes when focused elsewhere', () => {
    expect(
      shouldShowPushNotification({
        kind: 'message',
        hasFocusedVisibleClient: true,
        clientPath: '/discover',
        notifPath: '/messages/peer-1',
      }),
    ).toBe(true);
  });
});
