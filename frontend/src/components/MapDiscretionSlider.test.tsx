/**
 * Discretion slider: evenly spaced steps (native value is the step index), while assistive tech
 * hears the real distance ('~250 m') and the visible value stays in metres.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MapDiscretionSlider } from './MapDiscretionSlider';
import { MAP_PIN_FUZZ_STEPS_M } from '../lib/mapPinFuzz';

const STEPS = MAP_PIN_FUZZ_STEPS_M;
const LAST = STEPS.length - 1;

function setup(valueM = 250) {
  const onChange = vi.fn();
  render(<MapDiscretionSlider wide valueM={valueM} onChange={onChange} />);
  return { onChange, range: screen.getByTestId('map-discretion-range') as HTMLInputElement };
}

describe('MapDiscretionSlider even steps', () => {
  it('runs on the step index from 0 to the last step, one per notch', () => {
    const { range } = setup(250);
    expect(range.min).toBe('0');
    expect(range.max).toBe(String(LAST));
    expect(range.step).toBe('1');
    expect(range.value).toBe(String(STEPS.indexOf(250)));
  });

  it.each(STEPS.map((m, i) => [m, i] as const))('%i m sits at step %i, evenly spaced', (m, i) => {
    const { range } = setup(m);
    expect(range.value).toBe(String(i));
    const pct = range.style.getPropertyValue('--range-pct');
    expect(parseFloat(pct)).toBeCloseTo((i / LAST) * 100, 5);
  });

  it('short distances are not bunched: 250 m sits at the same share of the track as its step', () => {
    const { range } = setup(250);
    const pct = parseFloat(range.style.getPropertyValue('--range-pct'));
    const metreLinear = ((250 - STEPS[0]) / (STEPS[LAST] - STEPS[0])) * 100;
    expect(pct).toBeCloseTo((STEPS.indexOf(250) / LAST) * 100, 5);
    expect(pct).toBeGreaterThan(metreLinear + 10);
  });

  it('moving one notch reports the next or previous distance in metres', () => {
    const { range, onChange } = setup(250);
    const i = STEPS.indexOf(250);
    fireEvent.change(range, { target: { value: String(i + 1) } });
    expect(onChange).toHaveBeenLastCalledWith(STEPS[i + 1]);
    fireEvent.change(range, { target: { value: String(i - 1) } });
    expect(onChange).toHaveBeenLastCalledWith(STEPS[i - 1]);
    fireEvent.change(range, { target: { value: String(LAST) } });
    expect(onChange).toHaveBeenLastCalledWith(STEPS[LAST]);
  });
});

describe('MapDiscretionSlider reads metres', () => {
  it.each(STEPS.map((m) => [m] as const))('%i m: aria-valuetext and the visible value read ~%i m', (m) => {
    const { range } = setup(m);
    expect(range).toHaveAttribute('aria-label', 'Discretion');
    expect(range).toHaveAttribute('aria-valuetext', `~${m} m`);
    expect(range).toHaveAttribute('aria-valuenow', String(m));
    expect(range).toHaveAttribute('aria-valuemin', String(STEPS[0]));
    expect(range).toHaveAttribute('aria-valuemax', String(STEPS[LAST]));
    expect(screen.getByTestId('map-discretion-pill')).toHaveTextContent(`~${m} m`);
  });

  it('never reads the step index', () => {
    const { range } = setup(250);
    expect(range.getAttribute('aria-valuetext')).not.toMatch(/^\d+$/);
    expect(range.getAttribute('aria-valuetext')).not.toBe(range.value);
  });
});
