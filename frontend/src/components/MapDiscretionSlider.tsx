import {
  formatFuzzMetersLabel,
  MAP_PIN_FUZZ_STEPS_M,
  nearestMapPinFuzzStep,
} from '../lib/mapPinFuzz';

interface MapDiscretionSliderProps {
  valueM: number;
  onChange: (meters: number) => void;
  className?: string;
}

/**
 * Map chrome: location randomization / discretion (how far others see your pin).
 * Search radius stays on the list "All" miles dropdown — do not duplicate it here.
 */
export function MapDiscretionSlider({
  valueM,
  onChange,
  className = '',
}: MapDiscretionSliderProps) {
  const steps = MAP_PIN_FUZZ_STEPS_M;
  const snapped = nearestMapPinFuzzStep(valueM);
  const index = Math.max(0, steps.indexOf(snapped));
  const label = formatFuzzMetersLabel(snapped);

  return (
    <div
      className={`flex max-w-[min(100%,220px)] items-center gap-1.5 rounded-full border border-[rgba(196,131,42,0.4)] bg-[color-mix(in_srgb,#FFF8F0_88%,transparent)] px-2.5 py-1.5 shadow-lg backdrop-blur-md ${className}`}
      data-testid="map-discretion-slider"
      title="How far others see your pin from your real spot"
    >
      <span className="shrink-0 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#3D2B0E]/90">
        Discretion
      </span>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={index}
        onChange={(event) => onChange(steps[Number(event.target.value)] ?? snapped)}
        aria-label={`Discretion ${label}`}
        aria-valuemin={steps[0]}
        aria-valuemax={steps[steps.length - 1]}
        aria-valuenow={snapped}
        aria-valuetext={label}
        className="proximity-range min-w-0 flex-1"
        data-testid="map-discretion-range"
      />
      <span
        className="shrink-0 rounded-full border border-[rgba(196,131,42,0.45)] bg-[color-mix(in_srgb,#FFF8F0_92%,transparent)] px-2 py-1 text-[10px] font-extrabold tabular-nums tracking-wide text-[#3D2B0E]"
        data-testid="map-discretion-pill"
      >
        {label}
      </span>
    </div>
  );
}
