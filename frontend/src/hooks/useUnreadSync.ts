import { useEffect } from 'react';
import { messagesAPI } from '../api/client';
import { useAuthStore, useUnreadStore } from './store';

/** Load persisted unread counts from the server when the user is signed in. */
export function useUnreadSync() {
  const token = useAuthStore((s) => s.token);
  const setUnreadFromServer = useUnreadStore((s) => s.setUnreadFromServer);

  useEffect(() => {
    if (!token) {
      setUnreadFromServer({});
      return;
    }

    let cancelled = false;
    let intervalId = 0;
    const sync = () => {
      messagesAPI
        .getUnreadSummary()
        .then((res) => {
          if (!cancelled) setUnreadFromServer(res.data.bySender ?? {});
        })
        .catch((err: { response?: { status?: number } }) => {
          // Dead session: stop polling; axios interceptor clears auth.
          if (err?.response?.status === 401 && intervalId) {
            window.clearInterval(intervalId);
            intervalId = 0;
          }
        });
    };

    sync();
    intervalId = window.setInterval(sync, 60_000);
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [token, setUnreadFromServer]);
}
