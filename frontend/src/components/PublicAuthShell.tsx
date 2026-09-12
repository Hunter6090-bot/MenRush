/**
 * Single-column auth shell — MenRush Design System handoff + beta-launch-handoff.
 * Brand: bronze two-profile medallion (master: brand/menrush-logo.png).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { RandomBackground } from './RandomBackground';
import { SiteFooter } from './SiteFooter';

/** Default auth overlay — darker; photo less visible. */
const AUTH_GRADIENT =
  'linear-gradient(180deg, rgba(13,10,6,.6) 0%, rgba(13,10,6,.85) 60%, rgba(13,10,6,.97) 100%)';

/**
 * Age-check / upsell / underage (#97 Al lock) — lighter scrim so RandomBackground
 * photo detail reads clearly behind the card.
 */
export const AUTH_ASSURANCE_GRADIENT =
  'linear-gradient(180deg, rgba(13,10,6,.32) 0%, rgba(13,10,6,.48) 50%, rgba(13,10,6,.72) 100%)';

/** Brighter random photo for assurance screens (Al 2026-09-12). */
export const AUTH_ASSURANCE_BACKGROUND_OPACITY = 0.52;
export const AUTH_ASSURANCE_BRIGHTNESS = 1.08;

/** Fixed photos for verify / profile-setup flows (not the public random pool). */
export const AUTH_BACKGROUNDS = {
  beta: '/images/menrush/21-pride-parade-flags.jpeg',
  login: '/images/menrush/09-cigar-daddy-bar.jpeg',
  register: '/images/menrush/02-soho-night-crowd.jpeg',
  verify: '/images/menrush/18-bears-hollow-sign.jpeg',
  verifyScan: '/images/menrush/04-leather-harness-bears.jpeg',
} as const;

type PublicAuthShellProps = {
  /**
   * When set, use a fixed photo. When omitted, RandomBackground picks per
   * pathname (and on refresh). Age-check / upsell / underage must omit this.
   */
  backgroundImage?: string;
  backgroundOpacity?: number;
  /** CSS brightness for RandomBackground (default 0.95; assurance ~1.08). */
  backgroundBrightness?: number;
  /** Overlay gradient. Pass AUTH_ASSURANCE_GRADIENT on age-check screens. */
  gradientOverlay?: string;
  homeTo?: string;
  children: ReactNode;
  showFooter?: boolean;
};

export function PublicAuthShell({
  backgroundImage,
  backgroundOpacity = 0.3,
  backgroundBrightness,
  gradientOverlay = AUTH_GRADIENT,
  homeTo = '/coming-soon',
  children,
  showFooter = false,
}: PublicAuthShellProps) {
  return (
    <div className="relative flex min-h-dvh max-w-full flex-col overflow-x-clip overflow-hidden bg-[#0D0A06] text-[#F0E0C0]">
      {backgroundImage ? (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            opacity: backgroundOpacity,
            ...(backgroundBrightness !== undefined
              ? { filter: `saturate(1.05) brightness(${backgroundBrightness})` }
              : {}),
          }}
          aria-hidden
        />
      ) : (
        <RandomBackground
          opacity={backgroundOpacity}
          brightness={backgroundBrightness}
        />
      )}
      <div className="absolute inset-0" style={{ background: gradientOverlay }} aria-hidden />

      <div className="relative mx-auto flex w-full max-w-[560px] flex-1 flex-col px-6 pb-[72px] pt-8">
        <Link
          to={homeTo}
          className="mb-10 inline-block w-fit hover:opacity-80 transition-opacity"
        >
          <BrandMark size="auth" />
        </Link>
        {children}
      </div>

      {showFooter ? (
        <SiteFooter className="relative shrink-0 border-t border-[#3D2B0E] bg-[rgba(13,10,6,0.92)] px-6 pb-10 pt-7" />
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
      <p className="mt-[22px] max-w-[480px] text-[17px] leading-[1.6] text-[var(--cream-muted)]">{copy}</p>
    </>
  );
}
