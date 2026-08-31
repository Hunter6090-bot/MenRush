import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { PulseRing } from './PulseRing';
import {
  clearProfileSetupSkip,
  needsProfileSetupRedirect,
  type ProfileSetupSnapshot,
} from '../lib/profileSetup';

const EXEMPT_PATHS = ['/profile/setup', '/profile', '/settings'];

function isExemptPath(pathname: string): boolean {
  if (EXEMPT_PATHS.includes(pathname)) return true;
  // Viewing someone else's profile must not bounce incomplete accounts to setup
  // (that looked like a blank/broken profile open from chat).
  if (/^\/profile\/[^/]+$/.test(pathname)) return true;
  return false;
}

/**
 * Hard gate for photo/bio/looking/tags only.
 * Missing GPS is NOT incomplete profile — Discover handles location in-place.
 */
export function RequireProfileSetup({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(true);

  useEffect(() => {
    if (isExemptPath(location.pathname)) {
      setComplete(true);
      setReady(true);
      return;
    }

    let cancelled = false;
    usersAPI
      .getMe()
      .then((res) => {
        if (cancelled) return;
        const profile = res.data as ProfileSetupSnapshot;
        const mustSetup = needsProfileSetupRedirect(profile);
        // Only clear skip when profile *fields* are incomplete (not for missing GPS).
        if (mustSetup) {
          clearProfileSetupSkip();
        }
        setComplete(!mustSetup);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setComplete(true);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <PulseRing size={32} label="Loading" />
      </div>
    );
  }

  if (!complete && !isExemptPath(location.pathname)) {
    return <Navigate to="/profile/setup" replace state={{ from: location.pathname }} />;
  }

  return children;
}