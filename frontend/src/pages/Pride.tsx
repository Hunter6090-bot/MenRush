import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { SiteFooter } from '../components/SiteFooter';
import { trackEventOnce, getAttributionParams } from '../observability/analytics';
import { publicLinkClass, publicNavLinkPrimary, publicPrimaryButtonClass } from '../lib/publicStyles';
import {
  PRIDE_ENTER_BY,
  PRIDE_PREMIUM_END,
  PRIDE_PREMIUM_START,
  PRIDE_PROMO_CODE,
  storePridePromoCode,
} from '../lib/pridePromo';

const PRIDE_BG = '/images/menrush/29-brighton-pride-bunting.jpeg';
const PRIDE_GRADIENT =
  'linear-gradient(180deg, rgba(13,10,6,.55) 0%, rgba(13,10,6,.82) 45%, rgba(13,10,6,.97) 78%, #0D0A06 100%)';

const WHAT_YOU_GET = [
  {
    title: 'Nearby',
    body: 'See who is around you right now — live proximity, not a stack of stale profiles.',
  },
  {
    title: 'Rooms',
    body: 'Group spaces for men who already know the vibe. Less noise. More signal.',
  },
  {
    title: 'Matches',
    body: 'Mutual interest opens chat. Direct when it is real — no endless maybe.',
  },
] as const;

/**
 * Printed QR → menrush.com/pride.
 * Public shared code offer (Pete) + Legal/Finance locks. Does not alter /brightonpride.
 */
export const Pride = () => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'pride', ...getAttributionParams() });
    storePridePromoCode(PRIDE_PROMO_CODE);
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

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.38]"
        style={{ backgroundImage: `url(${PRIDE_BG})` }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: PRIDE_GRADIENT }} aria-hidden />

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

          <p className="mt-6 max-w-[560px] text-pretty text-[clamp(15px,2vw,18px)] leading-[1.65] text-[#F0E0C0]/90">
            Thanks for scanning. You&apos;re eligible for 3 months of free Premium on MenRush.
          </p>

          <p
            className="mt-5 max-w-[560px] text-pretty text-[15px] font-bold leading-[1.55] text-[#E0A14A]"
            data-testid="pride-headline-lock"
          >
            Enter the code by {PRIDE_ENTER_BY}. Premium runs from launch on {PRIDE_PREMIUM_START}.
            You cannot use MenRush before launch.
          </p>

          <div
            className="mt-9 w-full max-w-[460px] rounded-[18px] border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.12)] px-5 py-6"
            data-testid="pride-promo-code"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C4832A]">
              Your promo code — enter exactly
            </p>
            <p className="mt-3 font-mono text-[clamp(18px,4vw,24px)] font-black tracking-[0.12em] text-[#F0E0C0]">
              {PRIDE_PROMO_CODE}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-4 text-[13px] font-bold text-[#E0A14A] transition-colors hover:text-[#C4832A]"
            >
              {copied ? 'Copied' : 'Copy code'}
            </button>
          </div>

          <div className="mt-8 w-full max-w-[460px]">
            <Link to="/#waitlist" className={publicPrimaryButtonClass} data-testid="pride-cta">
              Continue to MenRush
            </Link>
            <p className="mt-4 text-sm leading-[1.55] text-[var(--cream-muted)]">
              Signup today means join the waitlist (or{' '}
              <Link to="/beta" className={publicLinkClass}>
                enter an invite
              </Link>{' '}
              if you have one) and create your account. The product opens{' '}
              {PRIDE_PREMIUM_START} — this is not in-app use today.
            </p>
          </div>
        </section>

        {/* Significant conditions on the page — not footer-only */}
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
              <span className="font-bold text-[#F0E0C0]">{PRIDE_ENTER_BY}</span> is the last day to{' '}
              <span className="font-bold text-[#F0E0C0]">enter</span> the code — not the end of the
              free Premium period.
            </li>
            <li>
              The 3 months of Premium run from launch on{' '}
              <span className="font-bold text-[#F0E0C0]">{PRIDE_PREMIUM_START}</span> (about{' '}
              {PRIDE_PREMIUM_START} to {PRIDE_PREMIUM_END}), not from the day you scan or enter the
              code.
            </li>
            <li>
              Nothing is usable before launch. If launch slips, the 3 months honour from the actual
              open date.
            </li>
            <li>
              One per user means one MenRush account / email. Enter code{' '}
              <span className="font-mono text-[#F0E0C0]">{PRIDE_PROMO_CODE}</span> at signup.
            </li>
            <li>
              This Pride offer replaces the existing 30-day waitlist Premium gift (Terms 7.2). No
              stacking. Maximum is 90 days (3 months) for a Pride redeemer.
            </li>
            <li>18+ only. UK-first launch (London · Manchester · Birmingham · Brighton).</li>
            <li>
              Three months at no charge. You will not be billed for this offer. After that, Premium
              is optional — only if you later choose to subscribe. No card is required for this
              claim.
            </li>
          </ul>
          <p className="mt-8 text-[14px] leading-[1.6] text-[var(--cream-muted)]">
            Promoter:{' '}
            <span className="font-bold text-[#F0E0C0]">
              Bronze Apps UK Limited (trading as MenRush)
            </span>
            , Company No. 17249857. Registered office — see{' '}
            <Link to="/terms" className={publicLinkClass}>
              Terms
            </Link>{' '}
            (Office 9811, 321–323 High Road, Chadwell Heath, Essex RM6 6AX).{' '}
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
          <ul className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {WHAT_YOU_GET.map((item) => (
              <li key={item.title} className="text-center sm:text-left">
                <h3 className="text-[17px] font-extrabold uppercase tracking-[0.1em] text-[#F0E0C0]">
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
