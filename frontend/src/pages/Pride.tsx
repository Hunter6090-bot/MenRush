import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { SiteFooter } from '../components/SiteFooter';
import { trackEventOnce, getAttributionParams } from '../observability/analytics';
import { publicLinkClass, publicNavLinkPrimary, publicPrimaryButtonClass } from '../lib/publicStyles';
import {
  PRIDE_PROMO_COMPACT,
  PRIDE_PROMO_DISPLAY,
  PRIDE_PROMO_EXPIRES,
} from '../lib/pridePromo';

/** Same atmospheric treatment as the UK launch homepage — charcoal / bronze / cream. */
const PRIDE_BG = '/images/menrush/29-brighton-pride-bunting.jpeg';
const PRIDE_GRADIENT =
  'linear-gradient(180deg, rgba(13,10,6,.55) 0%, rgba(13,10,6,.82) 45%, rgba(13,10,6,.97) 78%, #0D0A06 100%)';

/** Match shipped marketing claims on ComingSoon — not a speculative Premium laundry list. */
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

export const Pride = () => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'pride', ...getAttributionParams() });
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(PRIDE_PROMO_DISPLAY);
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
        <section className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 pb-14 pt-4 text-center sm:pt-8">
          <BrandMark size="hero" className="mb-8" />

          <p className="mr-coming-soon-overline mb-5">PRIDE PROMOTION</p>

          <h1 className="mr-coming-soon-heading max-w-[900px] text-balance">
            3 Months Free
            <br />
            <span className="mr-coming-soon-accent">Premium</span>
          </h1>

          <p className="mt-6 max-w-[540px] text-pretty text-[clamp(15px,2vw,18px)] leading-[1.65] text-[#F0E0C0]/90">
            Thanks for scanning. You&apos;re eligible for 3 months of free premium access on
            MenRush.
          </p>

          <div
            className="mt-9 w-full max-w-[460px] rounded-[18px] border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.12)] px-5 py-6"
            data-testid="pride-promo-code"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#C4832A]">
              Your promo code
            </p>
            <p className="mt-3 font-mono text-[clamp(18px,4vw,24px)] font-black tracking-[0.12em] text-[#F0E0C0]">
              {PRIDE_PROMO_DISPLAY}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="mt-4 text-[13px] font-bold text-[#E0A14A] transition-colors hover:text-[#C4832A]"
            >
              {copied ? 'Copied' : 'Copy code'}
            </button>
            <p className="mt-3 text-[12px] leading-[1.55] text-[var(--cream-muted)]">
              Spaces optional when you enter it —{' '}
              <span className="font-mono tracking-wide text-[#F0E0C0]/85">{PRIDE_PROMO_COMPACT}</span>{' '}
              also works.
            </p>
          </div>

          <div className="mt-8 w-full max-w-[460px]">
            <Link to="/" className={publicPrimaryButtonClass} data-testid="pride-cta">
              Continue to MenRush
            </Link>
            <p className="mt-4 text-sm text-[var(--cream-muted)]">
              Next step: join the waitlist or{' '}
              <Link to="/beta" className={publicLinkClass}>
                enter your invite
              </Link>{' '}
              if you already have one. Enter this code at signup when the offer is live.
            </p>
          </div>

          <ul className="mt-10 max-w-[520px] space-y-2 text-left text-[14px] leading-[1.55] text-[var(--cream-muted)]">
            <li>Pride-exclusive offer</li>
            <li>Valid until {PRIDE_PROMO_EXPIRES}</li>
            <li>One code per user</li>
            <li>Entered at signup</li>
          </ul>
        </section>

        <section
          className="mx-auto w-full max-w-[900px] border-t border-[rgba(61,43,14,0.55)] px-6 py-14"
          aria-labelledby="pride-what-you-get-heading"
        >
          <h2
            id="pride-what-you-get-heading"
            className="text-center text-[13px] font-extrabold uppercase tracking-[0.22em] text-[#C4832A]"
          >
            What you get
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
          <p className="mx-auto mt-10 max-w-[520px] text-center text-[15px] leading-[1.65] text-[#F0E0C0]/88">
            This offer covers <span className="font-bold text-[#E0A14A]">3 months of Premium</span>{' '}
            when MenRush opens — same Premium axis as the main site, separate from verification
            badges.
          </p>
        </section>
      </main>

      <SiteFooter className="relative z-10 shrink-0" />
    </div>
  );
};
