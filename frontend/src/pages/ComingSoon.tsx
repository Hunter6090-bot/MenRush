import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { SiteFooter } from '../components/SiteFooter';
import { trackEventOnce, getAttributionParams } from '../observability/analytics';
import { publicLinkClass, publicNavLinkPrimary } from '../lib/publicStyles';

const COMING_SOON_BG = '/images/menrush/31-london-rooftop-dusk.jpeg';
const COMING_SOON_GRADIENT =
  'linear-gradient(180deg, rgba(13,10,6,.55) 0%, rgba(13,10,6,.82) 45%, rgba(13,10,6,.97) 78%, #0D0A06 100%)';

const WHAT_YOU_GET = [
  {
    title: 'Nearby',
    body: 'See who is around you right now. Live proximity, not a stack of stale profiles.',
  },
  {
    title: 'Video rooms',
    body: 'Group spaces for men who already know the vibe. Less noise. More signal.',
  },
  {
    title: 'Matches',
    body: 'Mutual interest opens chat. Direct when it is real. No endless maybe.',
  },
] as const;

export const ComingSoon = () => {
  const { hash } = useLocation();

  useEffect(() => {
    trackEventOnce('landing_viewed', { surface: 'coming_soon', ...getAttributionParams() });
  }, []);

  useEffect(() => {
    if (hash === '#waitlist') {
      document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hash]);


  return (
    <div className="relative flex min-h-dvh max-w-full flex-col overflow-x-clip overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.38]"
        style={{ backgroundImage: `url(${COMING_SOON_BG})` }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: COMING_SOON_GRADIENT }} aria-hidden />

      <header className="relative z-20 flex h-16 shrink-0 items-center px-5 sm:px-8">
        <Link to="/" aria-label="MenRush" className="inline-flex shrink-0 items-center">
          <BrandMark size="sm" />
        </Link>
        <div className="flex-1" aria-hidden />
        <Link to="/login" className={publicNavLinkPrimary}>
          Sign in
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        {/* Hero — brand, live status, headline, copy, signup CTA */}
        <section className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 pb-14 pt-4 text-center sm:pt-8">
          <BrandMark size="hero" className="mb-8" />

          <p className="mr-coming-soon-overline mb-5">
            LIVE NOW. UK BETA OPEN
          </p>

          <h1 className="mr-coming-soon-heading max-w-[900px] text-balance">
            Real men.
            <br />
            <span className="mr-coming-soon-accent">Verified profiles.</span>
            <br />
            Total discretion.
          </h1>

          <p className="mt-6 max-w-[540px] text-pretty text-[clamp(15px,2vw,18px)] leading-[1.65] text-[#F0E0C0]/90">
            See who&apos;s near you right now. No swiping. Less noise.
          </p>

          <div id="waitlist" className="relative mt-9 w-full max-w-[460px]">
            <Link
              to="/register"
              className="inline-flex w-full items-center justify-center rounded-full border-0 bg-[#C4832A] px-[28px] py-3.5 text-xs font-extrabold tracking-[0.12em] text-[#1A0E03] shadow-[0_0_24px_rgba(196,131,42,0.4)] transition-colors hover:bg-[#E0A14A]"
            >
              Sign up free
            </Link>
          </div>

          <p className="mt-5 text-sm text-[var(--cream-muted)]">
            Already have an invite?{' '}
            <Link to="/beta" className={publicLinkClass}>
              Enter your code
            </Link>
          </p>

          <p className="mt-10 text-[15px] font-bold uppercase tracking-[0.08em] text-[#F0E0C0]/85">
            &ldquo;Your next nearby meet is real.&rdquo;
          </p>
        </section>

        {/* What you get — shipped product surfaces only */}
        <section
          className="mx-auto w-full max-w-[900px] border-t border-[rgba(61,43,14,0.55)] px-6 py-14"
          aria-labelledby="what-you-get-heading"
        >
          <h2
            id="what-you-get-heading"
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
        </section>

        {/* Early access promise */}
        <section className="mx-auto w-full max-w-[560px] px-6 pb-16 text-center">
          <p className="text-[15px] leading-[1.65] text-[#F0E0C0]/88">
            Sign up before 1 October 2026 and get{' '}
            <span className="font-bold text-[#E0A14A]">30 days of Premium</span> free. A Pride promo
            replaces that gift and does not stack.
          </p>
          <p className="mt-6">
            <Link to="/register" className={publicLinkClass}>
              Back to signup
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter className="relative z-10 shrink-0" />
    </div>
  );
};
