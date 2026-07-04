import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SiteFooter } from './SiteFooter';

type BetaLaunchShellProps = {
  backgroundImage: string;
  backgroundOpacity?: number;
  children: ReactNode;
  showFooter?: boolean;
};

/** Single-column auth shell — Sign In, Beta Access, Create Account. */
export function BetaLaunchShell({
  backgroundImage,
  backgroundOpacity = 0.3,
  children,
  showFooter = false,
}: BetaLaunchShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          opacity: backgroundOpacity,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgba(13,10,6,0.6)] via-[rgba(13,10,6,0.85)] to-[rgba(13,10,6,0.97)]"
        style={{ backgroundPosition: '0% 60%' }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[560px] flex-1 flex-col px-6 pb-[72px] pt-8">
        {children}
      </div>

      {showFooter ? (
        <SiteFooter className="relative z-10 shrink-0 border-t border-[#3D2B0E] bg-[rgba(13,10,6,0.92)] py-7 pb-10" />
      ) : null}
    </div>
  );
}

export function BetaLaunchBrandHeader() {
  return (
    <Link
      to="/"
      className="mb-10 inline-flex items-center gap-3 text-[#F0E0C0] no-underline transition-opacity hover:opacity-80"
    >
      <img
        src="/menrush-logo.png"
        alt=""
        className="h-[52px] w-[52px] rounded-full shadow-[0_0_0_2px_rgba(196,131,42,0.4)]"
      />
      <span className="text-[15px] font-black tracking-[0.14em]">MENRUSH</span>
    </Link>
  );
}

export function BetaLaunchHero({
  title,
  accent,
  copy,
}: {
  title: string;
  accent: string;
  copy: string;
}) {
  return (
    <>
      <h1 className="mr-beta-heading text-balance">
        {title} <span className="text-[#C4832A]">{accent}</span>
      </h1>
      <p className="mt-[22px] max-w-[480px] text-[17px] leading-[1.6] text-[#A89070]">{copy}</p>
    </>
  );
}