import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandMark } from '../components/BrandMark';
import { SiteFooter } from '../components/SiteFooter';
import { trackEventOnce, getAttributionParams } from '../observability/analytics';
import { publicNavLinkPrimary } from '../lib/publicStyles';
import '../styles/home-surface.css';

const COMING_SOON_BG = '/images/menrush/31-london-rooftop-dusk.jpeg';
const COMING_SOON_GRADIENT =
  'linear-gradient(180deg, rgba(13,10,6,.55) 0%, rgba(13,10,6,.82) 45%, rgba(13,10,6,.97) 78%, #0D0A06 100%)';

/** Shipped app areas only. Keep every line strictly true; no dating words. */
const WHAT_YOU_GET = [
  { title: 'Map', body: "Your home screen. Browse who's around." },
  { title: 'Chat', body: 'One-to-one messages.' },
  { title: 'Rooms', body: 'Group chats. Private groups need Premium.' },
  { title: 'Out', body: 'Cruising spots, hot spots and events.' },
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
    <div className="mr-home-surface relative flex min-h-dvh max-w-full flex-col overflow-x-clip overflow-hidden">
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
        {/* Hero: brand, headline, sign-up CTA */}
        <section className="mx-auto flex w-full max-w-[720px] flex-col items-center px-6 pb-14 pt-4 text-center sm:pt-8">
          <BrandMark size="hero" className="mb-8" />

          <p className="mr-home-overline mb-5">Free to join</p>

          <h1 className="mr-home-heading max-w-[900px] text-balance">
            See who&apos;s around.
            <br />
            <span className="mr-home-accent">On the map.</span>
          </h1>

          <p className="mt-6 max-w-[540px] text-pretty text-[clamp(17px,2vw,20px)] leading-[1.6] text-[var(--cream-muted)]">
            For gay, bi, trans and curious men. 18+ only.
          </p>

          <div id="waitlist" className="relative mt-9 w-full max-w-[460px]">
            <Link
              to="/register"
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border-0 bg-[var(--nn-copper)] px-[28px] py-3.5 text-[16px] font-extrabold tracking-[0.08em] text-[var(--nn-on-copper)] shadow-[0_0_24px_rgba(196,131,42,0.4)] transition-colors hover:bg-[var(--nn-copper-bright)]"
            >
              Sign up free
            </Link>
          </div>
        </section>

        {/* What you get: shipped app areas only */}
        <section
          className="mx-auto w-full max-w-[960px] border-t border-[var(--nn-border)] px-6 py-14"
          aria-labelledby="what-you-get-heading"
        >
          <h2
            id="what-you-get-heading"
            className="text-center text-[15px] font-extrabold uppercase tracking-[0.22em] text-[var(--nn-accent-text)]"
          >
            What you get
          </h2>
          <ul className="mt-10 grid gap-9 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-10 lg:grid-cols-4 lg:gap-8">
            {WHAT_YOU_GET.map((item) => (
              <li key={item.title} className="text-center sm:text-left">
                <h3 className="text-[24px] font-extrabold uppercase tracking-[0.1em] text-[var(--nn-text)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[17px] leading-[1.5] text-[var(--cream-muted)]">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-[560px] px-6 pb-16 text-center">
          <Link
            to="/invite"
            className="inline-flex min-h-[44px] items-center px-3 text-[15px] font-semibold text-[var(--cream-muted)] underline-offset-4 transition-colors hover:text-[var(--nn-accent-text)] hover:underline"
          >
            Have a code?
          </Link>
        </section>
      </main>

      <SiteFooter className="relative z-10 shrink-0" />
    </div>
  );
};
