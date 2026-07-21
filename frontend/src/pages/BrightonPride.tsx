import { useState, FormEvent } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const CAMPAIGN = 'brightonpride26';

type Stage = 'form' | 'submitting' | 'success' | 'error';

export function BrightonPride() {
  const [email, setEmail]   = useState('');
  const [stage, setStage]   = useState<Stage>('form');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStage('submitting');

    try {
      await axios.post(`${API}/campaigns/${CAMPAIGN}/signup`, { email: email.trim() });
      setStage('success');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        'Something went wrong. Please try again in a moment.';
      setErrorMsg(msg);
      setStage('error');
    }
  }

  return (
    <div style={styles.root}>
      {/* Rainbow stripe */}
      <div style={styles.rainbow} />

      <div style={styles.container}>
        {/* Brand */}
        <div style={styles.brand}>MENRUSH</div>

        {/* Event badge */}
        <div style={styles.badge}>Brighton Pride · August 2026</div>

        {/* Headline */}
        <h1 style={styles.headline}>
          Who's near you<br />
          <span style={styles.headlineAccent}>right now?</span>
        </h1>

        <p style={styles.tagline}>
          No swiping. No chatting for weeks.<br />
          Real men. Real close. Launching 1 October 2026.
        </p>

        {/* Offer box */}
        <div style={styles.offerBox}>
          <div style={styles.offerLabel}>Brighton Pride Special Offer</div>
          <div style={styles.offerText}>3 Months Free Premium</div>
        </div>

        {/* Form or success */}
        {stage === 'success' ? (
          <div style={styles.successBox}>
            <div style={styles.successTitle}>Check your inbox.</div>
            <p style={styles.successBody}>
              Your personal code is on its way to <strong>{email}</strong>.
              It's locked to that address — keep the email safe.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form} noValidate>
            <div style={styles.inputRow}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={stage === 'submitting'}
                style={styles.input}
              />
              <button
                type="submit"
                disabled={stage === 'submitting' || !email.trim()}
                style={{
                  ...styles.button,
                  ...(stage === 'submitting' ? styles.buttonDisabled : {}),
                }}
              >
                {stage === 'submitting' ? 'Sending…' : 'Claim my code'}
              </button>
            </div>

            {stage === 'error' && (
              <p style={styles.errorText}>{errorMsg}</p>
            )}

            <p style={styles.formNote}>
              You'll receive a personal code locked to your email address.
              It activates 3 months of free Premium when the app launches.
            </p>
          </form>
        )}

        {/* Trust signals */}
        <div style={styles.trustRow}>
          <span style={styles.trustItem}>18+ platform</span>
          <span style={styles.trustDot}>·</span>
          <span style={styles.trustItem}>Free verification for all users</span>
          <span style={styles.trustDot}>·</span>
          <span style={styles.trustItem}>No card required now</span>
        </div>

        {/* Fine print */}
        <p style={styles.finePrint}>
          New members only. One offer per person. Redeem by 31&nbsp;Oct&nbsp;2026.
          Premium activates at launch (1&nbsp;Oct&nbsp;2026). Cannot be combined
          with other offers. Bronze&nbsp;Apps&nbsp;UK&nbsp;Limited — Co.&nbsp;No.&nbsp;17249857.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#0D0A06',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
  },

  rainbow: {
    width: '100%',
    height: '10px',
    background:
      'linear-gradient(to right, #E40303 0%, #E40303 14.3%, #FF8C00 14.3%, #FF8C00 28.6%, #FFED00 28.6%, #FFED00 42.9%, #008026 42.9%, #008026 57.1%, #004DFF 57.1%, #004DFF 71.4%, #750787 71.4%, #750787 85.7%, #FFFFFF 85.7%, #FFFFFF 100%)',
    flexShrink: 0,
  },

  container: {
    flex: 1,
    maxWidth: '520px',
    width: '100%',
    margin: '0 auto',
    padding: '48px 24px 64px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },

  brand: {
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '6px',
    color: '#C4832A',
    textTransform: 'uppercase',
    marginBottom: '16px',
  },

  badge: {
    display: 'inline-block',
    border: '1px solid rgba(196,131,42,0.4)',
    padding: '5px 14px',
    fontSize: '11px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#C4832A',
    marginBottom: '28px',
  },

  headline: {
    fontSize: 'clamp(32px, 8vw, 52px)',
    fontWeight: 900,
    color: '#F0E0C0',
    textTransform: 'uppercase',
    lineHeight: 1.0,
    letterSpacing: '-1px',
    margin: '0 0 16px',
  },

  headlineAccent: {
    color: '#C4832A',
  },

  tagline: {
    fontSize: '15px',
    color: '#6a5a4a',
    lineHeight: 1.7,
    margin: '0 0 32px',
  },

  offerBox: {
    background: '#C4832A',
    padding: '18px 28px',
    width: '100%',
    marginBottom: '36px',
  },

  offerLabel: {
    fontSize: '9px',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    color: '#0D0A06',
    opacity: 0.6,
    marginBottom: '6px',
  },

  offerText: {
    fontSize: '22px',
    fontWeight: 900,
    color: '#0D0A06',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  form: {
    width: '100%',
    marginBottom: '28px',
  },

  inputRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },

  input: {
    flex: 1,
    padding: '14px 16px',
    background: '#1a1410',
    border: '1px solid #2a2010',
    color: '#F0E0C0',
    fontSize: '15px',
    outline: 'none',
    fontFamily: 'system-ui, sans-serif',
    minWidth: 0,
  },

  button: {
    padding: '14px 20px',
    background: '#C4832A',
    border: 'none',
    color: '#0D0A06',
    fontSize: '14px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'system-ui, sans-serif',
  },

  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  errorText: {
    fontSize: '13px',
    color: '#d44',
    marginTop: '8px',
    textAlign: 'left',
  },

  formNote: {
    fontSize: '12px',
    color: '#3a2a1a',
    marginTop: '12px',
    lineHeight: 1.6,
    textAlign: 'left',
  },

  successBox: {
    width: '100%',
    border: '1px solid rgba(196,131,42,0.3)',
    padding: '24px 28px',
    marginBottom: '28px',
    textAlign: 'left',
  },

  successTitle: {
    fontSize: '20px',
    fontWeight: 900,
    color: '#C4832A',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '10px',
  },

  successBody: {
    fontSize: '14px',
    color: '#7a6a5a',
    lineHeight: 1.7,
    margin: 0,
  },

  trustRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: '24px',
  },

  trustItem: {
    fontSize: '11px',
    letterSpacing: '1px',
    color: '#3a2a1a',
    textTransform: 'uppercase',
  },

  trustDot: {
    color: '#2a1a0a',
    fontSize: '11px',
  },

  finePrint: {
    fontSize: '10px',
    color: '#2a1a0a',
    lineHeight: 1.7,
    maxWidth: '400px',
    margin: '0 auto',
  },
};
