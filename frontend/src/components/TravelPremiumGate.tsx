import { Link } from 'react-router-dom';
import { IconPlane } from './icons';
import { TRAVEL_COPY } from '../lib/travel';

/** Honest Premium card for Travel. Says only what Travel does. */
export function TravelPremiumGate() {
  return (
    <div
      className="rounded-[var(--nn-radius-lg)] border border-[var(--nn-border)] bg-[var(--nn-card)] p-4"
      data-testid="travel-premium-gate"
    >
      <div className="flex items-center gap-2 text-[var(--nn-accent-text)]">
        <IconPlane size={22} />
        <p className="text-[17px] font-extrabold text-[var(--nn-text)]">{TRAVEL_COPY.premiumTitle}</p>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--nn-muted)]">{TRAVEL_COPY.premiumBody}</p>
      <Link
        to="/premium"
        data-testid="travel-premium-cta"
        className="mt-3 inline-flex min-h-[44px] items-center rounded-full bg-[var(--nn-copper)] px-5 text-[15px] font-extrabold text-[var(--nn-on-copper)]"
      >
        {TRAVEL_COPY.premiumCta}
      </Link>
    </div>
  );
}
