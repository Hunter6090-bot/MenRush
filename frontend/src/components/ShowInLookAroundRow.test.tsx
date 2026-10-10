import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ShowInLookAroundRow } from './ShowInLookAroundRow';

const mocks = vi.hoisted(() => ({ getSettings: vi.fn(), set: vi.fn() }));
vi.mock('../api/client', () => ({
  travelAPI: { getSettings: mocks.getSettings, setShowInLookAround: mocks.set },
}));

describe('Show me to people looking around', () => {
  beforeEach(() => {
    mocks.getSettings.mockReset().mockResolvedValue({ data: { show_in_look_around: true } });
    mocks.set.mockReset().mockImplementation(async (v: boolean) => ({ data: { show_in_look_around: v } }));
  });

  it('is on by default and switches off, describing only what it does', async () => {
    render(<ShowInLookAroundRow />);
    const sw = screen.getByRole('switch', { name: 'Show me to people looking around' });
    await waitFor(() => expect(sw).not.toBeDisabled());
    expect(sw).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(sw);
    await waitFor(() => expect(mocks.set).toHaveBeenCalledWith(false));
    expect(sw).toHaveAttribute('aria-checked', 'false');
    const text = screen.getByTestId('settings-show-in-look-around').textContent ?? '';
    expect(text).toMatch(/won’t see you there/);
    expect(text).not.toMatch(/privacy|private|hidden location|hide your location|safe/i);
    expect(sw.className).toMatch(/h-11/);
  });

  it('rolls back when saving fails', async () => {
    mocks.set.mockRejectedValue(new Error('x'));
    render(<ShowInLookAroundRow />);
    const sw = screen.getByRole('switch');
    await waitFor(() => expect(sw).not.toBeDisabled());
    fireEvent.click(sw);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save.');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});
