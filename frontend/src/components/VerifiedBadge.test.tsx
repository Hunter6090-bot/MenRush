import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifiedBadge } from './VerifiedBadge';

describe('VerifiedBadge', () => {
  it('renders Brand word Verified as the only mark', () => {
    const { container } = render(<VerifiedBadge />);
    const badge = screen.getByTestId('verified-badge');
    expect(badge).toHaveTextContent('Verified');
    expect(badge).not.toHaveTextContent('Identity checked');
    expect(badge.className).toMatch(/font-bold/);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.queryByTestId('identity-checked-badge')).toBeNull();
    expect(screen.queryByTestId('authentic-person-badge')).toBeNull();
  });

  it('does not expose Authentic person or honor language', () => {
    render(<VerifiedBadge />);
    expect(screen.queryByText('Authentic person')).toBeNull();
    expect(screen.queryByText(/badge of honor/i)).toBeNull();
    expect(screen.queryByText(/strongest trust/i)).toBeNull();
  });
});
