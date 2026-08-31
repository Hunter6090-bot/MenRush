import { describe, expect, it } from 'vitest';
import { notificationDestination } from './notifications';
import type { Notification } from '../hooks/store';

function base(partial: Partial<Notification>): Notification {
  return {
    id: 'n1',
    type: 'message',
    message: 'New message',
    createdAt: new Date().toISOString(),
    read: false,
    ...partial,
  };
}

describe('notificationDestination', () => {
  it('opens the 1:1 chat for message/photo/voice via linkPath', () => {
    expect(
      notificationDestination(
        base({ type: 'photo', linkPath: '/messages/peer-1', userId: 'peer-1' }),
      ),
    ).toBe('/messages/peer-1');
  });

  it('falls back to /messages/:userId when linkPath is missing', () => {
    expect(
      notificationDestination(base({ type: 'message', userId: 'peer-2', linkPath: undefined })),
    ).toBe('/messages/peer-2');
  });

  it('never returns /notifications for a message with a peer id', () => {
    const dest = notificationDestination(
      base({ type: 'photo', userId: 'peer-3', linkPath: '/messages/peer-3' }),
    );
    expect(dest).toMatch(/^\/messages\/peer-3/);
    expect(dest).not.toBe('/notifications');
  });

  it('strips absolute same-app linkPath down to a router path', () => {
    expect(
      notificationDestination(
        base({
          type: 'message',
          userId: 'peer-4',
          linkPath: 'https://menrush.com/messages/peer-4',
        }),
      ),
    ).toBe('/messages/peer-4');
  });
});
