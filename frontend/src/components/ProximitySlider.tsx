export const RADIUS_OPTIONS = [1, 5, 10, 25, 50] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];

interface ProximitySliderProps {
  value: number;
  onChange: (km: RadiusKm) => void;
  className?: string;
  variant?: 'card' | 'map';
}

function indexForRadius(km: number): number {
  const idx = RADIUS_OPTIONS.indexOf(km as RadiusKm);
  return idx >= 0 ? idx : RADIUS_OPTIONS.indexOf(5);
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
        className={`flex shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-card)]/90 font-black leading-none text-[var(--cream)] transition-colors enabled:hover:border-[var(--copper)] enabled:hover:text-[var(--copper)] disabled:opacity-35 ${
          isMap ? 'h-9 w-9 text-lg' : 'h-8 w-8 text-lg'
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
          aria-label={`Search radius ${value} kilometres`}
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
        className={`flex shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-card)]/90 font-black leading-none text-[var(--cream)] transition-colors enabled:hover:border-[var(--copper)] enabled:hover:text-[var(--copper)] disabled:opacity-35 ${
          isMap ? 'h-9 w-9 text-lg' : 'h-8 w-8 text-lg'
        }`}
      >
        +
      </button>
    </div>
  );

  if (isMap) {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-full border border-[var(--border-default)]/70 bg-[var(--bg-elevated)]/75 p-1.5 shadow-lg backdrop-blur-md ${className}`}
        data-testid="proximity-slider"
        aria-label={`Search radius ${value} kilometres`}
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
        <p className="text-[11px] font-black text-[var(--copper)] tabular-nums">
          {value} km
        </p>
      </div>
      {controls}
    </div>
  );
}
