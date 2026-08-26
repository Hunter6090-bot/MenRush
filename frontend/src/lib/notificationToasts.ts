/** Minimal shape needed for live-toast gating (avoids pulling the Zustand store). */
export type ToastableNotification = {
  id: string;
  read: boolean;
};

/** Cap concurrent live toasts — never dump a stack from a burst or backfill. */
export const MAX_LIVE_TOASTS = 2;

/**
 * Decide whether a newly upserted notification should surface as a toast.
 *
 * Server backfill (`setFromServer`) never calls this. Live socket upserts do.
 * Until the first successful server sync, everything stays badge-only.
 */
export function shouldQueueLiveToast(opts: {
  serverSynced: boolean;
  alreadyInStore: boolean;
  notification: ToastableNotification;
}): boolean {
  if (!opts.serverSynced) return false;
  if (opts.alreadyInStore) return false;
  if (opts.notification.read) return false;
  return true;
}

/** Append a live toast, capping the visible stack. Extra events stay badge-only. */
export function enqueueLiveToast<T extends ToastableNotification>(
  current: T[],
  next: T,
): T[] {
  if (current.some((t) => t.id === next.id)) return current;
  if (current.length >= MAX_LIVE_TOASTS) return current;
  return [...current, next];
}

export type NotificationToastState<T extends ToastableNotification> = {
  notifications: T[];
  unreadCount: number;
  serverSynced: boolean;
  pendingToasts: T[];
};

/** Mirrors `setFromServer`: hydrates list/badge, never queues toasts. */
export function applyServerBackfill<T extends ToastableNotification>(
  notifications: T[],
  unreadCount: number,
  pendingToasts: T[] = [],
): NotificationToastState<T> {
  return {
    notifications,
    unreadCount,
    serverSynced: true,
    // Keep any in-flight live toasts; backfill itself adds none.
    pendingToasts,
  };
}

/** Mirrors `upsertNotification` toast gating used by the Zustand store. */
export function applyLiveUpsert<T extends ToastableNotification>(
  state: NotificationToastState<T>,
  notification: T,
): NotificationToastState<T> {
  const exists = state.notifications.some((n) => n.id === notification.id);
  const notifications = [
    notification,
    ...state.notifications.filter((n) => n.id !== notification.id),
  ].slice(0, 100);
  let unreadCount = state.unreadCount;
  if (!exists && !notification.read) unreadCount += 1;
  if (exists) {
    unreadCount = notifications.filter((n) => !n.read).length;
  }
  const pendingToasts = shouldQueueLiveToast({
    serverSynced: state.serverSynced,
    alreadyInStore: exists,
    notification,
  })
    ? enqueueLiveToast(state.pendingToasts, notification)
    : state.pendingToasts;
  return { ...state, notifications, unreadCount, pendingToasts };
}
