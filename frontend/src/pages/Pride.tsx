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
 * Sole public Pride offer. Redeem PRIDE 3MONTH FREE at account register (spaces ignored).
 * Waitlist alone does not redeem.
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

  const registerHref = `/register?promo=${encodeURIComponent(PRIDE_PROMO_CODE)}`;

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

          <p
            className="mt-6 max-w-[560px] text-pretty text-[clamp(15px,2vw,17px)] font-semibold leading-[1.6] text-[#F0E0C0]/92"
            data-testid="pride-headline-lock"
          >
            Create an account and enter code{' '}
            <span className="font-mono font-black tracking-[0.08em] text-[#E0A14A]">
              {PRIDE_PROMO_CODE}
            </span>{' '}
            by {PRIDE_ENTER_BY}. You get 3 months of Premium from launch. If MenRush opens on{' '}
            {PRIDE_PREMIUM_START}, Premium ends {PRIDE_PREMIUM_END}. If launch slips, the 3 months
            run from the actual open date — not still {PRIDE_PREMIUM_END}. You cannot use Premium
            before launch.
          </p>

          <div
            className="mt-9 w-full max-w-[460px] rounded-[18px] border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.12)] px-5 py-6"
            data-testid="pride-promo-code"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C4832A]">
              Promo code
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
            <Link to={registerHref} className={publicPrimaryButtonClass} data-testid="pride-cta">
              Create account &amp; enter code
            </Link>
            <p
              className="mt-4 text-sm leading-[1.55] text-[var(--cream-muted)]"
              data-testid="pride-cta-note"
            >
              Create an account and enter {PRIDE_PROMO_CODE} by {PRIDE_ENTER_BY}. Joining the{' '}
              <Link to="/#waitlist" className={publicLinkClass} data-testid="pride-waitlist-link">
                waitlist
              </Link>{' '}
              alone does not redeem this code. Have a beta invite?{' '}
              <Link to="/beta" className={publicLinkClass}>
                Enter it here
              </Link>
              .
            </p>
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
              <span className="font-bold text-[#F0E0C0]">{PRIDE_ENTER_BY}</span> is the last day to{' '}
              <span className="font-bold text-[#F0E0C0]">enter</span> the code at account register —
              not the end of the free Premium period. The waitlist form does not redeem the code.
            </li>
            <li data-testid="pride-duration-rule">
              Duration rule: if MenRush opens on{' '}
              <span className="font-bold text-[#F0E0C0]">{PRIDE_PREMIUM_START}</span>, Premium ends{' '}
              <span className="font-bold text-[#F0E0C0]">{PRIDE_PREMIUM_END}</span>. If launch
              slips, the 3 months run from the actual open date — not still {PRIDE_PREMIUM_END}.
              The clock does not start from scan or code entry. Nothing is usable before launch.
            </li>
            <li>
              One per user = one MenRush account / email. Code:{' '}
              <span className="font-mono text-[#F0E0C0]">{PRIDE_PROMO_CODE}</span>.
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
