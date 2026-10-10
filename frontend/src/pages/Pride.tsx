import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { SiteFooter } from '../components/SiteFooter';
import { trackEventOnce, getAttributionParams } from '../observability/analytics';
import {
  publicLinkClass,
  publicNavLinkPrimary,
  publicPrimaryButtonClass,
} from '../lib/publicStyles';
import { clearStoredPridePromoCode } from '../lib/pridePromo';

/** Owner-supplied Pride parade photograph (full-bleed). */
const PRIDE_BG = '/images/menrush/21-pride-parade-flags.jpeg';

/**
 * Night + copper wash so cream/gold type stays readable over the parade photo.
 * Photo shows through slightly (claim face, not a brochure).
 */
const PRIDE_WASH =
  'linear-gradient(180deg, rgba(13,10,6,0.10) 0%, rgba(13,10,6,0.22) 32%, rgba(18,12,6,0.38) 62%, rgba(13,10,6,0.60) 85%, #0D0A06 100%), radial-gradient(ellipse 85% 50% at 50% 8%, rgba(196,131,42,0.18) 0%, transparent 55%)';

/**
 * Printed QR goes to menrush.com/pride.
 * The offer closed on 31 August 2026: no claim form for new visitors.
 * People who already hold a Pride code can still enter it at register
 * by 31 October 2026 (23:59:59 UK time); register checks the code and the email.
 * Grant rules live in Terms. No Brighton.
 */
export const Pride = () => {
  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'pride', ...getAttributionParams() });
    // Never pre-fill a public promo. Unique codes go to the inbox only.
    clearStoredPridePromoCode();
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-no-repeat"
        style={{
          backgroundImage: `url(${PRIDE_BG})`,
          // Keep parade faces in frame (crowd is mid/lower). Avoid top-heavy crop.
          backgroundPosition: 'center 42%',
          filter: 'saturate(1.05) brightness(1.20)',
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
            Our Pride offer <span className="mr-coming-soon-accent">closed</span> on 31 August
          </h1>

          <div className="mt-10 w-full max-w-[460px] rounded-[24px] border border-[rgba(240,224,192,0.35)] bg-[#1E1508]/96 p-6 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.6)]" data-testid="pride-invite-path">
            <p className="text-pretty text-[15px] leading-[1.55] text-[#F0E0C0]" data-testid="pride-closed-note">
              New Pride codes are no longer available.
            </p>
            <p
              className="mt-3 text-pretty text-[15px] leading-[1.55] text-[var(--cream-muted)]"
              data-testid="pride-redeem-note"
            >
              Already have a Pride code from your email? Enter it at register with that same email by 31 October.
            </p>
            <Link to="/register" className={`mt-5 ${publicPrimaryButtonClass}`} data-testid="pride-register-cta">
              Create your account
            </Link>
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
