/**
 * Empty map radius state. The pinned footer is a single-line pill so short
 * and landscape maps keep room for Radius / Filters. The taller card stays
 * available for the scrolling top stack if a caller wants it.
 */
import { formatRadiusControlLabel } from '../lib/discoveryFormat';

export function MapEmptyRadius({
  nextRadiusKm,
  onWiden,
  compact = false,
}: {
  nextRadiusKm: number;
  onWiden: () => void;
  /** Compact pill: "Nobody in this radius" (15px, may wrap) + Widen. */
  compact?: boolean;
}) {
  const label = formatRadiusControlLabel(nextRadiusKm);
  if (compact) {
    return (
      <div className="pointer-events-none flex justify-center px-2 py-1">
        <div
          className="pointer-events-auto inline-flex min-h-[44px] max-w-[calc(100%-7.5rem)] flex-nowrap items-center gap-2 rounded-full border border-[var(--border-default)] bg-[rgba(30,21,8,0.95)] py-1 pl-3 pr-1 shadow-lg backdrop-blur-md"
          data-testid="map-empty-radius"
        >
          <span className="min-w-0 text-left text-[15px] font-extrabold leading-tight text-[#F0E0C0]">
            Nobody in this radius
          </span>
          <button
            type="button"
            data-testid="map-widen-radius"
            onClick={onWiden}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--copper)] px-3.5 text-[15px] font-extrabold text-[var(--nn-on-copper)]"
          >
            <RadiusIcon />
            Widen to {label}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="pointer-events-none flex justify-center px-4 pb-2 pt-1">
      <div
        className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[var(--border-default)] bg-[rgba(30,21,8,0.95)] px-5 py-5 text-center shadow-lg backdrop-blur-md"
        data-testid="map-empty-radius"
      >
        <p className="text-[17px] font-extrabold text-[#F0E0C0]">Nobody in this radius</p>
        <button
          type="button"
          data-testid="map-widen-radius"
          onClick={onWiden}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[var(--copper)] px-5 py-2.5 text-[15px] font-extrabold text-[var(--nn-on-copper)] transition-opacity hover:opacity-90"
        >
          <RadiusIcon />
          Widen to {label}
        </button>
      </div>
    </div>
  );
}

/**
 * Board radius icon (two rings) on the Widen button. Stroke is currentColor, so it
 * takes the button's --nn-on-copper on --copper (contrast-tested >= 3:1, both themes).
 */
export function RadiusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
      focusable="false"
      data-icon="radius"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
