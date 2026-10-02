import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VerifiedBadge } from './VerifiedBadge';

describe('VerifiedBadge', () => {
  it('is tick-only with accessible label — no Verified word chip', () => {
    render(<VerifiedBadge />);
    const button = screen.getByRole('button', { name: /Verified/ });
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')).toBeTruthy();
    fireEvent.click(button);
    expect(screen.getByRole('status')).toHaveTextContent(/Veriff/i);
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps photo badges accessible and separate from navigation', () => {
    const openProfile = vi.fn();
    render(
      <div onClick={openProfile}>
        <VerifiedBadge compact />
      </div>,
    );
    const button = screen.getByRole('button', { name: /Verified/ });
    expect(button.textContent).toBe('');
    fireEvent.click(button);
    expect(openProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
