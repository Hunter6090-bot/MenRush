import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
  const committedIndex = Math.max(0, steps.indexOf(snapped));
  // While a finger or mouse drags, the thumb and value follow a local draft and nothing is saved.
  // The draft is committed once, on release. Keyboard and assistive tech steps commit straight away
  // (once per step).
  const [draftIndex, setDraftIndex] = useState<number | null>(null);
  const index = draftIndex ?? committedIndex;
  const shown = steps[index] ?? snapped;
  const label = formatFuzzMetersLabel(shown);
  // Evenly spaced steps: the native range runs on the step index, so short distances are not
  // bunched at the left end. Assistive tech reads the real distance from aria-valuetext ('~250 m')
  // and aria-valuenow / min / max in metres.
  const fillPct = steps.length > 1 ? (index / (steps.length - 1)) * 100 : 0;

  const dragging = useRef(false);
  const draftRef = useRef<number | null>(null);
  const committedRef = useRef(committedIndex);
  committedRef.current = committedIndex;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => () => releaseRef.current?.(), []);

  const startDrag = () => {
    if (dragging.current) return;
    dragging.current = true;
    const release = () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      releaseRef.current = null;
      dragging.current = false;
      const draft = draftRef.current;
      draftRef.current = null;
      setDraftIndex(null);
      if (draft !== null && draft !== committedRef.current) onChangeRef.current(steps[draft]);
    };
    releaseRef.current = release;
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  };

  const handleInput = (next: number) => {
    if (!Number.isInteger(next) || next < 0 || next >= steps.length) return;
    if (dragging.current) {
      draftRef.current = next;
      setDraftIndex(next);
      return;
    }
    if (next !== committedRef.current) onChange(steps[next]);
  };

  return (
    <div
      className={`flex ${wide ? 'w-full min-h-[48px] flex-wrap gap-y-2 rounded-2xl' : 'max-w-[min(100%,220px)] rounded-full'} items-center gap-1.5 border border-[var(--border-default)] bg-[var(--bg-card)] px-2.5 py-1.5 shadow-lg ${className}`}
      data-testid="map-discretion-slider"
      title="Your pin moves up to this far from your real spot."
    >
      <span className="inline-flex shrink-0 items-center gap-1 text-[15px] font-extrabold uppercase tracking-[0.12em] text-[var(--cream)]">
        <IconDiscretion size={14} className="text-[var(--nn-accent-text)]" data-testid="map-discretion-icon" />
        Discretion
      </span>
      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={index}
        disabled={disabled}
        onPointerDown={startDrag}
        onChange={(event) => handleInput(Number(event.target.value))}
        aria-label="Discretion"
        aria-valuemin={steps[0]}
        aria-valuemax={steps[steps.length - 1]}
        aria-valuenow={shown}
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
