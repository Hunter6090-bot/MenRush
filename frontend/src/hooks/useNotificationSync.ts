import { useCallback, useEffect } from 'react';
import { notificationsAPI } from '../api/client';
import { useAuthStore, useNotificationStore } from './store';
import { mapNotification } from '../lib/notifications';

async function pullNotifications(
  setFromServer: ReturnType<typeof useNotificationStore.getState>['setFromServer'],
  setLoadError: ReturnType<typeof useNotificationStore.getState>['setLoadError'],
) {
  const res = await notificationsAPI.list();
  setFromServer(
    (res.data.notifications ?? []).map(mapNotification),
    res.data.unread_count ?? 0,
  );
}

/** Loads persisted notifications and keeps unread badge in sync with the server. */
export function useNotificationSync() {
  const token = useAuthStore((s) => s.token);
  const setFromServer = useNotificationStore((s) => s.setFromServer);
  const setLoadError = useNotificationStore((s) => s.setLoadError);

  const sync = useCallback(async (): Promise<'ok' | 'auth' | 'error'> => {
    if (!token) {
      setFromServer([], 0);
      return 'ok';
    }
    try {
      await pullNotifications(setFromServer, setLoadError);
      return 'ok';
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        // Dead session: axios interceptor clears auth; do not nag with load error.
        return 'auth';
      }
      setLoadError('Could not load alerts. Pull down or reopen this page to retry.');
      return 'error';
    }
  }, [token, setFromServer, setLoadError]);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    if (!token) return;

    let intervalId = 0;
    const onFocus = () => {
      void sync();
    };
    const tick = async () => {
      const result = await sync();
      if (result === 'auth' && intervalId) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }
    };
    window.addEventListener('focus', onFocus);
    intervalId = window.setInterval(() => void tick(), 60_000);
    return () => {
      window.removeEventListener('focus', onFocus);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [token, sync]);
}

/** Manual refresh — used by the Alerts page after errors or pull-to-refresh. */
export function refreshNotifications() {
  const { setFromServer, setLoadError } = useNotificationStore.getState();
  return pullNotifications(setFromServer, setLoadError).catch(() => {
    setLoadError('Could not load alerts. Try again shortly.');
  });
}
