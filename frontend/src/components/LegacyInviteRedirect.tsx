import { Navigate, useLocation } from 'react-router-dom';

/** Tracking params kept on the redirect: any utm_* plus ref. Everything else is dropped. */
function isTrackingParam(key: string): boolean {
  return key === 'ref' || /^utm_[a-z0-9_]+$/i.test(key);
}

/**
 * Old preview address (/beta): send people home, replacing the history entry.
 * A link that still carries an ?invite= code goes to /invite with that code,
 * so an optional invite from an old email is not lost. Tracking params
 * (utm_*, ref) are kept on either redirect; other params are dropped.
 */
export function LegacyInviteRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const next = new URLSearchParams();
  const invite = params.get('invite')?.trim();
  if (invite) next.set('invite', invite);
  params.forEach((value, key) => {
    if (isTrackingParam(key) && value.trim() && !next.has(key)) next.set(key, value.trim());
  });
  const query = next.toString();
  const path = invite ? '/invite' : '/';
  return <Navigate to={query ? `${path}?${query}` : path} replace />;
}
