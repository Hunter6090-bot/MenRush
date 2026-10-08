import { Navigate, useLocation } from 'react-router-dom';

/** /beta was the old invite page. Old email links keep working and land on /invite with any ?invite= code. */
export function LegacyInviteRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/invite${search}${hash}`} replace />;
}
