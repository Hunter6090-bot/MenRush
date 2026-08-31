import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerifiedBadge } from './VerifiedBadge';

describe('VerifiedBadge', () => {
  it('renders Identity checked with prominent weight by default', () => {
    const { container } = render(<VerifiedBadge />);
    const badge = screen.getByTestId('identity-checked-badge');
    expect(badge).toHaveTextContent('Identity checked');
    expect(badge.className).toMatch(/font-bold/);
    expect(badge.className).toMatch(/text-\[11\.5px\]/);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('keeps Authentic person as a separate trust claim', () => {
    render(<VerifiedBadge level="authentic_person" />);
    expect(screen.getByTestId('authentic-person-badge')).toHaveTextContent('Authentic person');
  });
});
