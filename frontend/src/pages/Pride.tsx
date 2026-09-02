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
  PRIDE_INVITE_CAMPAIGN_ID,
} from '../lib/pridePromo';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '') || '/api';

/** Owner-supplied Pride parade photograph (full-bleed). */
const PRIDE_BG = '/images/menrush/21-pride-parade-flags.jpeg';

/**
 * Night + copper wash so cream/gold type stays readable over the parade photo.
 * Photo shows through slightly (claim face, not a brochure).
 */
const PRIDE_WASH =
  'linear-gradient(180deg, rgba(13,10,6,0.58) 0%, rgba(13,10,6,0.72) 32%, rgba(18,12,6,0.86) 62%, rgba(13,10,6,0.94) 82%, #0D0A06 100%), radial-gradient(ellipse 85% 50% at 50% 8%, rgba(196,131,42,0.18) 0%, transparent 55%)';

/**
 * Printed QR → menrush.com/pride.
 * Face: parade photo under wash + short claim + one gold Claim CTA.
 * Grant rules live in Terms. No printed-code CTA. No Offer conditions. No Brighton.
 */
export const Pride = () => {
  const [claimOpen, setClaimOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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
        className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url(${PRIDE_BG})`,
          // Keep parade faces in frame (crowd is mid/lower). Avoid top-heavy crop.
          backgroundPosition: 'center 42%',
        }}
        data-testid="pride-bg-photo"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: PRIDE_WASH }}
        data-testid="pride-bg-wash"
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
                Claim Pride code
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
                  {submitting ? 'Sending…' : 'Email my Pride code'}
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
