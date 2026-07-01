/**
 * DESIGN LOCK — public landing/auth shell. Do not regress layout or typography.
 * Invariants: .cursor/rules/public-marketing-pages.mdc
 * E2E guard: frontend/e2e/public-design-lock.spec.ts
 */
import type { ReactNode } from 'react';
import { RandomBackground } from './RandomBackground';
import { SiteFooter } from './SiteFooter';

type PublicMarketingShellProps = {
  header: ReactNode;
  hero: ReactNode;
  panel: ReactNode;
  showFooter?: boolean;
};

/**
 * Shared layout for /, /login, /register — same grid, typography shell, and
 * mobile/desktop structure so public pages stay in sync.
 */
export function PublicMarketingShell({
  header,
  hero,
  panel,
  showFooter = true,
}: PublicMarketingShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden text-[#F0E0C0]">
      <RandomBackground />
      <div className="absolute inset-0 bg-black/60" />

      <header className="relative z-20 flex h-16 shrink-0 items-center justify-end px-5 sm:px-8 lg:px-10">
        {header}
      </header>

      <div className="relative z-10 mx-auto flex min-h-0 flex-1 w-full max-w-7xl items-center px-5 py-6 sm:px-8 lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <section className="max-w-2xl self-center">{hero}</section>
          <section className="w-full max-w-md lg:justify-self-end">{panel}</section>
        </div>
      </div>

      {showFooter ? <SiteFooter className="relative z-10 shrink-0" /> : null}
    </div>
  );
}

export function PublicHeroBlock({
  title,
  accent,
  copy,
  footerNote,
}: {
  title: string;
  accent: string;
  copy: string;
  footerNote?: ReactNode;
}) {
  return (
    <>
      <h1 className="mr-hero-heading mt-7">
        {title}
        <span className="mr-hero-accent">{accent}</span>
      </h1>
      <p className="mr-copy mt-5 max-w-2xl">{copy}</p>
      {footerNote ? <div className="mt-4 max-w-2xl text-sm leading-6 text-[#A89070]/90">{footerNote}</div> : null}
    </>
  );
}
