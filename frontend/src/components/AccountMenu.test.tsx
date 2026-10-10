import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';

describe('AccountMenu search', () => {
  it('shows a Search row that closes the Menu and opens app-wide search', () => {
    const onClose = vi.fn();
    const onSearch = vi.fn();
    render(
      <MemoryRouter>
        <AccountMenu open onClose={onClose} onSignOut={vi.fn()} onSearch={onSearch} />
      </MemoryRouter>,
    );
    const row = screen.getByTestId('account-menu-search');
    expect(row).toHaveTextContent('Search');
    expect(row.className).toMatch(/text-\[17px\]/);
    fireEvent.click(row);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('has no Search row when no search handler is passed', () => {
    render(
      <MemoryRouter>
        <AccountMenu open onClose={vi.fn()} onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('account-menu-search')).not.toBeInTheDocument();
  });
});

describe('AccountMenu Travel row', () => {
  it('shows the plane icon on the Travel row (Al spec)', () => {
    render(
      <MemoryRouter>
        <AccountMenu open onClose={vi.fn()} onSignOut={vi.fn()} />
      </MemoryRouter>,
    );
    const row = screen.getByTestId('account-menu-travel');
    expect(row).toHaveTextContent('Travel');
    const icon = screen.getByTestId('account-menu-travel-icon');
    expect(row).toContainElement(icon);
    const svg = icon.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('24');
  });
});
