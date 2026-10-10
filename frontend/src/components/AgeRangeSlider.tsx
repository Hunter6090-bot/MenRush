import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * Age range on ONE track with two handles (Claude Design board, Filters state 04).
 * Each handle is a role="slider" with a 44px target, arrow / Page / Home / End keys,
 * and an aria-valuetext that reads the age. Min never passes max and max never
 * passes min. Colours as on board 05: copper between the handles, cream handles.
 * The handle is board cream (#FFF6E6) inside a dark --nn-on-copper ring, so it stands
 * out >= 3:1 against both the card and the copper fill in light and dark
 * (AgeRangeSlider.test.tsx). The empty track is the quiet --border-default.
 */
export const AGE_SLIDER_COLOURS = {
  fill: 'var(--nn-copper)',
  track: 'var(--border-default)',
  handle: '#FFF6E6',
  handleRing: 'var(--nn-on-copper)',
} as const;
export function AgeRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
}: {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (lo: number, hi: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<'min' | 'max'>('max');
  const span = Math.max(1, max - min);
  const pct = (v: number) => ((v - min) / span) * 100;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

  const set = (which: 'min' | 'max', v: number) => {
    if (which === 'min') onChange(clamp(v, min, valueMax), valueMax);
    else onChange(valueMin, clamp(v, valueMin, max));
  };

  const valueAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return null;
    return min + ((clientX - r.left) / r.width) * span;
  };

  const onKey = (which: 'min' | 'max') => (e: KeyboardEvent) => {
    const cur = which === 'min' ? valueMin : valueMax;
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -5,
      PageUp: 5,
    };
    let next: number | null = null;
    if (e.key in step) next = cur + step[e.key];
    else if (e.key === 'Home') next = which === 'min' ? min : valueMin;
    else if (e.key === 'End') next = which === 'min' ? valueMax : max;
    if (next == null) return;
    e.preventDefault();
    setActive(which);
    set(which, next);
  };

  const onPointerDown = (which: 'min' | 'max') => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setActive(which);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (which: 'min' | 'max') => (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
    const v = valueAt(e.clientX);
    if (v != null) set(which, v);
  };

  /** Tap on the track moves the nearer handle there. */
  const onTrackPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const v = valueAt(e.clientX);
    if (v == null) return;
    const which = Math.abs(v - valueMin) <= Math.abs(v - valueMax) && v <= valueMax ? 'min' : 'max';
    setActive(which);
    set(which, v);
  };

  const handle = (which: 'min' | 'max') => {
    const v = which === 'min' ? valueMin : valueMax;
    return (
      <div
        role="slider"
        tabIndex={0}
        aria-label={which === 'min' ? 'Minimum age' : 'Maximum age'}
        aria-valuemin={which === 'min' ? min : valueMin}
        aria-valuemax={which === 'min' ? valueMax : max}
        aria-valuenow={v}
        aria-valuetext={`${which === 'min' ? 'From' : 'To'} age ${v}`}
        data-testid={`filter-age-${which}`}
        onKeyDown={onKey(which)}
        onPointerDown={onPointerDown(which)}
        onPointerMove={onPointerMove(which)}
        onFocus={() => setActive(which)}
        className={`absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--nn-accent-text)] ${
          active === which ? 'z-20' : 'z-10'
        }`}
        style={{ left: `${pct(v)}%` }}
      >
        <span
          aria-hidden="true"
          data-testid={`filter-age-${which}-thumb`}
          className="block h-6 w-6 rounded-full border-[3px] border-[var(--nn-on-copper)] bg-[#FFF6E6] shadow"
        />
      </div>
    );
  };

  return (
    <div className="relative mx-[22px] h-11" data-testid="filter-age-slider" onPointerDown={onTrackPointerDown}>
      <div
        ref={trackRef}
        data-testid="filter-age-track"
        className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--border-default)]"
      >
        <div
          data-testid="filter-age-fill"
          className="absolute inset-y-0 rounded-full bg-[var(--nn-copper)]"
          style={{ left: `${pct(valueMin)}%`, right: `${100 - pct(valueMax)}%` }}
        />
      </div>
      {handle('min')}
      {handle('max')}
    </div>
  );
}
