import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from '../components/SiteFooter';
import { CoinFlip } from '../components/CoinFlip';
import { RandomBackground } from '../components/RandomBackground';
import { trackEvent, trackEventOnce } from '../observability/analytics';

const API_BASE_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const IS_LOCAL_API = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(API_BASE_URL);
const WAITLIST_API_URL = API_BASE_URL && (!IS_LOCAL_API || import.meta.env.DEV)
  ? `${API_BASE_URL}/waitlist`
  : null;
const ZOHO_SUBMIT_URL =
  'https://forms.zohopublic.com/hellomen1/form/MenRushcom/formperma/ridAzzP0GwTafugVKgaUQttHXDojK1z_jZpTDjtAor4/records';

export const ComingSoon = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'coming_soon' });
  }, []);

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

      trackEvent('waitlist_attempted', {
        transport: WAITLIST_API_URL ? 'backend' : 'zoho_fallback',
      });
      setSubmitting(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      try {
        let alreadySubscribed = false;
        if (WAITLIST_API_URL) {
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
          alreadySubscribed = Boolean(data?.already_subscribed);
        }

        setSubmitted(true);
        trackEvent('waitlist_succeeded', {
          transport: WAITLIST_API_URL ? 'backend' : 'zoho_fallback',
          already_subscribed: alreadySubscribed,
        });
        setSuccessMsg(
          alreadySubscribed
            ? "You're already on the list. Keep an eye on your inbox."
            : "You're on the list. Keep an eye on your inbox.",
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
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      <RandomBackground />
      <div className="pointer-events-none absolute inset-0 bg-[#0D0A06]/38" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#0D0A06_0%,rgba(13,10,6,0.55)_38%,rgba(13,10,6,0.18)_72%,rgba(13,10,6,0.45)_100%)]" />

      <header className="relative z-20 flex h-16 shrink-0 items-center justify-end px-5 sm:px-8 lg:px-10">
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link
            to="/login"
            className="rounded-lg px-3.5 py-2 text-[#A89070] transition-colors hover:text-[#F0E0C0]"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-lg border border-[#C4832A]/45 bg-[#C4832A]/15 px-3.5 py-2 text-[#F0E0C0] transition-colors hover:bg-[#C4832A]/25"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <main id="top" className="relative z-10 flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-7xl flex-1 items-center px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
          <div className="max-w-2xl">
            <CoinFlip qrValue="https://menrush.com" sizeClass="h-28 sm:h-32" noFlip />

            <h1 className="mr-hero-heading mt-7">
              Coming soon.
              <span className="mr-hero-accent">Closer than ever.</span>
            </h1>

            <p className="mr-copy mt-5 max-w-xl">
              Men nearby, right now — no swiping, no waiting. Join the waitlist and be first in
              when we open the doors.
            </p>

            <div id="waitlist" className="mt-8 max-w-xl">
              {submitted && successMsg ? (
                <p className="text-base font-semibold text-[#C4832A]">{successMsg}</p>
              ) : (
                <form onSubmit={handleWaitlistSubmit} noValidate className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    name="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    inputMode="email"
                    aria-label="Email address"
                    disabled={submitting}
                    className="min-h-12 flex-1 rounded-lg border border-[#3D2B0E] bg-[#1E1508]/72 px-4 text-sm text-[#F0E0C0] placeholder:text-[#A89070]/55 focus:border-[#C4832A]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/25 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-12 rounded-lg bg-[#C4832A] px-6 text-sm font-black uppercase tracking-[0.08em] text-[#0D0A06] transition-all duration-200 hover:bg-[#E0A14A] active:scale-[0.98] disabled:opacity-50 sm:whitespace-nowrap"
                  >
                    {submitting ? 'Joining…' : 'Join waitlist'}
                  </button>
                </form>
              )}

              {errorMsg && <p className="mt-3 text-sm font-medium text-[#f0a07a]">{errorMsg}</p>}

              <p className="mt-4 text-sm text-[#A89070]">
                Early members get{' '}
                <span className="font-semibold text-[#C4832A]">30 days Premium free</span> at
                launch.
              </p>

              <p className="mt-3 text-sm leading-6 text-[#A89070]/90">
                <span className="font-semibold text-[#C4832A]">Beta 200:</span> we&apos;ll invite
                200 waitlist members to test early. Thoughtful feedback earns a year of Premium.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter className="relative z-10 mt-auto w-full shrink-0" />
    </div>
  );
};
