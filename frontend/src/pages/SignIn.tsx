import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import OnboardingTour from '../components/OnboardingTour';

const TOUR_KEY = 'menrush_tour_seen';

const btn: React.CSSProperties = {
  border: 0, cursor: 'pointer', borderRadius: 999, padding: '17px 24px',
  fontFamily: 'inherit', fontSize: 17, fontWeight: 700, color: '#FFF6E6',
  background: 'linear-gradient(90deg, #C4832A 0%, #A45E18 100%)',
  boxShadow: '0 0 24px rgba(196,131,42,.3)',
  transition: 'background 240ms cubic-bezier(.16,1,.3,1), transform 100ms',
};

export const SignIn = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const signIn = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter the email and password from your invite.');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.login({ email: email.trim(), password });
      setAuth(res.data.user, res.data.token);
      if (!localStorage.getItem(TOUR_KEY)) {
        setShowTour(true);
      } else {
        navigate('/discover');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'No account found. Check your invite details.');
    } finally {
      setLoading(false);
    }
  };

  const onTourDone = () => {
    localStorage.setItem(TOUR_KEY, '1');
    navigate('/discover');
  };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') signIn(); };

  return (
    <>
    {showTour && <OnboardingTour onDone={onTourDone} />}
    <div style={{ minHeight: '100dvh', background: '#0D0A06', color: '#F0E0C0', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px 72px' }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/images/09-cigar-daddy-bar.jpeg')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,10,6,.6) 0%, rgba(13,10,6,.85) 60%, rgba(13,10,6,.97) 100%)' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: '#F0E0C0', marginBottom: 40 }}>
          <img src="/menrush-logo.png" alt="MenRush" style={{ width: 52, height: 52, borderRadius: '50%', boxShadow: '0 0 0 2px rgba(196,131,42,.4)' }} />
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.14em' }}>MENRUSH</span>
        </Link>

        <h1 style={{ margin: 0, fontWeight: 900, fontSize: 'clamp(38px, 7vw, 62px)', lineHeight: 1.04, letterSpacing: '-0.01em', textWrap: 'balance' as any }}>
          Sign in and see who's <span style={{ color: '#C4832A' }}>near you right now.</span>
        </h1>
        <p style={{ margin: '22px 0 0', fontSize: 17, lineHeight: 1.6, color: '#A89070', maxWidth: 480 }}>
          For invite holders only. Use the email and password from your invite.
        </p>

        {/* Form card */}
        <div style={{ marginTop: 34, border: '1px solid rgba(240,224,192,.35)', borderRadius: 24, padding: '28px 24px', background: 'rgba(13,10,6,.45)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: '#F0E0C0' }}>USERNAME / EMAIL</label>
            <input
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com"
              style={{ background: '#F5EBD8', border: 0, outline: 'none', borderRadius: 999, padding: '18px 24px', fontSize: 16, fontFamily: 'inherit', color: '#2A1C0A', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: '#F0E0C0' }}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={onKey}
              placeholder="••••••••"
              style={{ background: '#F5EBD8', border: 0, outline: 'none', borderRadius: 999, padding: '18px 24px', fontSize: 16, fontFamily: 'inherit', color: '#2A1C0A', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          {error && <div style={{ fontSize: 14, color: '#B0432E', fontWeight: 600 }}>{error}</div>}
          <button
            onClick={signIn}
            disabled={loading}
            style={{ ...btn, opacity: loading ? 0.7 : 1 }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(90deg, #E0A14A 0%, #C4832A 100%)'; }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(90deg, #C4832A 0%, #A45E18 100%)'; }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 15, color: '#A89070' }}>
            <div>Selected for beta? <Link to="/beta" style={{ color: '#C4832A', fontWeight: 700, textDecoration: 'none' }}>Create an account</Link></div>
            <Link to="#" style={{ color: '#C4832A', fontWeight: 700, textDecoration: 'none' }}>Forgot password?</Link>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
