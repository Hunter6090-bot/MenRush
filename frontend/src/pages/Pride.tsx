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
  PRIDE_PROMO_CODE,
} from '../lib/pridePromo';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '') || '/api';

/** Brand-only wash. Night + copper. No lifestyle / Pride street photography. */
const PRIDE_ATMOSPHERE =
  'radial-gradient(ellipse 90% 55% at 50% -10%, rgba(196,131,42,0.22) 0%, transparent 55%), radial-gradient(ellipse 70% 40% at 80% 100%, rgba(196,131,42,0.08) 0%, transparent 50%), linear-gradient(180deg, #120E08 0%, #0D0A06 45%, #0D0A06 100%)';

/**
 * Printed QR → menrush.com/pride.
 * Face: short claim + one gold Claim CTA + operational lines. Grant rules live in Terms.
 * No Offer conditions block. No Brighton. No city list. No Free app essay.
 */
export const Pride = () => {
  const [claimOpen, setClaimOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const inviteOpen = isPrideInviteIssueOpen();

  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'pride', ...getAttributionParams() });
    // Never pre-fill a public promo. Unique codes go to the inbox only.
    clearStoredPridePromoCode();
  }, []);

  const onInviteFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

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
          'Check your inbox. Your Pride code is on its way. Enter it at register on the same email.',
      );
      setEmail('');
      setAdultConfirmed(false);
    } catch {
      setFormError(
        'We could not reach the server to send your code. Please try again. If the email is late, use Support.',
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
        <section className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 pb-14 pt-4 text-center sm:pt-8">
          <BrandMark size="hero" className="mb-8" />

          <p className="mr-coming-soon-overline mb-5">PRIDE PROMOTION · UK</p>

          <h1
            className="mr-coming-soon-heading max-w-[920px] text-balance"
            data-testid="pride-headline-lock"
          >
            3 months{' '}
            <span className="mr-coming-soon-accent">Premium</span>
            <br />
            from launch
          </h1>

          <div className="mt-10 w-full max-w-[460px]" data-testid="pride-invite-path">
            {!claimOpen ? (
              <button
                type="button"
                className={publicPrimaryButtonClass}
                data-testid="pride-claim-cta"
                onClick={() => {
                  setFormError('');
                  setFormSuccess('');
                  setClaimOpen(true);
                }}
              >
                {inviteOpen ? 'Claim Pride code' : 'Resend my Pride code'}
              </button>
            ) : (
              <form
                className="flex flex-col gap-3 text-left"
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
                  {submitting
                    ? 'Sending…'
                    : inviteOpen
                      ? 'Email my Pride code'
                      : 'Resend my Pride code'}
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
              </form>
            )}

            <p
              className="mt-4 text-pretty text-[14px] leading-[1.55] text-[var(--cream-muted)]"
              data-testid="pride-invite-bargain"
            >
              Submitting the form sends the invite. It is not the grant. Enter the code at register.
              You cannot use Premium before launch.
            </p>
          </div>

          <p
            className="mt-8 max-w-[560px] text-pretty text-[14px] leading-[1.55] text-[var(--cream-muted)]"
            data-testid="pride-public-redeem-note"
          >
            Already have the printed public code {PRIDE_PROMO_CODE}? It still works at register by{' '}
            {PRIDE_ENTER_BY}. One grant. Do not also claim a new Pride invite.
          </p>

          <p
            className="mt-10 text-[13px] leading-[1.55] text-[var(--cream-muted)]"
            data-testid="pride-terms-apply"
          >
            <Link to="/terms" className={publicLinkClass} data-testid="pride-terms-link">
              Terms and conditions apply.
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter className="relative z-10 shrink-0" />
    </div>
  );
};
