import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CoinFlip } from '../components/CoinFlip';
import { PublicHeroBlock, PublicMarketingShell } from '../components/PublicMarketingShell';
import { trackEvent, trackEventOnce } from '../observability/analytics';
import {
  publicInputClass,
  publicLabelClass,
  publicNavLinkSecondary,
  publicPanelClass,
  publicPrimaryButtonClass,
  publicHeroLogoClass,
} from '../lib/publicStyles';

const API_BASE_URL = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const WAITLIST_API_URL = `${API_BASE_URL}/waitlist`;
const ZOHO_SUBMIT_URL =
  'https://forms.zohopublic.com/hellomen1/form/MenRushcom/formperma/ridAzzP0GwTafugVKgaUQttHXDojK1z_jZpTDjtAor4/records';

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
    <PublicMarketingShell
      header={
        <Link to="/login" className={publicNavLinkSecondary}>
          Already have an invite? Sign in
        </Link>
      }
      hero={
        <>
          <CoinFlip qrValue="https://menrush.com" sizeClass={publicHeroLogoClass} noFlip />
          <PublicHeroBlock
            title="MenRush"
            accent="Men. Here. Now."
            copy="See who's near you right now. No swiping, no waiting."
            footerNote={
              <>
                <span className="font-semibold text-[#C4832A]">Beta 200:</span> we&apos;ll pick 200
                waitlist members at random. Honest feedback earns a year of Premium.
              </>
            }
          />
        </>
      }
      panel={
        <div id="waitlist" className={publicPanelClass}>
          {submitted && successMsg ? (
            <p className="text-base font-semibold text-[#C4832A]">{successMsg}</p>
          ) : (
            <form onSubmit={handleWaitlistSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="waitlist-email" className={publicLabelClass}>
                  Email
                </label>
                <input
                  id="waitlist-email"
                  type="email"
                  name="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  inputMode="email"
                  disabled={submitting}
                  className={publicInputClass}
                />
              </div>
              <button type="submit" disabled={submitting} className={publicPrimaryButtonClass}>
                {submitting ? 'Joining…' : 'Join waitlist'}
              </button>
            </form>
          )}
          {errorMsg && <p className="mt-3 text-sm font-medium text-[#f0a07a]">{errorMsg}</p>}
        </div>
      }
    />
  );
};
