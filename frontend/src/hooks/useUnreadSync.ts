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
    const sync = () => {
      messagesAPI
        .getUnreadSummary()
        .then((res) => {
          if (!cancelled) setUnreadFromServer(res.data.bySender ?? {});
        })
        .catch(() => {});
    };

    sync();
    const id = window.setInterval(sync, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [token, setUnreadFromServer]);
}
