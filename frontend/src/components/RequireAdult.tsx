import { useEffect, useState, type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';

/** Server evidence is authoritative; cached user flags and ID badges cannot bypass this. */
export function RequireAdult({ children }: { children: ReactElement }) {
  const token = useAuthStore((s) => s.token);
  const [checkedToken, setCheckedToken] = useState<string | null>(null);
  const [assured, setAssured] = useState(false);
  useEffect(() => {
    let active = true;
    void authAPI.adultAccountStatus().then(({ data }) => {
      if (active) { setAssured(data.assured === true); setCheckedToken(token); }
    }).catch(() => { if (active) { setAssured(false); setCheckedToken(token); } });
    return () => { active = false; };
  }, [token]);
  if (!token) return <Navigate to="/login" replace />;
  if (checkedToken !== token) return <p role="status">Checking 18+ access…</p>;
  return assured ? children : <Navigate to="/age-assurance" replace />;
}
