import { useEffect } from 'react';
import { usersAPI } from '../api/client';
import { useAuthStore } from './store';

/** Keeps header avatar and auth user in sync with the latest profile photo. */
export function useAuthProfileSync() {
  const token = useAuthStore((s) => s.token);
  const patchUser = useAuthStore((s) => s.patchUser);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    usersAPI
      .getMe()
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { name?: string; photo_url?: string | null };
        patchUser({
          name: data.name,
          photo_url: data.photo_url ?? undefined,
        });
      })
      .catch(() => {
        /* ignore — avatar falls back to initial */
      });

    return () => {
      cancelled = true;
    };
  }, [token, patchUser]);
}
