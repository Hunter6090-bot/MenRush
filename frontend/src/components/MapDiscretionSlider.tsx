import { useRef, type CSSProperties } from 'react';
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
  const min = steps[0];
  const max = steps[steps.length - 1];
  const snapped = nearestMapPinFuzzStep(valueM);
  const index = Math.max(0, steps.indexOf(snapped));
  const label = formatFuzzMetersLabel(snapped);
  const fillPct = max > min ? ((snapped - min) / (max - min)) * 100 : 0;
  // The native value is in metres so screen readers (and the accessibility tree) read the real
  // distance, never a step index. Pointer drags snap to the nearest step; keyboard and assistive
  // tech nudges (+/- 1 m) move one whole step in that direction.
  const pointerDown = useRef(false);
  const handleChange = (raw: number) => {
    if (!Number.isFinite(raw) || raw === snapped) return;
    const nearest = nearestMapPinFuzzStep(raw);
    if (pointerDown.current || nearest !== snapped) {
      onChange(nearest);
      return;
    }
    const next = steps[Math.min(steps.length - 1, Math.max(0, index + (raw > snapped ? 1 : -1)))];
    onChange(next ?? snapped);
  };

  return (
    <div
      className={`flex ${wide ? 'w-full min-h-[48px] flex-wrap gap-y-2 rounded-2xl' : 'max-w-[min(100%,220px)] rounded-full'} items-center gap-1.5 border border-[var(--border-default)] bg-[var(--bg-card)] px-2.5 py-1.5 shadow-lg ${className}`}
      data-testid="map-discretion-slider"
      title="How far others see your pin from your real spot"
    >
      <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-extrabold uppercase tracking-[0.12em] text-[var(--cream)]">
        <IconDiscretion size={14} className="text-[var(--nn-accent-text)]" data-testid="map-discretion-icon" />
        Discretion
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={snapped}
        disabled={disabled}
        onPointerDown={() => {
          pointerDown.current = true;
          const release = () => {
            pointerDown.current = false;
            window.removeEventListener('pointerup', release);
            window.removeEventListener('pointercancel', release);
          };
          window.addEventListener('pointerup', release);
          window.addEventListener('pointercancel', release);
        }}
        onChange={(event) => handleChange(Number(event.target.value))}
        aria-label="Discretion"
        aria-valuetext={label}
        className={`proximity-range min-w-0 flex-1 ${wide ? 'proximity-range--tall order-last basis-full' : ''}`}
        style={wide ? ({ '--range-pct': `${fillPct}%` } as CSSProperties) : undefined}
        data-testid="map-discretion-range"
      />
      <span
        className={`${wide ? 'ml-auto ' : ''}shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-[15px] font-extrabold tabular-nums tracking-wide text-[var(--cream)]`}
        data-testid="map-discretion-pill"
      >
        {label}
      </span>
    </div>
  );
}
