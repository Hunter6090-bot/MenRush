import { formatRadiusFromKm, resolveDistanceUnitSystem } from '../lib/localeUnits';

export const RADIUS_OPTIONS = [1, 5, 10, 25, 50] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];

interface ProximitySliderProps {
  value: number;
  onChange: (km: RadiusKm) => void;
  className?: string;
  variant?: 'card' | 'map';
}

function indexForRadius(km: number): number {
  if (!Number.isFinite(km)) return RADIUS_OPTIONS.indexOf(5);
  // At or above max slider stop → pin to max so Expand/+ is not a no-op loop.
  if (km >= RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1]) {
    return RADIUS_OPTIONS.length - 1;
  }
  let best = 0;
  for (let i = 1; i < RADIUS_OPTIONS.length; i += 1) {
    if (Math.abs(RADIUS_OPTIONS[i] - km) < Math.abs(RADIUS_OPTIONS[best] - km)) {
      best = i;
    }
  }
  return best;
}

export function ProximitySlider({
  value,
  onChange,
  className = '',
  variant = 'card',
}: ProximitySliderProps) {
  const index = indexForRadius(value);
  const atMin = index <= 0;
  const atMax = index >= RADIUS_OPTIONS.length - 1;
  const isMap = variant === 'map';
  const radiusLabel = formatRadiusFromKm(value, resolveDistanceUnitSystem());
  const mapChip =
    'border-[rgba(196,131,42,0.45)] bg-[color-mix(in_srgb,#FFF8F0_92%,transparent)] text-[#3D2B0E] shadow-md';
  const cardChip = 'border-[var(--border-default)] bg-[var(--bg-card)]/90 text-[var(--cream)]';

  const setIndex = (next: number) => {
    const clamped = Math.max(0, Math.min(RADIUS_OPTIONS.length - 1, next));
    onChange(RADIUS_OPTIONS[clamped]);
  };

  const controls = (
    <div className={`flex items-center ${isMap ? 'gap-1.5' : 'gap-2'}`}>
      <button
        type="button"
        aria-label="Decrease search radius"
        disabled={atMin}
        onClick={() => setIndex(index - 1)}
        className={`flex shrink-0 items-center justify-center rounded-full border font-black leading-none transition-colors enabled:hover:border-[var(--copper)] disabled:opacity-35 ${
          isMap ? `h-9 w-9 text-lg ${mapChip}` : `h-8 w-8 text-lg ${cardChip}`
        }`}
      >
        −
      </button>
      {!isMap && (
        <input
          type="range"
          min={0}
          max={RADIUS_OPTIONS.length - 1}
          step={1}
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
          aria-label={`Search radius ${radiusLabel}`}
          aria-valuemin={RADIUS_OPTIONS[0]}
          aria-valuemax={RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1]}
          aria-valuenow={value}
          className="proximity-range min-w-0 flex-1"
        />
      )}
      <button
        type="button"
        aria-label="Increase search radius"
        disabled={atMax}
        onClick={() => setIndex(index + 1)}
        className={`flex shrink-0 items-center justify-center rounded-full border font-black leading-none transition-colors enabled:hover:border-[var(--copper)] disabled:opacity-35 ${
          isMap ? `h-9 w-9 text-lg ${mapChip}` : `h-8 w-8 text-lg ${cardChip}`
        }`}
      >
        +
      </button>
      {isMap ? (
        <span className={`rounded-full border px-2.5 py-1.5 text-[11px] font-extrabold tabular-nums tracking-wide ${mapChip}`}>
          {radiusLabel}
        </span>
      ) : null}
    </div>
  );

  if (isMap) {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-full border border-[rgba(196,131,42,0.4)] bg-[color-mix(in_srgb,#FFF8F0_88%,transparent)] p-1.5 shadow-lg backdrop-blur-md ${className}`}
        data-testid="proximity-slider"
        aria-label={`Search radius ${radiusLabel}`}
      >
        {controls}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-[var(--border-default)] bg-[var(--bg-elevated)]/90 px-3 py-2.5 shadow-md backdrop-blur-sm ${className}`}
      data-testid="proximity-slider"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cream-muted)]">
          Nearby radius
        </p>
        <p className="text-[11px] font-black text-[var(--copper)] tabular-nums">{radiusLabel}</p>
      </div>
      {controls}
    </div>
  );
}
