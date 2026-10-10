/**
 * First-launch 18+ gate. Board screen 01: brand mark, "18+", "Men only. 18 and
 * over.", a primary "I'm 18 or over" tap and a way out.
 *
 * Self-declared only: no ID check, no verification, and the copy never says so.
 * The gate renders in place of the page, so the URL (and any deep link with its
 * query string) is untouched. Once confirmed, the page the person asked for
 * renders straight away. The answer is remembered on this device only.
 * "I'm under 18" leaves the app for a public exit page; nothing is stored.
 */
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import {
  UNDER_18_EXIT_PATH,
  hasConfirmedAdult,
  isAgeGateExemptPath,
  rememberConfirmedAdult,
} from '../lib/ageGate';

const footerLinks = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/help', label: 'Help' },
];

function FooterLinks() {
  return (
    <nav aria-label="Legal and help" className="flex flex-wrap items-center justify-center gap-x-2">
      {footerLinks.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 text-[15px] font-semibold text-[var(--cream-muted)] underline underline-offset-4"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

function GateFrame({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <main
      data-testid={testId}
      className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--bg-primary)] px-6 py-10 text-center text-[var(--cream)]"
    >
      <div className="flex w-full max-w-sm flex-col items-center">
        <BrandMark size="lg" />
        {children}
        <div className="mt-8">
          <FooterLinks />
        </div>
      </div>
    </main>
  );
}

/** Public exit page for "I'm under 18". Outside the app; no account, nothing stored. */
export function UnderAgeExit() {
  return (
    <GateFrame testId="age-gate-exit">
      <section className="mt-8 flex w-full flex-col items-center">
        <h1 className="text-[28px] font-black leading-tight">MenRush is for adults only</h1>
        <p className="mt-3 text-[17px] leading-snug text-[var(--cream-muted)]">
          You need to be 18 or over to use MenRush. You can still read our Terms, Privacy policy
          and Help.
        </p>
      </section>
    </GateFrame>
  );
}

export function FirstLaunchAgeGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState(() => hasConfirmedAdult());

  if (confirmed || isAgeGateExemptPath(pathname)) return <>{children}</>;

  return (
    <GateFrame testId="age-gate">
      <section className="mt-8 flex w-full flex-col items-center" aria-labelledby="age-gate-title">
        <h1
          id="age-gate-title"
          className="text-[64px] font-black leading-none tracking-tight text-[var(--nn-accent-text)]"
        >
          18+
        </h1>
        <p className="mt-3 text-[20px] font-bold leading-snug">Men only. 18 and over.</p>
        <p className="mt-2 text-[15px] leading-snug text-[var(--cream-muted)]">
          Please confirm your age to continue.
        </p>
        <button
          type="button"
          data-testid="age-gate-confirm"
          onClick={() => {
            rememberConfirmedAdult();
            setConfirmed(true);
          }}
          className="mt-8 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--copper)] px-6 text-[17px] font-black text-[var(--nn-on-copper)]"
        >
          I&apos;m 18 or over
        </button>
        <button
          type="button"
          data-testid="age-gate-leave"
          onClick={() => navigate(UNDER_18_EXIT_PATH, { replace: true })}
          className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-full border-2 border-[var(--copper)] px-6 text-[17px] font-bold text-[var(--cream)]"
        >
          I&apos;m under 18
        </button>
      </section>
    </GateFrame>
  );
}
