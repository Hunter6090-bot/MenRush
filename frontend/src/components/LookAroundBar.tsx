import { IconPlane } from './icons';
import { TRAVEL_COPY, lookingAroundLabel } from '../lib/travel';

/** Always-visible label while browsing another city, with one tap back to Near me. */
export function LookAroundBar({ city, onNearMe }: { city: string; onNearMe: () => void }) {
  return (
    <div
      role="status"
      data-testid="look-around-bar"
      className="flex min-h-[52px] items-center gap-3 rounded-[var(--nn-radius-lg)] border border-[var(--nn-border)] bg-[var(--nn-elevated)] px-3 py-1.5 shadow-[var(--nn-shadow-card)]"
    >
      <span className="text-[var(--nn-accent-text)]">
        <IconPlane size={20} />
      </span>
      {/* Wraps instead of cutting off: a long city name drops to a second line at 360px. */}
      <p
        className="min-w-0 flex-1 whitespace-normal break-words text-[15px] font-bold leading-snug text-[var(--nn-text)]"
        data-testid="look-around-label"
        aria-label={lookingAroundLabel(city)}
      >
        <span>Looking around: </span>
        <span className="[overflow-wrap:anywhere]">{city}</span>
      </p>
      <button
        type="button"
        onClick={onNearMe}
        data-testid="look-around-near-me"
        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center rounded-full bg-[var(--nn-copper)] px-4 text-[15px] font-extrabold text-[var(--nn-on-copper)]"
      >
        {TRAVEL_COPY.nearMe}
      </button>
    </div>
  );
}
