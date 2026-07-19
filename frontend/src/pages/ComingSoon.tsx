import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { trackEvent, trackEventOnce } from '../observability/analytics';
import { publicLinkClass, publicNavLinkPrimary } from '../lib/publicStyles';

const API_BASE_URL = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const WAITLIST_API_URL = `${API_BASE_URL}/waitlist`;
const ZOHO_SUBMIT_URL =
  'https://forms.zohopublic.com/hellomen1/form/MenRushcom/formperma/ridAzzP0GwTafugVKgaUQttHXDojK1z_jZpTDjtAor4/records';

const COMING_SOON_BG = '/images/menrush/31-london-rooftop-dusk.jpeg';
const COMING_SOON_GRADIENT =
  'linear-gradient(180deg, rgba(13,10,6,.55) 0%, rgba(13,10,6,.8) 55%, rgba(13,10,6,.97) 100%)';

export const ComingSoon = () => {
  const { hash } = useLocation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'coming_soon' });
  }, []);

  useEffect(() => {
    if (hash === '#waitlist') {
      document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hash]);

  const handleWaitlistSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (submitting || submitted) return;

      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        trackEvent('waitlist_failed', { stage: 'validation', transport: 'none' });
        setErrorMsg('Please enter a valid email address.');
        return;
      }

      trackEvent('waitlist_attempted', { transport: 'backend' });
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      try {
        const response = await fetch(WAITLIST_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, source: 'menrush.com' }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          const message = data?.error || 'Could not join the waitlist right now. Please try again.';
          throw new Error(message);
        }

        const alreadySubscribed = Boolean(data?.already_subscribed);

        setSubmitted(true);
        trackEvent('waitlist_succeeded', {
          transport: 'backend',
          already_subscribed: alreadySubscribed,
        });
        setSuccessMsg(
          alreadySubscribed
            ? "You're already on the list. Check your inbox for the beta invite if you haven't used it yet."
            : "You're on the list. Check your email — we'll send a link if you want to join the beta now.",
        );
        setEmail('');

        void fetch(ZOHO_SUBMIT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ Email: trimmed }),
        }).catch(() => undefined);
      } catch (error) {
        trackEvent('waitlist_failed', { stage: 'request', transport: 'backend' });
        const message = error instanceof Error ? error.message : 'Could not join the waitlist right now.';
        setErrorMsg(message);
      } finally {
        setSubmitting(false);
      }
    },
    [email, submitted, submitting],
  );

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0D0A06] px-6 py-16 text-center text-[#F0E0C0]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.35]"
        style={{ backgroundImage: `url(${COMING_SOON_BG})` }}
        aria-hidden
      />
      <div className="absolute inset-0" style={{ background: COMING_SOON_GRADIENT }} aria-hidden />

      <Link to="/login" className={`absolute right-6 top-6 z-20 ${publicNavLinkPrimary}`}>
        Already have an invite? Sign in
      </Link>

      <div className="relative z-10 flex w-full max-w-[900px] flex-col items-center">
        <BrandMark size="hero" className="mb-[34px]" />

        <p className="mr-coming-soon-overline mb-[22px]">MENRUSH · COMING SOON</p>

        <h1 className="mr-coming-soon-heading max-w-[900px] text-balance">
          Real men.
          <br />
          <span className="mr-coming-soon-accent">Verified bodies.</span>
          <br />
          Total discretion.
        </h1>

        <p className="mt-[26px] max-w-[620px] text-pretty text-[clamp(15px,2vw,19px)] leading-[1.6] text-[#F0E0C0]">
          MenRush checks every member with ID and selfie matching, so you know exactly who you&apos;re
          meeting.{' '}
          <strong className="font-bold text-[#E0A14A]">No bots. No catfish. No scam profiles.</strong>
        </p>

        <p className="mt-3.5 max-w-[560px] text-sm leading-[1.6] text-[var(--cream-muted)]">
          Your identity stays private. Your profile stays discreet. No time wasters.
        </p>

        <div id="waitlist" className="relative mt-[38px] w-full max-w-[460px]">
          {submitted && successMsg ? (
            <div className="rounded-[14px] border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.12)] px-5 py-[18px] text-[15px] font-bold tracking-[0.06em] text-[#E0A14A]">
              {successMsg}
            </div>
          ) : (
            <form
              onSubmit={handleWaitlistSubmit}
              noValidate
              className="flex gap-2 rounded-full border border-[#3D2B0E] bg-[#1E1508] p-1.5 pl-[22px] shadow-[0_10px_36px_rgba(0,0,0,0.5)]"
            >
              <input
                id="waitlist-email"
                type="email"
                name="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email — never shown, never shared"
                required
                autoComplete="email"
                inputMode="email"
                disabled={submitting}
                className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-[#F0E0C0] placeholder:text-[var(--cream-muted)]/80 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={submitting}
                className="shrink-0 rounded-full border-0 bg-[#C4832A] px-[22px] py-3 text-xs font-extrabold tracking-[0.12em] text-[#1A0E03] shadow-[0_0_24px_rgba(196,131,42,0.4)] transition-colors hover:bg-[#E0A14A] disabled:opacity-50"
              >
                {submitting ? 'Joining…' : 'Join the verified waitlist'}
              </button>
            </form>
          )}
          {errorMsg ? <p className="mt-3 text-sm font-medium text-[#B0432E]">{errorMsg}</p> : null}
        </div>

        <p className="relative mt-11 text-[17px] font-bold uppercase tracking-[0.08em] text-[#F0E0C0]">
          &ldquo;Your next nearby meet is real.&rdquo;
        </p>

        <p className="relative mt-[26px] text-[11px] font-semibold tracking-[0.22em] text-[#6B5840]">
          LONDON · MANCHESTER · BIRMINGHAM · BRIGHTON
        </p>
        <p className="relative mt-3 text-[11px] text-[#6B5840]">
          Every member ID verified and selfie matched.
        </p>

        <p className="relative mt-8 text-sm text-[var(--cream-muted)]">
          Selected for beta?{' '}
          <Link to="/beta" className={publicLinkClass}>
            Enter your invite code
          </Link>
        </p>
      </div>
    </div>
  );
};
