/**
 * Menu Discretion writes the saved value once per release (drag) or per keyboard step,
 * never on every drag move.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MenuDiscretion } from './MenuDiscretion';
import { MAP_PIN_FUZZ_STEPS_M } from '../lib/mapPinFuzz';

const api = vi.hoisted(() => ({
  getMapPinFuzz: vi.fn(),
  setMapPinFuzz: vi.fn(),
}));
vi.mock('../api/client', () => ({ profileMetaAPI: api }));

const STEPS = MAP_PIN_FUZZ_STEPS_M;

async function ready() {
  render(<MenuDiscretion />);
  const range = (await screen.findByTestId('map-discretion-range')) as HTMLInputElement;
  await waitFor(() => expect(range).not.toBeDisabled());
  return range;
}

describe('MenuDiscretion saving', () => {
  beforeEach(() => {
    api.getMapPinFuzz.mockReset().mockResolvedValue({ data: { map_pin_fuzz_m: 250 } });
    api.setMapPinFuzz.mockReset().mockResolvedValue({ data: {} });
  });

  it('saves once when a drag is released, with the final value', async () => {
    const range = await ready();
    const start = STEPS.indexOf(250);
    fireEvent.pointerDown(range);
    for (let i = start + 1; i <= start + 4; i += 1) fireEvent.change(range, { target: { value: String(i) } });
    expect(api.setMapPinFuzz).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new Event('pointerup'));
    });
    expect(api.setMapPinFuzz).toHaveBeenCalledTimes(1);
    expect(api.setMapPinFuzz).toHaveBeenCalledWith(STEPS[start + 4]);
    expect(screen.getByTestId('map-discretion-pill')).toHaveTextContent(`~${STEPS[start + 4]} m`);
  });

  it('saves once per keyboard step', async () => {
    const range = await ready();
    const start = STEPS.indexOf(250);
    fireEvent.change(range, { target: { value: String(start + 1) } });
    fireEvent.change(range, { target: { value: String(start + 2) } });
    expect(api.setMapPinFuzz).toHaveBeenCalledTimes(2);
    expect(api.setMapPinFuzz).toHaveBeenNthCalledWith(1, STEPS[start + 1]);
    expect(api.setMapPinFuzz).toHaveBeenNthCalledWith(2, STEPS[start + 2]);
  });
});
