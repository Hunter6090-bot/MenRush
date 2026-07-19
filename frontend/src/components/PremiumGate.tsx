import { formatRadiusFromKm } from '../lib/localeUnits';

interface PremiumGateProps {
  headline?: string;
  subline?: string;
  perks?: string[];
  ctaLabel?: string;
  onClose: () => void;
  onUnlock?: () => void;
}

/** Premium upsell — copper on near-black, no fake scarcity. */
export function PremiumGate({
  headline = '3 men matched you.',
  subline = 'See them. Open chat. Skip the queue.',
  perks = [
    'See who matched you',
    `Expand radius to ${formatRadiusFromKm(161)}`,
    'Message without matching',
    'Boost — top of nearby for 30 min',
    'Incognito · advanced filters',
  ],
  ctaLabel = 'Unlock — £9.99/mo',
  onClose,
  onUnlock,
}: PremiumGateProps) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="MenRush Premium"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-nn-card rounded-[20px] border border-nn-copper/50 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_60px_rgba(196,131,42,0.2)] animate-slide-up overflow-hidden"
      >
        <div className="relative px-6 pt-7 pb-5 text-center overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              background:
                'radial-gradient(circle at center 35%, rgba(196,131,42,0.35) 0%, transparent 55%)',
            }}
          />
          <div className="relative">
            <p className="nn-overline mb-3">MenRush Premium</p>
            <h2 className="font-display text-[26px] font-bold tracking-wide uppercase text-nn-text">
              {headline}
            </h2>
            <p className="text-sm text-nn-muted mt-1">{subline}</p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <ul className="space-y-2 mb-5">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5 text-sm text-nn-text">
                <CheckIcon />
                {perk}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              onUnlock?.();
              onClose();
            }}
            className="w-full py-3.5 rounded-full bg-nn-copper text-[#1A0E03] font-semibold text-sm tracking-wide uppercase shadow-glow-copper hover:bg-nn-copper-bright active:scale-95 transition-all"
          >
            {ctaLabel}
          </button>
          <p className="text-center text-[11px] text-nn-faint mt-3">Cancel anytime. No fake timers.</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-nn-bg/70 border border-nn-border text-nn-text flex items-center justify-center hover:border-nn-copper/40 transition-colors"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="text-nn-copper shrink-0" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
