import { useEffect } from 'react';
import { premiumAPI } from '../api/premium';
import { useAuthStore } from './store';

/**
 * Keep the client entitlement snapshot aligned with the backend.
 * In private beta the backend is authoritative and grants Premium to everyone.
 */
export function usePremiumSync(enabled: boolean): void {
  const setPremium = useAuthStore((state) => state.setPremium);
  const patchUser = useAuthStore((state) => state.patchUser);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    premiumAPI
      .getStatus()
      .then(({ data }) => {
        if (cancelled) return;
        setPremium(data.tier, data.is_premium);
        patchUser({ beta_premium_included: data.beta_premium_included });
      })
      .catch(() => {
        // Keep the last known state; individual APIs remain authoritative.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, patchUser, setPremium]);
}
