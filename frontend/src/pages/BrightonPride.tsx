import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const CAMPAIGN = 'brightonpride26';

type Stage = 'form' | 'submitting' | 'success' | 'error';

/**
 * Live Brighton Pride campaign page (QR → menrush.com/brightonpride).
 * Email form issues a personal email-locked code — no public shared promo code.
 *
 * Finance lock (current spec; owner may override later):
 * - Pride replaces the 30-day waitlist gift; max 90 days; no stacking to 120.
 * - Enter code by 5 September 2026; Premium clocks from 1 October 2026 (not scan/claim day).
 * - No Premium price on Pride pages. One code per user. No silent global grant.
 */
export function BrightonPride() {
  const [email, setEmail] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [stage, setStage] = useState<Stage>('form');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!adultConfirmed) {
      setErrorMsg('Confirm you are 18 or over to claim this offer.');
      setStage('error');
      return;
    }
    setStage('submitting');
    setErrorMsg('');

    try {
      await axios.post(`${API}/campaigns/${CAMPAIGN}/signup`, {
        email: email.trim(),
        adult_confirmed: true,
      });
      setStage('success');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      const msg =
        ax?.response?.data?.error ||
        'Something went wrong. Please try again in a moment.';
      setErrorMsg(msg);
      setStage('error');
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.rainbow} />

      <div style={styles.container}>
        <img
          src="/brand/medallion-transparent.png"
          alt="MenRush"
          style={styles.logoImg}
        />

        <div style={styles.badge}>Brighton Pride · August 2026</div>

        <h1 style={styles.headline}>
          Who&apos;s near you<br />
          <span style={styles.headlineAccent}>right now?</span>
        </h1>

        <p style={styles.tagline}>
          No swiping. No chatting for weeks.<br />
          Real men. Real close. Launching 1 October 2026.
        </p>

        <div style={styles.offerBox}>
          <div style={styles.offerLabel}>Brighton Pride Special Offer</div>
          <div style={styles.offerText}>3 Months Free Premium</div>
        </div>

        <div style={styles.qrBlock}>
          <img
            src="/brand/qr-brightonpride.png"
            alt="Scan to claim your 3 months free"
            style={styles.qrImg}
          />
          <div style={styles.qrHint}>menrush.com/brightonpride</div>
        </div>

        {stage === 'success' ? (
          <div style={styles.successBox}>
            <div style={styles.successTitle}>Check your inbox.</div>
            <p style={styles.successBody}>
              Your personal code is on its way to <strong>{email}</strong>.
              It&apos;s locked to that address — keep the email safe. Enter it by
              5&nbsp;September&nbsp;2026. Your 3 months of Premium start on launch
              (1&nbsp;October&nbsp;2026), not the day you claim or scan.
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
                aria-label="Email for Brighton Pride offer"
              />
              <button
                type="submit"
                disabled={stage === 'submitting' || !email.trim() || !adultConfirmed}
                style={{
                  ...styles.button,
                  ...(stage === 'submitting' || !adultConfirmed ? styles.buttonDisabled : {}),
                }}
              >
                {stage === 'submitting' ? 'Sending…' : 'Claim my code'}
              </button>
            </div>

            <label style={styles.adultLabel}>
              <input
                type="checkbox"
                checked={adultConfirmed}
                onChange={(e) => {
                  setAdultConfirmed(e.target.checked);
                  if (e.target.checked && stage === 'error') {
                    setStage('form');
                    setErrorMsg('');
                  }
                }}
                disabled={stage === 'submitting'}
                style={styles.adultCheckbox}
                data-testid="brightonpride-adult-confirm"
              />
              <span>
                I confirm I am 18 or over and agree to the{' '}
                <Link to="/terms" style={styles.inlineLink}>
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" style={styles.inlineLink}>
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {stage === 'error' && <p style={styles.errorText}>{errorMsg}</p>}

            <p style={styles.formNote}>
              You&apos;ll receive a personal code locked to your email address — there is no
              public shared code. Enter that code by 5&nbsp;September&nbsp;2026. The free
              Premium period starts on launch (1&nbsp;October&nbsp;2026) and runs for three
              months — it does not start the day you scan or claim.
            </p>
          </form>
        )}

        <div style={styles.trustRow}>
          <span style={styles.trustItem}>18+ platform</span>
          <span style={styles.trustDot}>·</span>
          <span style={styles.trustItem}>Free verification for all users</span>
          <span style={styles.trustDot}>·</span>
          <span style={styles.trustItem}>No card required now</span>
        </div>

        <div style={styles.finePrintBlock}>
          <p style={styles.finePrint}>
            New members only. One code per user. Enter your personal code by
            5&nbsp;September&nbsp;2026. Premium starts on launch
            (1&nbsp;October&nbsp;2026) and runs for three months / 90 days (through
            1&nbsp;January&nbsp;2027) — not from the day you scan, claim, or redeem.
            Cannot be combined with other offers.
          </p>
          <p style={styles.finePrint}>
            <strong style={styles.finePrintStrong}>Finance lock:</strong> this Brighton Pride
            offer replaces the standard 30-day waitlist Premium gift. A Pride redeemer gets a
            maximum of 90 days (3 months) — not stacked with the waitlist gift to 120 days.
          </p>
          <p style={styles.finePrint}>
            Bronze&nbsp;Apps&nbsp;UK&nbsp;Limited — Co.&nbsp;No.&nbsp;17249857. Registered
            office and full legal terms:{' '}
            <Link to="/terms" style={styles.inlineLink}>
              Terms
            </Link>
            {' · '}
            <Link to="/privacy" style={styles.inlineLink}>
              Privacy
            </Link>
            . Office 9811, 321–323 High Road, Chadwell Heath, Essex, RM6 6AX, England.
          </p>
        </div>
      </div>
    </div>
  );
}

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

  logoImg: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
    marginBottom: '16px',
    display: 'block',
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

  adultLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    textAlign: 'left',
    fontSize: '12px',
    lineHeight: 1.55,
    color: '#7a6a5a',
    marginBottom: '10px',
    cursor: 'pointer',
  },

  adultCheckbox: {
    marginTop: '2px',
    flexShrink: 0,
    accentColor: '#C4832A',
  },

  inlineLink: {
    color: '#C4832A',
    textDecoration: 'underline',
    fontWeight: 700,
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

  finePrintBlock: {
    maxWidth: '420px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },

  finePrint: {
    fontSize: '10px',
    color: '#5a4a3a',
    lineHeight: 1.7,
    margin: 0,
  },

  finePrintStrong: {
    color: '#7a6a5a',
    fontWeight: 800,
  },

  qrBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '10px',
    marginBottom: '36px',
  },

  qrImg: {
    width: '160px',
    height: '160px',
    border: '4px solid #C4832A',
    display: 'block',
  },

  qrHint: {
    fontSize: '10px',
    letterSpacing: '2px',
    textTransform: 'uppercase' as const,
    color: '#3a2a1a',
  },
};
