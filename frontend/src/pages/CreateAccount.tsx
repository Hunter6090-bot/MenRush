import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';

const btn: React.CSSProperties = {
  border: 0, cursor: 'pointer', borderRadius: 999, padding: '17px 24px',
  fontFamily: 'inherit', fontSize: 17, fontWeight: 700, color: '#FFF6E6',
  background: 'linear-gradient(90deg, #C4832A 0%, #A45E18 100%)',
  boxShadow: '0 0 24px rgba(196,131,42,.3)',
  transition: 'background 240ms cubic-bezier(.16,1,.3,1), transform 100ms',
};

export const CreateAccount = () => {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('code') || '';
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');

  // Guard: no valid code → redirect to beta gate
  if (!inviteCode || !/^MR-BETA-[A-Z0-9]{4,}$/.test(inviteCode)) {
    navigate('/beta', { replace: true });
    return null;
  }

  const create = async () => {
    if (!username.trim()) return setError('Pick a username.');
    if (!email.includes('@')) return setError('Enter the email your invite was sent to.');
    if (password.length < 8) return setError('Password needs 8+ characters.');
    if (password !== confirm) return setError("Passwords don't match.");
    setError('');
    setLoading(true);
    try {
      await authAPI.register({ email: email.trim(), password, name: username.trim(), age: 18 });
      setCreatedEmail(email.trim());
      setCreated(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') create(); };

  const clearErr = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setError('');
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#0D0A06', color: '#F0E0C0', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px 72px' }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/images/02-soho-night-crowd.jpeg')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,10,6,.6) 0%, rgba(13,10,6,.85) 60%, rgba(13,10,6,.97) 100%)' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: '#F0E0C0', marginBottom: 40 }}>
          <img src="/menrush-logo.png" alt="MenRush" style={{ width: 52, height: 52, borderRadius: '50%', boxShadow: '0 0 0 2px rgba(196,131,42,.4)' }} />
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.14em' }}>MENRUSH</span>
        </Link>

        {created ? (
          /* Success state */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, fontWeight: 900, fontSize: 'clamp(38px, 7vw, 62px)', lineHeight: 1.04, letterSpacing: '-0.01em', textWrap: 'balance' as any }}>
              Account created. <span style={{ color: '#C4832A' }}>Verify next.</span>
            </h1>
            <p style={{ margin: '22px 0 0', fontSize: 17, lineHeight: 1.6, color: '#A89070', maxWidth: 480 }}>
              Check <strong style={{ color: '#F0E0C0' }}>{createdEmail}</strong> for a verification link. ID and selfie check happen in the app.
            </p>
            <Link
              to="/signin"
              style={{ ...btn, marginTop: 30, display: 'inline-flex', alignSelf: 'flex-start', textDecoration: 'none', borderRadius: 999, padding: '17px 34px' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(90deg, #E0A14A 0%, #C4832A 100%)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(90deg, #C4832A 0%, #A45E18 100%)'; }}
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          /* Form state */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, fontWeight: 900, fontSize: 'clamp(38px, 7vw, 62px)', lineHeight: 1.04, letterSpacing: '-0.01em', textWrap: 'balance' as any }}>
              You're in. <span style={{ color: '#C4832A' }}>Set up your account.</span>
            </h1>
            <p style={{ margin: '22px 0 0', fontSize: 17, lineHeight: 1.6, color: '#A89070', maxWidth: 480 }}>
              Your invite code checks out. Pick a username and password to join the beta.
            </p>

            <div style={{ marginTop: 34, border: '1px solid rgba(240,224,192,.35)', borderRadius: 24, padding: '28px 24px', background: 'rgba(13,10,6,.45)', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Code chip */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderRadius: 999, background: 'rgba(196,131,42,.12)', border: '1px solid rgba(196,131,42,.45)' }}>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#E0A14A' }}>INVITE CODE</span>
                <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 14, letterSpacing: '0.12em', color: '#F0E0C0' }}>{inviteCode}</span>
              </div>

              {/* Username */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: '#F0E0C0' }}>USERNAME</label>
                <input value={username} onChange={clearErr(setUsername)} placeholder="What men will see" style={{ background: '#F5EBD8', border: 0, outline: 'none', borderRadius: 999, padding: '18px 24px', fontSize: 16, fontFamily: 'inherit', color: '#2A1C0A', width: '100%', boxSizing: 'border-box' }} />
              </div>

              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: '#F0E0C0' }}>EMAIL</label>
                <input value={email} onChange={clearErr(setEmail)} placeholder="you@example.com" style={{ background: '#F5EBD8', border: 0, outline: 'none', borderRadius: 999, padding: '18px 24px', fontSize: 16, fontFamily: 'inherit', color: '#2A1C0A', width: '100%', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 13, color: '#A89070' }}>Use the email your invite was sent to.</div>
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: '#F0E0C0' }}>PASSWORD</label>
                <input type="password" value={password} onChange={clearErr(setPassword)} placeholder="8+ characters" style={{ background: '#F5EBD8', border: 0, outline: 'none', borderRadius: 999, padding: '18px 24px', fontSize: 16, fontFamily: 'inherit', color: '#2A1C0A', width: '100%', boxSizing: 'border-box' }} />
              </div>

              {/* Confirm */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: '#F0E0C0' }}>CONFIRM PASSWORD</label>
                <input type="password" value={confirm} onChange={clearErr(setConfirm)} onKeyDown={onKey} placeholder="Repeat it" style={{ background: '#F5EBD8', border: 0, outline: 'none', borderRadius: 999, padding: '18px 24px', fontSize: 16, fontFamily: 'inherit', color: '#2A1C0A', width: '100%', boxSizing: 'border-box' }} />
              </div>

              {error && <div style={{ fontSize: 14, color: '#B0432E', fontWeight: 600 }}>{error}</div>}

              <div style={{ fontSize: 13, lineHeight: 1.55, color: '#A89070' }}>
                18+ only. Every member is ID verified and selfie matched before going live.
              </div>

              <button
                onClick={create}
                disabled={loading}
                style={{ ...btn, opacity: loading ? 0.7 : 1 }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(90deg, #E0A14A 0%, #C4832A 100%)'; }}
                onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(90deg, #C4832A 0%, #A45E18 100%)'; }}
                onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 15, color: '#A89070' }}>
                Already have an account?{' '}
                <Link to="/signin" style={{ color: '#C4832A', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
