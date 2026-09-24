import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { AdultAssuranceFlow } from '../components/AdultAssuranceFlow';
import { useAuthStore } from '../hooks/store';

export function AgeAssurance() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void authAPI.adultAccountStatus().then(({ data }) => {
      if (!active) return;
      if (data.assured) navigate('/discover', { replace: true });
      else setAvailable(data.available === true);
    }).catch(() => { if (active) setError('Unable to check age-assurance availability. Please try again later.'); });
    return () => { active = false; };
  }, [navigate]);
  return <main className="min-h-dvh bg-[#0D0A06] p-6 text-[#F0E0C0]">
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-bold">Confirm you’re 18+</h1>
      <p className="mt-4">Complete the required Veriff selfie age check to use MenRush. No ID document is required. The ID Verified badge is separate and optional.</p>
      {error && <p role="alert" className="mt-4">{error}</p>}
      {available ? <AdultAssuranceFlow required account fixtureAllowed={false}
        onCancel={() => { logout(); navigate('/login', { replace: true }); }}
        onComplete={(result) => {
          if ('underage' in result) { logout(); navigate('/register/underage', { replace: true }); }
          else if ('error' in result) setError(result.error);
          else if ('token' in result) void authAPI.completeAdultAccount(result.token)
            .then(() => navigate('/discover', { replace: true }))
            .catch(() => setError('The age check could not be saved. Please try again.'));
        }} /> : <p role="status" className="mt-6">The required age check is currently unavailable. Please try again later.</p>}
      <button className="mt-6 min-h-11 underline" onClick={() => { logout(); navigate('/login', { replace: true }); }}>Sign out</button>
    </div>
  </main>;
}
