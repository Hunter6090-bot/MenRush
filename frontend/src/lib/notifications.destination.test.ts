import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { notificationDestination } from './notifications.ts';
import type { Notification } from '../hooks/store.ts';

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
    assert.equal(
      notificationDestination(
        base({ type: 'photo', linkPath: '/messages/peer-1', userId: 'peer-1' }),
      ),
      '/messages/peer-1',
    );
  });

  it('falls back to /messages/:userId when linkPath is missing', () => {
    assert.equal(
      notificationDestination(base({ type: 'message', userId: 'peer-2', linkPath: undefined })),
      '/messages/peer-2',
    );
  });

  it('never returns /notifications for a message with a peer id', () => {
    const dest = notificationDestination(
      base({ type: 'photo', userId: 'peer-3', linkPath: '/messages/peer-3' }),
    );
    assert.match(dest, /^\/messages\/peer-3/);
    assert.notEqual(dest, '/notifications');
  });

  it('strips absolute same-app linkPath down to a router path', () => {
    assert.equal(
      notificationDestination(
        base({
          type: 'message',
          userId: 'peer-4',
          linkPath: 'https://menrush.com/messages/peer-4',
        }),
      ),
      '/messages/peer-4',
    );
  });

  it('routes profile_view notifications to the viewer/sender profile', () => {
    assert.equal(
      notificationDestination(
        base({
          type: 'profile_view',
          userId: 'peer-mature-horny-69',
          linkPath: '/profile/peer-mature-horny-69',
        }),
      ),
      '/profile/peer-mature-horny-69',
    );

    assert.equal(
      notificationDestination(
        base({
          type: 'profile_view',
          userId: 'peer-mature-horny-69',
          linkPath: undefined,
        }),
      ),
      '/profile/peer-mature-horny-69',
    );
  });
});
