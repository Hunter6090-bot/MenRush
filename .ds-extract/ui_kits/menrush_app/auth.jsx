// MenRush — auth flow screens.
// Login, Register, ForgotPassword, ResetPassword
// Pattern matches the legacy repo's Login/Register: full-bleed photography background slideshow,
// 55% black overlay, glass card centered. Same shape, copper-rebranded.
// Globals: MR_PALETTE, Icon, Button, PulsingAvatar

const AUTH_BG_IMAGES = [
  '../../assets/photos/01-rooftop-skyline-bears.jpeg',  // late rooftop, city, mixed bodies
  '../../assets/photos/02-soho-night-crowd.jpeg',       // soho neon, crowd
  '../../assets/photos/04-leather-harness-bears.jpeg',  // leather + bear + smile
  '../../assets/photos/16-amsterdam-neon-night.jpeg',   // amsterdam wet street
  '../../assets/photos/22-daddy-twink-bar.jpeg',        // intimate pair in bar
  '../../assets/photos/27-golden-beach-sunset.jpeg',    // warm beach, light counterbalance
  '../../assets/photos/31-london-rooftop-dusk.jpeg',    // dusk rooftop, sweat
  '../../assets/photos/36-wet-street-bar-line.jpeg',    // rain + bar line
  '../../assets/photos/41-twink-jock-neon-street.jpeg', // two men, neon
  '../../assets/photos/47-rooftop-berlin-night.jpeg',   // berlin rooftop dusk
];

// One photo per session — picked at random on load, then static (no slideshow).
function useAuthBg() {
  const [i] = React.useState(() => Math.floor(Math.random() * AUTH_BG_IMAGES.length));
  return { src: AUTH_BG_IMAGES[i], fade: true };
}

// Shared auth shell
function AuthShell({ children }) {
  const { src, fade } = useAuthBg();
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 18, zIndex: 50, background: MR_PALETTE.bg,
    }}>
      {/* bg slideshow */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: fade ? 1 : 0, transition: 'opacity .7s ease',
        filter: 'saturate(1.05) brightness(0.95)',
      }} />
      {/* warm overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, rgba(13,10,6,.5) 0%, rgba(13,10,6,.75) 60%, rgba(13,10,6,.92) 100%)`,
      }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 360, animation: 'nn-slide-up .45s cubic-bezier(.16,1,.3,1)' }}>
        {children}
      </div>
    </div>
  );
}

const authInput = {
  width: '100%', background: 'rgba(13,10,6,.5)', border: `1px solid ${MR_PALETTE.border}`,
  color: MR_PALETTE.text, padding: '14px 16px', borderRadius: 12, fontSize: 14,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const authLabel = {
  display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
  color: MR_PALETTE.muted, textTransform: 'uppercase', marginBottom: 6,
};

function AuthBranding({ tagline = 'See who\'s near you right now.' }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 22 }}>
      <img src="../../assets/logo.png" alt="MenRush" style={{ width: 86, height: 86, borderRadius: '24%', boxShadow: '0 12px 32px rgba(0,0,0,.6)' }} />
      <h1 style={{
        margin: '14px 0 4px', fontFamily: 'Inter, sans-serif', fontSize: 26, fontWeight: 900,
        letterSpacing: '0.12em', textTransform: 'uppercase', color: MR_PALETTE.text,
      }}>MENRUSH</h1>
      <p style={{ fontSize: 12.5, color: MR_PALETTE.muted, margin: 0, letterSpacing: '0.02em' }}>{tagline}</p>
    </div>
  );
}

function AuthCard({ children }) {
  return (
    <div style={{
      background: 'rgba(30,21,8,.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: `1px solid ${MR_PALETTE.border}`,
      borderRadius: 20, padding: 22, boxShadow: '0 24px 80px rgba(0,0,0,.7)',
    }}>{children}</div>
  );
}

// ── Login ───────────────────────────────────────────────────
function LoginScreen({ onSubmit, onRegister, onForgot }) {
  const [email, setEmail] = React.useState('marcus@menrush.app');
  const [password, setPassword] = React.useState('');
  return (
    <AuthShell>
      <AuthBranding />
      <AuthCard>
        <h2 style={authH2}>Welcome back</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={authLabel}>EMAIL</label>
            <input style={authInput} value={email} onChange={e => setEmail(e.target.value)} type="email" />
          </div>
          <div>
            <label style={authLabel}>PASSWORD</label>
            <input style={authInput} value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onForgot} style={authLinkBtn}>Forgot password?</button>
          </div>
          <Button variant="primary" full size="lg" onClick={onSubmit}>SIGN IN</Button>
        </div>
        <p style={authFoot}>
          No account? <button onClick={onRegister} style={authInlineLink}>Create one</button>
        </p>
      </AuthCard>
    </AuthShell>
  );
}

// ── Register ────────────────────────────────────────────────
function RegisterScreen({ onSubmit, onSignIn }) {
  const [form, setForm] = React.useState({ name: 'Marcus', email: '', age: '', password: '' });
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  return (
    <AuthShell>
      <AuthBranding tagline="No waiting. No swiping. Just men nearby." />
      <AuthCard>
        <h2 style={authH2}>Create account</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={authLabel}>NAME</label>
            <input style={authInput} value={form.name} onChange={set('name')} placeholder="What men will call you" />
          </div>
          <div>
            <label style={authLabel}>EMAIL</label>
            <input style={authInput} value={form.email} onChange={set('email')} type="email" placeholder="you@example.com" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
            <div>
              <label style={authLabel}>AGE</label>
              <input style={authInput} value={form.age} onChange={set('age')} type="number" placeholder="25" />
            </div>
            <div>
              <label style={authLabel}>PASSWORD</label>
              <input style={authInput} value={form.password} onChange={set('password')} type="password" placeholder="Min 8 chars" />
            </div>
          </div>
          <p style={{ fontSize: 11, color: MR_PALETTE.faint, lineHeight: 1.5, margin: '4px 0 4px' }}>
            By creating an account you confirm you're 18+ and agree to the&nbsp;
            <span style={{ color: MR_PALETTE.copper }}>Community Guidelines</span>.
          </p>
          <Button variant="primary" full size="lg" onClick={onSubmit}>CREATE ACCOUNT</Button>
        </div>
        <p style={authFoot}>
          Already a member? <button onClick={onSignIn} style={authInlineLink}>Sign in</button>
        </p>
      </AuthCard>
    </AuthShell>
  );
}

// ── Forgot password ─────────────────────────────────────────
function ForgotScreen({ onSubmit, onBack }) {
  const [email, setEmail] = React.useState('');
  return (
    <AuthShell>
      <AuthBranding tagline="We'll send you a reset link." />
      <AuthCard>
        <h2 style={authH2}>Reset password</h2>
        <p style={{ fontSize: 13, color: MR_PALETTE.muted, lineHeight: 1.5, margin: '0 0 14px' }}>
          Enter the email tied to your account. We'll send a link.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={authLabel}>EMAIL</label>
            <input style={authInput} value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" />
          </div>
          <Button variant="primary" full size="lg" onClick={onSubmit}>SEND RESET LINK</Button>
        </div>
        <p style={authFoot}>
          Remembered it? <button onClick={onBack} style={authInlineLink}>Back to sign in</button>
        </p>
      </AuthCard>
    </AuthShell>
  );
}

// ── Reset password (after clicking link) ────────────────────
function ResetScreen({ onSubmit, onBack }) {
  const [p1, setP1] = React.useState('');
  const [p2, setP2] = React.useState('');
  const matches = p1.length >= 8 && p1 === p2;
  return (
    <AuthShell>
      <AuthBranding tagline="Set a new password." />
      <AuthCard>
        <h2 style={authH2}>New password</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={authLabel}>NEW PASSWORD</label>
            <input style={authInput} value={p1} onChange={e => setP1(e.target.value)} type="password" placeholder="Min 8 chars" />
          </div>
          <div>
            <label style={authLabel}>CONFIRM</label>
            <input style={{ ...authInput, borderColor: p2 && !matches ? MR_PALETTE.danger : MR_PALETTE.border }}
              value={p2} onChange={e => setP2(e.target.value)} type="password" placeholder="Repeat it" />
            {p2 && !matches && (
              <div style={{ fontSize: 11, color: '#C46A53', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="x" size={11} strokeWidth={2.5} /> Passwords don't match
              </div>
            )}
            {matches && (
              <div style={{ fontSize: 11, color: '#8FC773', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="check" size={11} strokeWidth={2.5} /> Match
              </div>
            )}
          </div>
          <Button variant="primary" full size="lg" onClick={onSubmit} disabled={!matches}>SAVE & SIGN IN</Button>
        </div>
        <p style={authFoot}>
          <button onClick={onBack} style={authInlineLink}>Back to sign in</button>
        </p>
      </AuthCard>
    </AuthShell>
  );
}

const authH2 = {
  margin: '0 0 14px', fontFamily: 'Inter, sans-serif', fontSize: 18, fontWeight: 800,
  letterSpacing: '0.02em', color: MR_PALETTE.text,
};
const authFoot = {
  textAlign: 'center', marginTop: 18, marginBottom: 0,
  fontSize: 12, color: MR_PALETTE.muted,
};
const authInlineLink = {
  background: 'transparent', border: 0, color: MR_PALETTE.copper, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
};
const authLinkBtn = {
  ...authInlineLink, padding: '4px 0', marginTop: -4,
};

Object.assign(window, {
  LoginScreen, RegisterScreen, ForgotScreen, ResetScreen, AuthShell, AuthBranding, AuthCard,
});
