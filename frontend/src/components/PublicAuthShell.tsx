/**
 * Single-column auth shell — MenRush Design System handoff + beta-launch-handoff.
 * Brand: CSS radar BrandMark (motion-radar.html) — no bronze coin/medallion PNGs.
 * Used by /beta, /login, /register (not landing / coming-soon).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { SiteFooter } from './SiteFooter';

const AUTH_GRADIENT =
  'linear-gradient(180deg, rgba(13,10,6,.6) 0%, rgba(13,10,6,.85) 60%, rgba(13,10,6,.97) 100%)';

export const AUTH_BACKGROUNDS = {
  beta: '/images/menrush/21-pride-parade-flags.jpeg',
  login: '/images/menrush/09-cigar-daddy-bar.jpeg',
  register: '/images/menrush/02-soho-night-crowd.jpeg',
} as const;

type PublicAuthShellProps = {
  backgroundImage: string;
  backgroundOpacity?: number;
  homeTo?: string;
  children: ReactNode;
  showFooter?: boolean;
};

export function PublicAuthShell({
  backgroundImage,
  backgroundOpacity = 0.3,
  homeTo = '/coming-soon',
  children,
  showFooter = false,
}: PublicAuthShellProps) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})`, opacity: backgroundOpacity }}
        aria-hidden
      />
      <div className="absolute inset-0" style={{ background: AUTH_GRADIENT }} aria-hidden />

      <div className="relative mx-auto flex w-full max-w-[560px] flex-1 flex-col px-6 pb-[72px] pt-8">
        <Link
          to={homeTo}
          className="mb-10 inline-block w-fit hover:opacity-80 transition-opacity"
        >
          <BrandMark size="lg" showWordmark />
        </Link>
        {children}
      </div>

      {showFooter ? (
        <SiteFooter className="relative shrink-0 border-t border-[#3D2B0E] bg-[rgba(13,10,6,0.92)] py-7" />
      ) : null}
    </div>
  );
}

export function PublicAuthHero({
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
      <h1 className="mr-auth-heading text-balance">
        {title} <span className="mr-auth-accent">{accent}</span>
      </h1>
      <p className="mt-[22px] max-w-[480px] text-[17px] leading-[1.6] text-[#A89070]">{copy}</p>
    </>
  );
}
