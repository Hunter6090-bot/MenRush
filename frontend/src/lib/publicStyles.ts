/** Shared public marketing / auth surfaces — synced with beta-launch-handoff design tokens. */

export const publicNavLinkPrimary =
  'rounded-[14px] border border-[rgba(240,224,192,0.4)] bg-[rgba(13,10,6,0.45)] px-[22px] py-[14px] text-[15px] font-bold text-[#F0E0C0] no-underline transition-colors hover:border-[rgba(196,131,42,0.6)] hover:text-[#E0A14A]';

export const publicNavLinkSecondary = publicNavLinkPrimary;

export const publicPanelClass =
  'mt-[34px] flex flex-col gap-5 rounded-[24px] border border-[rgba(240,224,192,0.35)] bg-[rgba(13,10,6,0.45)] px-6 py-7';

export const publicInputClass =
  'w-full rounded-full border-0 bg-[#F5EBD8] px-6 py-[18px] text-base text-[#2A1C0A] placeholder:text-[#8B6B42]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/40 disabled:opacity-50';

export const publicCodeInputClass =
  'w-full rounded-2xl border-0 bg-[#F5EBD8] px-6 py-[18px] font-mono text-[17px] uppercase tracking-[0.14em] text-[#2A1C0A] placeholder:normal-case placeholder:font-sans placeholder:text-[17px] placeholder:tracking-normal placeholder:text-[#8B6B42]/70 focus:outline-none focus:ring-2 focus:ring-[#C4832A]/40 disabled:opacity-50';

export const publicLabelClass =
  'block text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#F0E0C0]';

export const publicLabelCopperClass =
  'block text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#E0A14A]';

export const publicPrimaryButtonClass =
  'flex w-full items-center justify-center gap-2 rounded-full border-0 bg-gradient-to-r from-[#C4832A] to-[#A45E18] px-6 py-[17px] text-[17px] font-bold text-[#FFF6E6] shadow-[0_0_24px_rgba(196,131,42,0.3)] transition-all duration-[240ms] hover:from-[#E0A14A] hover:to-[#C4832A] active:scale-[0.97] disabled:opacity-50';

export const publicErrorClass = 'text-sm font-semibold text-[#B0432E]';

export const publicLinkClass = 'font-bold text-[#C4832A] no-underline transition-colors hover:text-[#E0A14A]';

export const publicInviteChipClass =
  'flex items-center justify-between gap-3 rounded-full border border-[rgba(196,131,42,0.45)] bg-[rgba(196,131,42,0.12)] px-5 py-3';

export const publicHeroLogoClass = 'h-28 sm:h-32';

export const publicSecondaryButtonClass =
  'flex w-full items-center justify-center gap-2 rounded-full border border-[rgba(240,224,192,0.35)] bg-[rgba(13,10,6,0.45)] px-6 py-[17px] text-[17px] font-bold text-[#F0E0C0] transition-colors hover:border-[rgba(196,131,42,0.6)] disabled:opacity-50';

export const publicSelectClass =
  'w-full rounded-full border-0 bg-[#F5EBD8] px-6 py-[18px] text-base text-[#2A1C0A] focus:outline-none focus:ring-2 focus:ring-[#C4832A]/40';

/** Dark select for in-app verify document steps (WebApp.dc.html doc flow). */
export const publicDarkSelectClass =
  'w-full rounded-xl border border-[#3D2B0E] bg-[#1E1508] px-4 py-3.5 text-[15px] text-[#F0E0C0] focus:outline-none focus:ring-2 focus:ring-[#C4832A]/40';

export const publicInfoBoxClass =
  'rounded-[18px] border border-[rgba(240,224,192,0.2)] bg-[rgba(13,10,6,0.35)] px-5 py-4';

export const publicMutedCopyClass = 'text-[15px] leading-[1.55] text-[#A89070]';

export const publicBackButtonClass =
  'mt-3 w-full text-center text-[15px] font-semibold text-[#A89070] transition-colors hover:text-[#C4832A]';

export const publicDocTypeButtonClass = (active: boolean) =>
  active
    ? 'flex flex-col items-center gap-1.5 rounded-[14px] border border-[#C4832A] bg-[rgba(196,131,42,0.2)] px-3 py-4 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#F0E0C0]'
    : 'flex flex-col items-center gap-1.5 rounded-[14px] border border-[rgba(240,224,192,0.25)] bg-[rgba(13,10,6,0.45)] px-3 py-4 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[#A89070] transition-colors hover:border-[rgba(196,131,42,0.5)]';

export const publicSignOutClass =
  'mt-3 w-full text-center text-[15px] font-bold text-[#6B5840] transition-colors hover:text-[#B0432E]';

export const publicProgressTrackClass = 'h-1.5 overflow-hidden rounded-full bg-[rgba(61,43,14,0.8)]';

export const publicProgressFillClass = 'h-full bg-gradient-to-r from-[#C4832A] to-[#A45E18] transition-all duration-300';
