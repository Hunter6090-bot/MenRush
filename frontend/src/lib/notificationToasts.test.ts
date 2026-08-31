import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyLiveUpsert,
  applyServerBackfill,
  enqueueLiveToast,
  MAX_LIVE_TOASTS,
  shouldQueueLiveToast,
  type NotificationToastState,
} from './notificationToasts.ts';

function n(id: string, read = false) {
  return { id, read };
}

function emptyState(): NotificationToastState<ReturnType<typeof n>> {
  return {
    notifications: [],
    unreadCount: 0,
    serverSynced: false,
    pendingToasts: [],
  };
}

describe('shouldQueueLiveToast', () => {
  it('does not toast before the first server sync (hydration / login)', () => {
    assert.equal(
      shouldQueueLiveToast({
        serverSynced: false,
        alreadyInStore: false,
        notification: n('a'),
      }),
      false,
    );
  });

  it('does not toast an id already present from backfill', () => {
    assert.equal(
      shouldQueueLiveToast({
        serverSynced: true,
        alreadyInStore: true,
        notification: n('a'),
      }),
      false,
    );
  });

  it('does not toast already-read items', () => {
    assert.equal(
      shouldQueueLiveToast({
        serverSynced: true,
        alreadyInStore: false,
        notification: n('a', true),
      }),
      false,
    );
  });

  it('toasts a later unseen id after sync', () => {
    assert.equal(
      shouldQueueLiveToast({
        serverSynced: true,
        alreadyInStore: false,
        notification: n('live-1'),
      }),
      true,
    );
  });
});

describe('enqueueLiveToast', () => {
  it('caps the stack so a burst never dumps more than a couple', () => {
    let stack = [] as ReturnType<typeof n>[];
    for (let i = 0; i < 5; i += 1) {
      stack = enqueueLiveToast(stack, n(`n-${i}`));
    }
    assert.equal(stack.length, MAX_LIVE_TOASTS);
    assert.deepEqual(
      stack.map((t) => t.id),
      ['n-0', 'n-1'],
    );
  });
});

describe('hydration / backfill vs live upsert', () => {
  it('server backfill raises unread with zero toasts (empty mount → pull)', () => {
    const afterEmptyMount = emptyState();
    const afterBackfill = applyServerBackfill([n('u1'), n('u2'), n('u3')], 3);
    assert.equal(afterEmptyMount.pendingToasts.length, 0);
    assert.equal(afterBackfill.serverSynced, true);
    assert.equal(afterBackfill.unreadCount, 3);
    assert.deepEqual(afterBackfill.pendingToasts, []);
  });

  it('upsert before sync is badge-only (hydration race)', () => {
    const after = applyLiveUpsert(emptyState(), n('early'));
    assert.equal(after.serverSynced, false);
    assert.equal(after.unreadCount, 1);
    assert.deepEqual(after.pendingToasts, []);
  });

  it('a later unseen id after sync does toast', () => {
    const synced = applyServerBackfill([n('old')], 1);
    const after = applyLiveUpsert(synced, n('live'));
    assert.equal(after.unreadCount, 2);
    assert.equal(after.pendingToasts.length, 1);
    assert.equal(after.pendingToasts[0]?.id, 'live');
  });

  it('setFromServer of new ids never dumps toasts (poll backfill)', () => {
    const synced = applyServerBackfill([n('a'), n('b')], 2);
    const polled = applyServerBackfill([n('a'), n('b'), n('c')], 3, synced.pendingToasts);
    assert.deepEqual(polled.pendingToasts, []);
  });
});
