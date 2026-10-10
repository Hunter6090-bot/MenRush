/**
 * Discretion slider speaks the real distance: the native value is metres and aria-valuetext reads
 * like '~250 m', never the step index. Keyboard / assistive tech nudges move one whole step.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MapDiscretionSlider } from './MapDiscretionSlider';
import { MAP_PIN_FUZZ_STEPS_M } from '../lib/mapPinFuzz';

function setup(valueM = 250) {
  const onChange = vi.fn();
  render(<MapDiscretionSlider wide valueM={valueM} onChange={onChange} />);
  return { onChange, range: screen.getByTestId('map-discretion-range') as HTMLInputElement };
}

describe('MapDiscretionSlider accessible value', () => {
  it('exposes the distance, not the step index', () => {
    const { range } = setup(250);
    expect(range).toHaveAttribute('aria-valuetext', '~250 m');
    expect(range).toHaveAttribute('aria-label', 'Discretion');
    expect(range.value).toBe('250');
    expect(range.min).toBe(String(MAP_PIN_FUZZ_STEPS_M[0]));
    expect(range.max).toBe(String(MAP_PIN_FUZZ_STEPS_M[MAP_PIN_FUZZ_STEPS_M.length - 1]));
    expect(range.getAttribute('aria-valuetext')).not.toMatch(/^\d+$/);
  });

  it.each([
    [400, '~400 m'],
    [80, '~80 m'],
    [800, '~800 m'],
  ])('valueM %i reads %s', (m, text) => {
    const { range } = setup(m);
    expect(range).toHaveAttribute('aria-valuetext', text);
    expect(range.value).toBe(String(m));
  });

  it('keyboard and assistive tech nudges (+/- 1 m) move one whole step', () => {
    const { range, onChange } = setup(250);
    fireEvent.change(range, { target: { value: '251' } });
    expect(onChange).toHaveBeenLastCalledWith(320);
    fireEvent.change(range, { target: { value: '249' } });
    expect(onChange).toHaveBeenLastCalledWith(200);
  });

  it('Home / End and pointer drags snap to the nearest step', () => {
    const { range, onChange } = setup(250);
    fireEvent.change(range, { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith(80);
    fireEvent.change(range, { target: { value: '800' } });
    expect(onChange).toHaveBeenLastCalledWith(800);
    fireEvent.pointerDown(range);
    fireEvent.change(range, { target: { value: '262' } });
    expect(onChange).not.toHaveBeenLastCalledWith(320); // 262 is nearest 250: a drag does not jump a step
    fireEvent.change(range, { target: { value: '300' } });
    expect(onChange).toHaveBeenLastCalledWith(320);
    fireEvent.pointerUp(window);
  });
});
