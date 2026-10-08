import {
  formatFuzzMetersLabel,
  MAP_PIN_FUZZ_STEPS_M,
  nearestMapPinFuzzStep,
} from '../lib/mapPinFuzz';
import { IconDiscretion } from './icons';

interface MapDiscretionSliderProps {
  valueM: number;
  onChange: (meters: number) => void;
  className?: string;
  /** Full-width layout for the top-right Menu. */
  wide?: boolean;
  disabled?: boolean;
}

/**
 * Map chrome: location randomization / discretion (how far others see your pin).
 * Search radius stays on the list "All" miles dropdown — do not duplicate it here.
 */
export function MapDiscretionSlider({
  valueM,
  onChange,
  className = '',
  wide = false,
  disabled = false,
}: MapDiscretionSliderProps) {
  const steps = MAP_PIN_FUZZ_STEPS_M;
  const snapped = nearestMapPinFuzzStep(valueM);
  const index = Math.max(0, steps.indexOf(snapped));
  const label = formatFuzzMetersLabel(snapped);

  return (
    <div
      className={`flex ${wide ? 'w-full min-h-[48px] flex-wrap gap-y-2 rounded-2xl' : 'max-w-[min(100%,220px)] rounded-full'} items-center gap-1.5 border border-[rgba(196,131,42,0.4)] bg-[color-mix(in_srgb,#FFF8F0_88%,transparent)] px-2.5 py-1.5 shadow-lg backdrop-blur-md ${className}`}
      data-testid="map-discretion-slider"
      title="How far others see your pin from your real spot"
    >
      <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-extrabold uppercase tracking-[0.12em] text-[#3D2B0E]/90">
        <IconDiscretion size={14} className="text-[#3D2B0E]" data-testid="map-discretion-icon" />
        Discretion
      </span>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={index}
        disabled={disabled}
        onChange={(event) => onChange(steps[Number(event.target.value)] ?? snapped)}
        aria-label={`Discretion ${label}`}
        aria-valuemin={steps[0]}
        aria-valuemax={steps[steps.length - 1]}
        aria-valuenow={snapped}
        aria-valuetext={label}
        className={`proximity-range min-w-0 flex-1 ${wide ? 'order-last basis-full' : ''}`}
        data-testid="map-discretion-range"
      />
      <span
        className={`${wide ? 'ml-auto ' : ''}shrink-0 rounded-full border border-[rgba(196,131,42,0.45)] bg-[color-mix(in_srgb,#FFF8F0_92%,transparent)] px-2 py-1 text-[15px] font-extrabold tabular-nums tracking-wide text-[#3D2B0E]`}
        data-testid="map-discretion-pill"
      >
        {label}
      </span>
    </div>
  );
}
