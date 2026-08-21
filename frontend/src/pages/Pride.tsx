import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { BrandMark } from '../components/BrandMark';
import { SiteFooter } from '../components/SiteFooter';
import { trackEventOnce, getAttributionParams } from '../observability/analytics';
import {
  publicLinkClass,
  publicNavLinkPrimary,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';
import {
  PRIDE_ENTER_BY,
  PRIDE_PREMIUM_END,
  PRIDE_PREMIUM_START,
  PRIDE_PROMO_CODE,
  storePridePromoCode,
} from '../lib/pridePromo';

const API = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

/** Brand-only wash. Night + copper. No lifestyle / Pride street photography. */
const PRIDE_ATMOSPHERE =
  'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(196,131,42,0.22) 0%, transparent 55%), radial-gradient(ellipse 70% 40% at 80% 100%, rgba(196,131,42,0.08) 0%, transparent 50%), linear-gradient(180deg, #120E08 0%, #0D0A06 45%, #0D0A06 100%)';

const WHAT_YOU_GET = [
  {
    title: 'Nearby',
    body: 'See who is around you when MenRush opens. Proximity, not a stack of stale profiles.',
  },
  {
    title: 'Rooms',
    body: 'Group spaces for men who already know the vibe. Less noise. More signal.',
  },
  {
    title: 'Matches',
    body: 'Mutual interest opens chat. Direct when it is real. No endless maybe.',
  },
] as const;

type Stage = 'form' | 'submitting' | 'success' | 'closed' | 'error';

/**
 * Printed QR → menrush.com/pride.
 * Main CTA: waitlist email → usual MENRUSH beta invite (also 3 months Premium from launch).
 * Secondary: public PRIDE 3MONTH FREE at register. Brighton personal codes still redeem.
 */
export const Pride = () => {
  const [email, setEmail] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [stage, setStage] = useState<Stage>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [closedMsg, setClosedMsg] = useState('');

  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'pride', ...getAttributionParams() });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!adultConfirmed) {
      setErrorMsg('Confirm you are 18 or over to join this Pride waitlist.');
      setStage('error');
      return;
    }
    setStage('submitting');
    setErrorMsg('');
    setClosedMsg('');

    try {
      await axios.post(`${API}/campaigns/pride/signup`, {
        email: email.trim(),
        adult_confirmed: true,
      });
      setStage('success');
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { error?: string; code?: string } };
      };
      const code = ax?.response?.data?.code;
      const msg =
        ax?.response?.data?.error ||
        'Something went wrong. Please try again in a moment.';
      if (code === 'pride_issuance_closed' || ax?.response?.status === 410) {
        setClosedMsg(msg);
        setStage('closed');
        return;
      }
      setErrorMsg(msg);
      setStage('error');
    }
  }

  const registerHref = `/register?promo=${encodeURIComponent(PRIDE_PROMO_CODE)}`;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: PRIDE_ATMOSPHERE }}
        aria-hidden
      />

      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between px-5 sm:px-8">
        <Link to="/" className={publicLinkClass} aria-label="MenRush home">
          Home
        </Link>
        <Link to="/login" className={publicNavLinkPrimary}>
          Sign in
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 pb-10 pt-4 text-center sm:pt-8">
          <BrandMark size="hero" className="mb-8" />

          <p className="mr-coming-soon-overline mb-5">PRIDE PROMOTION · UK</p>

          <h1 className="mr-coming-soon-heading max-w-[920px] text-balance">
            3 Months Free
            <br />
            <span className="mr-coming-soon-accent">Premium</span>
          </h1>

          <p
            className="mt-6 max-w-[560px] text-pretty text-[clamp(15px,2vw,17px)] font-semibold leading-[1.6] text-[#F0E0C0]/92"
            data-testid="pride-headline-lock"
          >
            Join this Pride waitlist with your email. We send one invite code (
            <span className="font-mono font-black tracking-[0.08em] text-[#E0A14A]">
              MENRUSH-XXXX
            </span>
            ). That code opens beta and grants 3 months of Premium from launch. If MenRush opens on{' '}
            {PRIDE_PREMIUM_START}, Premium ends {PRIDE_PREMIUM_END}. If launch slips, the 3 months
            run from the actual open date. Not still {PRIDE_PREMIUM_END}. You cannot use Premium
            before launch.
          </p>

          <p
            className="mt-5 max-w-[560px] text-pretty text-[14px] leading-[1.55] text-[var(--cream-muted)]"
            data-testid="pride-grandfather"
          >
            If you already received a personal Brighton Pride code by email, enter that code at
            register on the same email. It still works on the terms in that email (redeem by 31
            October 2026). Clear any public code if it is pre-filled. Do not also enter{' '}
            <span className="font-mono font-bold tracking-wide text-[#F0E0C0]">
              {PRIDE_PROMO_CODE}
            </span>
            . One person gets one Pride grant.
          </p>

          <div className="mt-9 w-full max-w-[460px]" data-testid="pride-waitlist">
            {stage === 'success' ? (
              <div
                className="rounded-[18px] border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.12)] px-5 py-6 text-left"
                data-testid="pride-waitlist-success"
              >
                <p className="text-[17px] font-extrabold text-[#F0E0C0]">Check your inbox.</p>
                <p className="mt-3 text-[15px] leading-[1.55] text-[var(--cream-muted)]">
                  Your invite is on its way to{' '}
                  <span className="font-bold text-[#F0E0C0]">{email}</span>. Enter that{' '}
                  <span className="font-mono text-[#E0A14A]">MENRUSH</span> code at register. It
                  unlocks beta and 3 months of Premium from launch.
                </p>
              </div>
            ) : stage === 'closed' ? (
              <div
                className="rounded-[18px] border border-[rgba(176,67,46,0.45)] bg-[rgba(176,67,46,0.1)] px-5 py-6 text-left"
                data-testid="pride-waitlist-closed"
              >
                <p className="text-[17px] font-extrabold text-[#F0E0C0]">Waitlist closed</p>
                <p className="mt-3 text-[15px] leading-[1.55] text-[var(--cream-muted)]">
                  {closedMsg ||
                    'This Pride waitlist closed on 31 August 2026. New invites are no longer issued from this form.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate data-testid="pride-waitlist-form">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={stage === 'submitting'}
                    aria-label="Email for Pride waitlist"
                    data-testid="pride-waitlist-email"
                    className="min-w-0 flex-1 rounded-full border-0 bg-[#F5EBD8] px-6 py-[17px] text-base text-[#2A1C0A] placeholder:text-[#8B6B42]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/40 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={stage === 'submitting' || !email.trim() || !adultConfirmed}
                    className={`${publicPrimaryButtonClass} sm:w-auto sm:min-w-[160px] sm:px-7`}
                    data-testid="pride-cta"
                  >
                    {stage === 'submitting' ? 'Sending…' : 'Get my invite'}
                  </button>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3 text-left text-[13px] leading-[1.5] text-[var(--cream-muted)]">
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
                    className="mt-1 h-4 w-4 shrink-0 accent-[#C4832A]"
                    data-testid="pride-adult-confirm"
                  />
                  <span>
                    I confirm I am 18 or over and agree to the{' '}
                    <Link to="/terms" className={publicLinkClass}>
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className={publicLinkClass}>
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                {stage === 'error' && (
                  <p className="mt-3 text-left text-sm font-semibold text-[#B0432E]" data-testid="pride-waitlist-error">
                    {errorMsg}
                  </p>
                )}

                <p
                  className="mt-4 text-left text-sm leading-[1.55] text-[var(--cream-muted)]"
                  data-testid="pride-cta-note"
                >
                  We email one beta invite. Same code unlocks Premium at launch. Southampton and
                  Manchester Pride window: 21 to 31 August 2026. After that, this form stops issuing
                  new invites.
                </p>
              </form>
            )}
          </div>

          <div
            className="mt-8 w-full max-w-[460px] rounded-[18px] border border-[rgba(61,43,14,0.55)] bg-[rgba(13,10,6,0.35)] px-5 py-5"
            data-testid="pride-promo-code"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C4832A]">
              Secondary path
            </p>
            <p className="mt-2 text-[14px] leading-[1.55] text-[var(--cream-muted)]">
              Prefer the shared code? Enter{' '}
              <span className="font-mono font-bold tracking-wide text-[#F0E0C0]">
                {PRIDE_PROMO_CODE}
              </span>{' '}
              at register by {PRIDE_ENTER_BY}. Spaces ignored. Still one Pride grant per person.
            </p>
            <Link
              to={registerHref}
              className={`${publicLinkClass} mt-3 inline-block text-[14px]`}
              data-testid="pride-secondary-register"
              onClick={() => storePridePromoCode(PRIDE_PROMO_CODE)}
            >
              Create account with public code
            </Link>
          </div>
        </section>

        <section
          className="mx-auto w-full max-w-[640px] border-t border-[rgba(61,43,14,0.55)] px-6 py-12 text-left"
          aria-labelledby="pride-conditions-heading"
          data-testid="pride-conditions"
        >
          <h2
            id="pride-conditions-heading"
            className="text-center text-[13px] font-extrabold uppercase tracking-[0.22em] text-[#C4832A]"
          >
            Offer conditions
          </h2>
          <ul className="mt-8 space-y-4 text-[15px] leading-[1.6] text-[var(--cream-muted)]">
            <li>
              Main path: email waitlist on this page through{' '}
              <span className="font-bold text-[#F0E0C0]">31 August 2026</span>. You receive a{' '}
              <span className="font-mono text-[#F0E0C0]">MENRUSH</span> invite. Enter it at
              register. Premium starts at launch, not when you claim.
            </li>
            <li data-testid="pride-duration-rule">
              Duration rule: if MenRush opens on{' '}
              <span className="font-bold text-[#F0E0C0]">{PRIDE_PREMIUM_START}</span>, Premium ends{' '}
              <span className="font-bold text-[#F0E0C0]">{PRIDE_PREMIUM_END}</span>. If launch
              slips, the 3 months run from the actual open date. Not still {PRIDE_PREMIUM_END}. The
              clock does not start from scan or signup. Nothing is usable before launch.
            </li>
            <li>
              Secondary public code:{' '}
              <span className="font-mono text-[#F0E0C0]">{PRIDE_PROMO_CODE}</span> at account
              register by {PRIDE_ENTER_BY}.
            </li>
            <li>
              One per user = one MenRush account / email. No stacking waitlist invite, Brighton
              personal code, and public code.
            </li>
            <li>
              Pride replaces the existing 30-day waitlist Premium gift (Terms 7.2). It does not add
              to that gift.
            </li>
            <li>18+ only. UK-first (London · Manchester · Birmingham). Southampton and Manchester Pride this issuance window.</li>
            <li>Three months of Premium at no charge. You will not be billed for this offer.</li>
          </ul>
          <p
            className="mt-8 text-[14px] leading-[1.6] text-[var(--cream-muted)]"
            data-testid="pride-promoter-slot"
          >
            Promoter:{' '}
            <span className="font-bold text-[#F0E0C0]">
              Bronze Apps UK Limited (trading as MenRush)
            </span>
            . Correspondence address is in our{' '}
            <Link to="/terms" className={publicLinkClass} data-testid="pride-terms-link">
              Terms
            </Link>
            . Also see{' '}
            <Link to="/privacy" className={publicLinkClass}>
              Privacy
            </Link>
            {' · '}
            <Link to="/contact" className={publicLinkClass}>
              Support
            </Link>
            .
          </p>
        </section>

        <section
          className="mx-auto w-full max-w-[900px] border-t border-[rgba(61,43,14,0.55)] px-6 py-14"
          aria-labelledby="pride-what-you-get-heading"
        >
          <h2
            id="pride-what-you-get-heading"
            className="text-center text-[13px] font-extrabold uppercase tracking-[0.22em] text-[#C4832A]"
          >
            What you get at launch
          </h2>
          <p className="mx-auto mt-4 max-w-[560px] text-center text-[15px] leading-[1.6] text-[var(--cream-muted)]">
            The free MenRush app includes Nearby, Rooms, and Matches. This Pride offer adds{' '}
            <span className="font-bold text-[#F0E0C0]">3 months of Premium</span> on top (see
            Premium features in-app and in Terms).
          </p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {WHAT_YOU_GET.map((item) => (
              <li key={item.title} className="text-center sm:text-left">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#C4832A]">
                  Free app
                </p>
                <h3 className="mt-2 text-[17px] font-extrabold uppercase tracking-[0.1em] text-[#F0E0C0]">
                  {item.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-[var(--cream-muted)]">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <SiteFooter className="relative z-10 shrink-0" />
    </div>
  );
};
