import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifiedBadge } from './VerifiedBadge';

describe('VerifiedBadge', () => {
  it('renders one Identity checked mark', () => {
    const { container } = render(<VerifiedBadge />);
    const badge = screen.getByTestId('identity-checked-badge');
    expect(badge).toHaveTextContent('Identity checked');
    expect(badge.className).toMatch(/font-bold/);
    expect(badge.className).toMatch(/text-\[11\.5px\]/);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.queryByTestId('authentic-person-badge')).toBeNull();
  });

  it('does not expose Authentic person as a separate honor mark', () => {
    render(<VerifiedBadge />);
    expect(screen.queryByText('Authentic person')).toBeNull();
  });
});
