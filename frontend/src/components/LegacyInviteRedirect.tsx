import { Navigate, useLocation } from 'react-router-dom';

/**
 * Old preview address (/beta): send people home, replacing the history entry.
 * A link that still carries an ?invite= code goes to /invite with that code,
 * so an optional invite from an old email is not lost.
 */
export function LegacyInviteRedirect() {
  const { search } = useLocation();
  const invite = new URLSearchParams(search).get('invite')?.trim();
  if (invite) return <Navigate to={`/invite?invite=${encodeURIComponent(invite)}`} replace />;
  return <Navigate to="/" replace />;
}
