/**
 * Empty map radius state: "Nobody in this radius" + Widen to N mi.
 */
import { formatRadiusControlLabel } from '../lib/discoveryFormat';

export function MapEmptyRadius({
  nextRadiusKm,
  onWiden,
}: {
  nextRadiusKm: number;
  onWiden: () => void;
}) {
  const label = formatRadiusControlLabel(nextRadiusKm);
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-center px-4"
      data-testid="map-empty-radius"
    >
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/95 px-5 py-5 text-center shadow-lg backdrop-blur-md">
        <p className="text-[17px] font-extrabold text-[var(--cream)]">Nobody in this radius</p>
        <button
          type="button"
          data-testid="map-widen-radius"
          onClick={onWiden}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#C4832A] px-5 py-2.5 text-[15px] font-extrabold text-[#1A0E03] transition-opacity hover:opacity-90"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden focusable="false">
            <circle cx="12" cy="12" r="8" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Widen to {label}
        </button>
      </div>
    </div>
  );
}
