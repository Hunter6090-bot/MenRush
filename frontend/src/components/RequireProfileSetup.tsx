import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usersAPI } from '../api/client';
import { PulseRing } from './PulseRing';
import {
  hasSkippedProfileSetup,
  isProfileSetupComplete,
  type ProfileSetupSnapshot,
} from '../lib/profileSetup';

const EXEMPT_PATHS = ['/profile/setup', '/profile', '/settings'];

function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATHS.includes(pathname);
}

export function RequireProfileSetup({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(true);

  useEffect(() => {
    if (isExemptPath(location.pathname) || hasSkippedProfileSetup()) {
      setComplete(true);
      setReady(true);
      return;
    }

    let cancelled = false;
    usersAPI
      .getMe()
      .then((res) => {
        if (cancelled) return;
        setComplete(isProfileSetupComplete(res.data as ProfileSetupSnapshot));
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