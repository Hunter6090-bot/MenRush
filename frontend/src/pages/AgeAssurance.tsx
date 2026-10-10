import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { AdultAssuranceFlow } from '../components/AdultAssuranceFlow';
import { useAuthStore } from '../hooks/store';

export function AgeAssurance() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [status, setStatus] = useState<'loading' | 'available' | 'unavailable' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError('');
    void authAPI.adultAccountStatus().then(({ data }) => {
      if (!active) return;
      if (typeof data?.assured !== 'boolean' || typeof data?.available !== 'boolean') {
        throw new Error('Invalid age assurance response');
      }
      if (data.assured === true) navigate('/discover', { replace: true });
      else setStatus(data.available ? 'available' : 'unavailable');
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [navigate, attempt]);
  return <main className="min-h-dvh bg-[#0D0A06] p-6 text-[#F0E0C0]">
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-bold">Confirm you’re 18+</h1>
      <p className="mt-4">Complete the required Veriff selfie age check to use MenRush. No ID document is required. The ID Verified badge is separate and optional.</p>
      {error && <p role="alert" className="mt-4">{error}</p>}
      {status === 'loading' && <p role="status" className="mt-6">Checking age-check availability…</p>}
      {(status === 'error' || status === 'unavailable') && <div className="mt-6">
        <p role="alert">{status === 'error'
          ? 'We couldn’t connect to the age-check service. Your sign-in is complete, but we can’t confirm 18+ access yet.'
          : 'Your sign-in is complete. The required age-check service is currently unavailable, so access remains paused.'}</p>
        <button className="mt-4 min-h-11 underline" onClick={() => setAttempt(value => value + 1)}>Try again</button>
      </div>}
      {status === 'available' && <AdultAssuranceFlow required account fixtureAllowed={false}
        onCancel={() => { logout(); navigate('/login', { replace: true }); }}
        onComplete={(result) => {
          if ('underage' in result) { logout(); navigate('/register/underage', { replace: true }); }
          else if ('error' in result) setError(result.error);
          else if ('token' in result) void authAPI.completeAdultAccount(result.token)
            .then(() => navigate('/discover', { replace: true }))
            .catch(() => setError('The age check could not be saved. Please try again.'));
        }} />}
      <button className="mt-6 min-h-11 underline" onClick={() => { logout(); navigate('/login', { replace: true }); }}>Sign out</button>
    </div>
  </main>;
}
