import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PulsingAvatar } from './PulsingAvatar';

describe('PulsingAvatar identity badge', () => {
  it('shows a larger Verified mark on map pins when verified', () => {
    render(
      <PulsingAvatar isPulsing={false} size={44} isVerified>
        <span>face</span>
      </PulsingAvatar>,
    );
    const badge = screen.getByTestId('map-verified-badge');
    expect(badge).toHaveAttribute('aria-label', 'Verified');
    // size 44 → max(16, round(44*0.38)) = 17
    expect(badge.style.width).toBe('17px');
    expect(badge.style.height).toBe('17px');
  });

  it('hides the mark when not verified', () => {
    render(
      <PulsingAvatar isPulsing={false} size={44}>
        <span>face</span>
      </PulsingAvatar>,
    );
    expect(screen.queryByTestId('map-verified-badge')).toBeNull();
  });
});
