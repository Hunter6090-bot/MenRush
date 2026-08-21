import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { SiteFooter } from '../components/SiteFooter';
import { trackEventOnce, getAttributionParams } from '../observability/analytics';
import {
  publicErrorClass,
  publicInputClass,
  publicLinkClass,
  publicNavLinkPrimary,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';
import {
  clearStoredPridePromoCode,
  isPrideInviteIssueOpen,
  PRIDE_ENTER_BY,
  PRIDE_INVITE_CAMPAIGN_ID,
  PRIDE_INVITE_WINDOW_LABEL,
  PRIDE_PREMIUM_END,
  PRIDE_PREMIUM_START,
  PRIDE_PROMO_CODE,
  storePridePromoCode,
} from '../lib/pridePromo';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '') || '/api';

/** Brand-only wash — night + copper. No lifestyle / Pride street photography. */
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

/**
 * Printed QR → menrush.com/pride.
 * Three paths, one Pride grant. Pride-flagged invite (21–31 Aug) = beta + booked Premium.
 */
export const Pride = () => {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const inviteOpen = isPrideInviteIssueOpen();

  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'pride', ...getAttributionParams() });
    // Do not stuff localStorage on visit — grandfather users must enter their personal code.
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(PRIDE_PROMO_CODE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const registerHref = `/register?promo=${encodeURIComponent(PRIDE_PROMO_CODE)}`;
  const onPublicCtaClick = () => {
    storePridePromoCode(PRIDE_PROMO_CODE);
  };

  const onInviteFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!inviteOpen) {
      setFormError(
        `The Pride invite window closed after 31 August 2026. You can still enter ${PRIDE_PROMO_CODE} at register by ${PRIDE_ENTER_BY}.`,
      );
      return;
    }
    if (!adultConfirmed) {
      setFormError('Confirm you are 18 or over.');
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFormError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    // Asking for a unique/Pride invite must not pre-fill the public code at register.
    clearStoredPridePromoCode();

    try {
      const res = await fetch(`${API_BASE}/campaigns/${PRIDE_INVITE_CAMPAIGN_ID}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, adult_confirmed: true }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        setFormError(
          data.error ||
            (data.code === 'email_send_failed'
              ? 'We could not send the invite email just now. Please try again in a few minutes.'
              : 'Something went wrong. Please try again.'),
        );
        return;
      }

      setFormSuccess(
        data.message ||
          'Check your inbox — your Pride-flagged invite is on its way. Submitting this form is not the Premium grant; enter that invite at register when you create your account.',
      );
      setEmail('');
      setAdultConfirmed(false);
    } catch {
      setFormError(
        'We could not reach the server to send your invite. Please try again. If the email is late, use Support.',
      );
    } finally {
      setSubmitting(false);
    }
  };

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
            One Pride grant. Two ways to claim it during 21–31 August 2026, plus holders of an
            already-emailed personal code. You cannot use Premium before launch. 31 August is not
            the end of Premium.
          </p>

          <p
            className="mt-5 max-w-[560px] text-pretty text-[14px] leading-[1.55] text-[var(--cream-muted)]"
            data-testid="pride-week-why"
          >
            This unique-invite window (21–31 August 2026) exists because of Southampton Pride (29–30
            August) and Manchester Village Pride (28–31 August). MenRush is not a sponsor of those
            events.
          </p>

          {/* Path 1 — Pride-flagged invite */}
          <div
            className="mt-9 w-full max-w-[460px] rounded-[18px] border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.12)] px-5 py-6 text-left"
            data-testid="pride-invite-path"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C4832A]">
              Path 1 · Pride-flagged invite
            </p>
            <p className="mt-3 text-[15px] leading-[1.55] text-[#F0E0C0]" data-testid="pride-invite-bargain">
              {inviteOpen ? (
                <>
                  {PRIDE_INVITE_WINDOW_LABEL} only: enter your email and confirm 18+. We email a
                  Pride-flagged beta invite (MENRUSH-XXXX-XXXX). That one code is beta access and
                  books 3 months of Premium (duration rule below). Submitting this form sends the
                  invite — it is not the grant. Enter that invite at register on the same email.
                  Entering it now books Premium; you do not enter it again on 1 October. Do not also
                  enter{' '}
                  <span className="font-mono font-bold tracking-wide text-[#E0A14A]">
                    {PRIDE_PROMO_CODE}
                  </span>{' '}
                  or a Brighton personal PRIDE-XXXX-XXXX. One person gets one Pride grant.
                </>
              ) : (
                <>
                  The Pride-flagged invite window closed after 31 August 2026. New waitlist signups
                  from this page no longer get the 3-month Pride grant on the invite. Use Path 2
                  below while it is still open.
                </>
              )}
            </p>

            {inviteOpen ? (
              <form
                className="mt-5 flex flex-col gap-3"
                onSubmit={onInviteFormSubmit}
                data-testid="pride-invite-form"
              >
                <label htmlFor="pride-invite-email" className="sr-only">
                  Email
                </label>
                <input
                  id="pride-invite-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(ev) => {
                    setFormError('');
                    setEmail(ev.target.value);
                  }}
                  placeholder="Email"
                  className={publicInputClass}
                  data-testid="pride-invite-email"
                  disabled={submitting}
                />
                <label className="flex items-start gap-3 text-[13px] leading-[1.45] text-[var(--cream-muted)]">
                  <input
                    type="checkbox"
                    checked={adultConfirmed}
                    onChange={(ev) => {
                      setFormError('');
                      setAdultConfirmed(ev.target.checked);
                    }}
                    className="mt-1 h-4 w-4 accent-[#C4832A]"
                    data-testid="pride-invite-adult"
                    disabled={submitting}
                  />
                  <span>I confirm I am 18 or over.</span>
                </label>
                <button
                  type="submit"
                  className={publicPrimaryButtonClass}
                  disabled={submitting}
                  data-testid="pride-invite-submit"
                >
                  {submitting ? 'Sending…' : 'Email me my Pride invite'}
                </button>
                {formError ? (
                  <p className={publicErrorClass} data-testid="pride-invite-error" role="alert">
                    {formError}
                  </p>
                ) : null}
                {formSuccess ? (
                  <p
                    className="text-sm font-semibold leading-[1.55] text-[#E0A14A]"
                    data-testid="pride-invite-success"
                    role="status"
                  >
                    {formSuccess}
                  </p>
                ) : null}
                <p className="text-[12px] leading-[1.5] text-[var(--cream-muted)]">
                  If the invite email fails or is late, the error above will say so — try again or
                  contact Support. Asking for this invite does not put {PRIDE_PROMO_CODE} in the
                  register box.
                </p>
              </form>
            ) : (
              <p className="mt-4 text-[13px] leading-[1.55] text-[var(--cream-muted)]" data-testid="pride-invite-closed">
                Window closed. Path 2 (public code) remains until {PRIDE_ENTER_BY}.
              </p>
            )}
          </div>

          {/* Path 2 — public code */}
          <div
            className="mt-6 w-full max-w-[460px] rounded-[18px] border border-[rgba(240,224,192,0.25)] bg-[rgba(13,10,6,0.35)] px-5 py-6"
            data-testid="pride-promo-code"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C4832A]">
              Path 2 · Public code
            </p>
            <p className="mt-3 text-[15px] leading-[1.55] text-[#F0E0C0]" data-testid="pride-public-path">
              Still works. Create an account and enter{' '}
              <span className="font-mono font-black tracking-[0.08em] text-[#E0A14A]">
                {PRIDE_PROMO_CODE}
              </span>{' '}
              by {PRIDE_ENTER_BY}. Printed material that shows this code is not dead.
            </p>
            <p className="mt-4 font-mono text-[clamp(18px,4vw,24px)] font-black tracking-[0.12em] text-[#F0E0C0]">
              {PRIDE_PROMO_CODE}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-4 text-[13px] font-bold text-[#E0A14A] transition-colors hover:text-[#C4832A]"
            >
              {copied ? 'Copied' : 'Copy code'}
            </button>
            <div className="mt-5">
              <Link
                to={registerHref}
                className={publicPrimaryButtonClass}
                data-testid="pride-cta"
                onClick={onPublicCtaClick}
              >
                Create account &amp; enter public code
              </Link>
            </div>
            <p
              className="mt-4 text-sm leading-[1.55] text-[var(--cream-muted)]"
              data-testid="pride-cta-note"
            >
              Enter {PRIDE_PROMO_CODE} at register by {PRIDE_ENTER_BY}. Have a beta invite from the
              homepage waitlist (not Pride-flagged)?{' '}
              <Link to="/beta" className={publicLinkClass}>
                Enter it here
              </Link>
              .
            </p>
          </div>

          <p
            className="mt-8 max-w-[560px] text-pretty text-[14px] leading-[1.55] text-[var(--cream-muted)]"
            data-testid="pride-grandfather"
          >
            Already have a personal Brighton Pride code (PRIDE-XXXX-XXXX) from an earlier email?
            Enter that code at register on the same email. It still works on the terms in that email
            (redeem by 31 October 2026). Clear any pre-filled public or new invite code. Do not also
            enter{' '}
            <span className="font-mono font-bold tracking-wide text-[#F0E0C0]">{PRIDE_PROMO_CODE}</span>{' '}
            or a new Pride-flagged invite. One person gets one Pride grant.
          </p>
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
            <li data-testid="pride-clock-invite">
              Pride-flagged invites: issued only {PRIDE_INVITE_WINDOW_LABEL} from this page. Enter
              that invite at register to book the grant. Premium is not usable before launch.
            </li>
            <li data-testid="pride-clock-public">
              <span className="font-bold text-[#F0E0C0]">{PRIDE_ENTER_BY}</span> is the last day to{' '}
              <span className="font-bold text-[#F0E0C0]">enter</span> the public code{' '}
              <span className="font-mono text-[#F0E0C0]">{PRIDE_PROMO_CODE}</span> at account register —
              not the end of the free Premium period.
            </li>
            <li data-testid="pride-duration-rule">
              Duration rule: if you book before launch, Premium starts at launch. On-time open{' '}
              <span className="font-bold text-[#F0E0C0]">{PRIDE_PREMIUM_START}</span> → ends{' '}
              <span className="font-bold text-[#F0E0C0]">{PRIDE_PREMIUM_END}</span>. If launch slips, 3
              months from the actual open date — not still {PRIDE_PREMIUM_END}. If you first enter
              after MenRush is open, 3 months from that redeem date. The clock does not start from
              scan or form submit. Nothing is usable before launch.
            </li>
            <li>
              Submitting the email form sends a Pride-flagged invite. The grant happens when you enter
              that invite at register (or when you enter the public / personal code on their paths).
            </li>
            <li>
              One per user = one MenRush account / email. One Pride grant. No stacking across paths.
            </li>
            <li>
              Pride replaces the existing 30-day waitlist Premium gift (Terms 7.2). It does not add
              to that gift.
            </li>
            <li>18+ only. UK-first (London · Manchester · Birmingham).</li>
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
