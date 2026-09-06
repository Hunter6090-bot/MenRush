import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VerifiedBadge } from './VerifiedBadge';
describe('VerifiedBadge', () => {
  it('labels and explains the badge on tap', () => {
    render(<VerifiedBadge />);
    const button = screen.getByRole('button', { name: /Verified/ });
    expect(button).toHaveTextContent('Verified');
    fireEvent.click(button);
    expect(screen.getByRole('status')).toHaveTextContent('ID and live selfie verified through Veriff.');
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('keeps photo badges compact, accessible and separate from navigation', () => {
    const openProfile = vi.fn();
    render(<div onClick={openProfile}><VerifiedBadge compact /></div>);
    const button = screen.getByRole('button', { name: /Verified/ });
    expect(button.textContent).toBe('');
    fireEvent.click(button);
    expect(openProfile).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
