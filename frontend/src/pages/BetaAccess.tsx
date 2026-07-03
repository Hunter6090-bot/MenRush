import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const btn: React.CSSProperties = {
  border: 0, cursor: 'pointer', borderRadius: 999, padding: '17px 24px',
  fontFamily: 'inherit', fontSize: 17, fontWeight: 700, color: '#FFF6E6',
  background: 'linear-gradient(90deg, #C4832A 0%, #A45E18 100%)',
  boxShadow: '0 0 24px rgba(196,131,42,.3)',
  transition: 'background 240ms cubic-bezier(.16,1,.3,1), transform 100ms',
};

const footerLinks = ['CONTACT', 'SAFETY', 'GUIDELINES', 'HELP', 'PRIVACY', 'COOKIE POLICY', 'TERMS & CONDITIONS'];

export const BetaAccess = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = () => {
    const trimmed = code.trim().toUpperCase();
    if (!/^MR-BETA-[A-Z0-9]{4,}$/.test(trimmed)) {
      setError('That code is not valid. Check your invite email.');
      return;
    }
    navigate(`/register?code=${encodeURIComponent(trimmed)}`);
  };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); };

  return (
    <div style={{ minHeight: '100dvh', background: '#0D0A06', color: '#F0E0C0', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('/images/21-pride-parade-flags.jpeg')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.3 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,10,6,.6) 0%, rgba(13,10,6,.85) 60%, rgba(13,10,6,.97) 100%)' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', padding: '32px 24px 64px', boxSizing: 'border-box', flex: 1 }}>
        {/* Header */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: '#F0E0C0', marginBottom: 40 }}>
          <img src="/menrush-logo.png" alt="MenRush" style={{ width: 52, height: 52, borderRadius: '50%', boxShadow: '0 0 0 2px rgba(196,131,42,.4)' }} />
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.14em' }}>MENRUSH</span>
        </Link>

        <h1 style={{ margin: 0, fontWeight: 900, fontSize: 'clamp(38px, 7vw, 62px)', lineHeight: 1.04, letterSpacing: '-0.01em', textWrap: 'balance' as any }}>
          Beta access is <span style={{ color: '#C4832A' }}>invite-only.</span>
        </h1>
        <p style={{ margin: '22px 0 0', fontSize: 17, lineHeight: 1.6, color: '#A89070', maxWidth: 500 }}>
          MenRush hasn't launched publicly yet. If you were selected for beta, enter the unique code from your invite email below.
        </p>

        {/* Form card */}
        <div style={{ marginTop: 34, border: '1px solid rgba(240,224,192,.35)', borderRadius: 24, padding: '28px 24px', background: 'rgba(13,10,6,.45)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', color: '#E0A14A' }}>BETA INVITE CODE</label>
            <input
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={onKey}
              placeholder="E.G. MR-BETA-XXXX"
              style={{ background: '#F5EBD8', border: 0, outline: 'none', borderRadius: 16, padding: '18px 24px', fontSize: 17, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: '0.14em', textTransform: 'uppercase', color: '#2A1C0A', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          {error && <div style={{ fontSize: 14, color: '#B0432E', fontWeight: 600 }}>{error}</div>}
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: '#A89070' }}>
            Codes are single-use and tied to selected waitlist members. No code?{' '}
            <Link to="/" style={{ color: '#C4832A', fontWeight: 700, textDecoration: 'none' }}>Join the waitlist.</Link>
          </p>
          <button
            onClick={submit}
            style={btn}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(90deg, #E0A14A 0%, #C4832A 100%)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(90deg, #C4832A 0%, #A45E18 100%)'; }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >
            Continue
          </button>
          <div style={{ textAlign: 'center', fontSize: 15, color: '#A89070' }}>
            Already have an account?{' '}
            <Link to="/signin" style={{ color: '#C4832A', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
          </div>
        </div>
      </div>

      {/* Site footer */}
      <div style={{ position: 'relative', background: 'rgba(13,10,6,.92)', borderTop: '1px solid #3D2B0E', padding: '28px 24px 40px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 34, rowGap: 18, fontSize: 13, fontWeight: 600, letterSpacing: '0.18em', color: '#A89070' }}>
          {footerLinks.map(l => (
            <a key={l} href="#" style={{ color: 'inherit', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
      </div>
    </div>
  );
};
