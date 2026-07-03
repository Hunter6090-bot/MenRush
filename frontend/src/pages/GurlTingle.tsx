import { useState, useCallback } from 'react';

const API_BASE_URL = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const IMAGES = [
  '/images/menrush/21-pride-parade-flags.jpeg',
  '/images/menrush/16-amsterdam-neon-night.jpeg',
  '/images/menrush/02-soho-night-crowd.jpeg',
  '/images/menrush/31-london-rooftop-dusk.jpeg',
];

export const GurlTingle = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bgIndex] = useState(() => Math.floor(Math.random() * IMAGES.length));

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting || submitted) return;

      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }

      setSubmitting(true);
      setErrorMsg(null);

      try {
        const res = await fetch(`${API_BASE_URL}/waitlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, source: 'gurltingle.com' }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Could not join the waitlist right now.');
        const already = Boolean(data?.already_subscribed);
        setSubmitted(true);
        setSuccessMsg(already ? "You're already on the list. Keep an eye on your inbox." : "You're on the list. We'll be in touch.");
        setEmail('');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Could not join the waitlist right now.');
      } finally {
        setSubmitting(false);
      }
    },
    [email, submitted, submitting],
  );

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, []);

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#15060F] text-[#FFE4EC]"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", padding: '64px 24px', boxSizing: 'border-box', textAlign: 'center' }}
    >
      {/* Background photo */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${IMAGES[bgIndex]}')`, opacity: 0.35 }}
      />
      {/* Gradient scrim */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(21,6,15,.55) 0%, rgba(21,6,15,.8) 55%, rgba(21,6,15,.97) 100%)' }}
      />
      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_20%,rgba(233,30,99,0.18),transparent)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center">

        {/* Logo */}
        <div
          className="mb-[34px] flex h-[110px] w-[110px] items-center justify-center rounded-full bg-gradient-to-br from-[#FF6FA5] via-[#E91E63] to-[#9C1458]"
          style={{ boxShadow: '0 4px 32px rgba(233,30,99,0.45)' }}
        >
          <span className="text-4xl font-black tracking-tight text-white">GT</span>
        </div>

        {/* Overline */}
        <div className="mb-[22px] text-xs font-bold tracking-[0.32em] text-[#E91E63]">
          GURLTINGLE · COMING SOON
        </div>

        {/* H1 */}
        <h1
          className="m-0 max-w-[900px] font-black uppercase leading-[1.05] tracking-[0.04em]"
          style={{ fontSize: 'clamp(34px, 6vw, 64px)' }}
        >
          Real women.<br />
          <span style={{ color: '#FF6FA5' }}>Verified profiles.</span><br />
          Total discretion.
        </h1>

        {/* Body copy */}
        <p
          className="mt-[26px] max-w-[620px] leading-[1.6] text-[#FFE4EC]"
          style={{ fontSize: 'clamp(15px, 2vw, 19px)' }}
        >
          GurlTingle checks every member with ID and selfie matching, so you know exactly who you're meeting.{' '}
          <strong className="font-bold" style={{ color: '#FFAACC' }}>No bots. No catfish. No fake profiles.</strong>
        </p>
        <p className="mt-[14px] max-w-[560px] text-sm leading-[1.6]" style={{ color: '#E0A8C0' }}>
          Your identity stays private. Your profile stays discreet. No time wasters.
        </p>

        {/* Waitlist */}
        <div className="mt-[38px] w-full max-w-[460px]">
          {submitted && successMsg ? (
            <div
              style={{
                padding: '18px 20px',
                borderRadius: 14,
                background: 'rgba(233,30,99,.12)',
                border: '1px solid rgba(233,30,99,.45)',
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: '#FF6FA5',
              }}
            >
              {successMsg}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  background: '#2A0F1F',
                  border: '1px solid #4A1B30',
                  borderRadius: 999,
                  padding: '6px 6px 6px 22px',
                  boxShadow: '0 10px 36px rgba(0,0,0,.5)',
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErrorMsg(null); }}
                  placeholder="Your email — never shown, never shared"
                  required
                  disabled={submitting}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 0,
                    outline: 'none',
                    color: '#FFE4EC',
                    fontSize: 14,
                    fontFamily: 'inherit',
                    padding: '10px 0',
                  }}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flexShrink: 0,
                    padding: '12px 22px',
                    borderRadius: 999,
                    border: 0,
                    cursor: 'pointer',
                    background: '#E91E63',
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.12em',
                    boxShadow: '0 0 24px rgba(233,30,99,.4)',
                    transition: 'background 240ms',
                    opacity: submitting ? 0.6 : 1,
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#FF2F74')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#E91E63')}
                >
                  {submitting ? 'JOINING…' : 'JOIN THE WAITLIST'}
                </button>
              </div>
            </form>
          )}
          {errorMsg && (
            <p className="mt-3 text-sm font-medium" style={{ color: '#FF6FA5' }}>{errorMsg}</p>
          )}
        </div>

        {/* Quote */}
        <p
          className="mt-[44px] font-bold uppercase tracking-[0.08em] text-[#FFE4EC]"
          style={{ fontSize: 17 }}
        >
          "Your next nearby meet is real."
        </p>

        {/* Cities */}
        <div className="mt-[26px] text-[11px] font-semibold tracking-[0.22em]" style={{ color: '#7B3055' }}>
          LONDON · MANCHESTER · BIRMINGHAM · BRIGHTON
        </div>
        <div className="mt-3 text-[11px]" style={{ color: '#7B3055' }}>
          18+ only. Every member ID verified and selfie matched.
        </div>

        {/* Share */}
        <button
          onClick={handleShare}
          className="mt-8 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 active:scale-[0.97]"
          style={{
            border: '1px solid #4A1B30',
            background: 'rgba(42,15,31,.6)',
            color: '#E0A8C0',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(233,30,99,.4)';
            (e.currentTarget as HTMLElement).style.color = '#FFE4EC';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#4A1B30';
            (e.currentTarget as HTMLElement).style.color = '#E0A8C0';
          }}
        >
          <ShareIcon className="h-4 w-4" />
          {copied ? 'Link copied!' : 'Share with a friend'}
        </button>
      </div>
    </div>
  );
};

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);
