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
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[var(--border-default)] bg-[rgba(30,21,8,0.95)] px-5 py-5 text-center shadow-lg backdrop-blur-md">
        <p className="text-[17px] font-extrabold text-[#F0E0C0]">Nobody in this radius</p>
        <button
          type="button"
          data-testid="map-widen-radius"
          onClick={onWiden}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#C4832A] px-5 py-2.5 text-[13px] font-extrabold text-[#1A0E03] transition-opacity hover:opacity-90"
        >
          Widen to {label}
        </button>
      </div>
    </div>
  );
}
