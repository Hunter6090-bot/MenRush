import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ShowDistanceRow } from './ShowDistanceRow';

function renderRow(props: { checked: boolean; entitled: boolean; onChange?: (v: boolean) => void }) {
  const onChange = props.onChange ?? vi.fn();
  render(
    <MemoryRouter>
      <ShowDistanceRow checked={props.checked} entitled={props.entitled} onChange={onChange} />
    </MemoryRouter>,
  );
  return onChange;
}

describe('ShowDistanceRow', () => {
  it('defaults to on: shown in miles', () => {
    renderRow({ checked: true, entitled: true });
    const sw = screen.getByRole('switch', { name: 'Show distance' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('profile-distance-state')).toHaveTextContent('Shown in miles');
  });

  it('Premium member can switch distance off', () => {
    const onChange = renderRow({ checked: true, entitled: true });
    fireEvent.click(screen.getByRole('switch', { name: 'Show distance' }));
    expect(onChange).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('profile-distance-premium')).not.toBeInTheDocument();
  });

  it('without Premium, switching off is blocked with a short Premium note', () => {
    const onChange = renderRow({ checked: true, entitled: false });
    fireEvent.click(screen.getByRole('switch', { name: 'Show distance' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Premium hides distance/)).toBeInTheDocument();
    expect(screen.getByTestId('profile-distance-premium')).toHaveAttribute('href', '/premium');
  });

  it('switching back on is always allowed', () => {
    const onChange = renderRow({ checked: false, entitled: false });
    expect(screen.getByTestId('profile-distance-state')).toHaveTextContent('Shows as Nearby');
    fireEvent.click(screen.getByRole('switch', { name: 'Show distance' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('copy has no em dashes and no beta wording', () => {
    renderRow({ checked: true, entitled: false });
    fireEvent.click(screen.getByRole('switch', { name: 'Show distance' }));
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\u2014/);
    expect(text.toLowerCase()).not.toContain('beta');
  });
});
