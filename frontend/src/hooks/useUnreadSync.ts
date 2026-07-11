import { useEffect } from 'react';
import { messagesAPI } from '../api/client';
import { useAuthStore, useUnreadStore } from './store';

/** Load persisted unread counts from the server when the user is signed in. */
export function useUnreadSync() {
  const token = useAuthStore((s) => s.token);
  const setUnreadFromServer = useUnreadStore((s) => s.setUnreadFromServer);

  useEffect(() => {
    // Require both store + storage so we never poll half-logged-out sessions.
    if (!token || !localStorage.getItem('token')) {
      setUnreadFromServer({});
      return;
    }

    let cancelled = false;
    let intervalId = 0;
    const sync = () => {
      if (!localStorage.getItem('token')) {
        if (intervalId) {
          window.clearInterval(intervalId);
          intervalId = 0;
        }
        return;
      }
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
