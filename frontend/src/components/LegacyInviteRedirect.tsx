import { Navigate, useLocation } from 'react-router-dom';
import { getParamIgnoreCase, withTrackingParams } from '../lib/trackingParams';

/**
 * Old preview address (/beta): send people home, replacing the history entry.
 * A link that still carries an ?invite= code goes to /invite with that code,
 * so an optional invite from an old email is not lost. Tracking params
 * (utm_*, ref) are kept on either redirect; other params are dropped.
 */
export function LegacyInviteRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const invite = getParamIgnoreCase(params, 'invite')?.trim();
  const path = invite ? `/invite?${new URLSearchParams({ invite }).toString()}` : '/';
  return <Navigate to={withTrackingParams(path, params)} replace />;
}
