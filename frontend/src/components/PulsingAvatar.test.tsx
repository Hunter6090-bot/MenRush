import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PulsingAvatar } from './PulsingAvatar';

describe('PulsingAvatar identity badge', () => {
  it('shows a copper Verified mark on map pins when verified', () => {
    render(
      <PulsingAvatar isPulsing={false} size={44} isVerified>
        <span>face</span>
      </PulsingAvatar>,
    );
    const badge = screen.getByTestId('map-identity-checked-badge');
    expect(badge).toHaveAttribute('aria-label', 'Verified');
    // size 44 → max(16, round(44*0.38)) = 17
    expect(badge.style.width).toBe('17px');
    expect(badge.style.height).toBe('17px');
    expect(badge.className).not.toMatch(/rounded-full/);
    expect(badge.style.background).toBe('');
    expect(badge.style.border).toBe('');
  });

  it('clips map pins as circles so the green photo rim stays round', () => {
    render(
      <PulsingAvatar isPulsing={false} size={44} shape="circle">
        <span>face</span>
      </PulsingAvatar>,
    );
    const root = screen.getByText('face').closest('[data-avatar-shape]');
    expect(root).toHaveAttribute('data-avatar-shape', 'circle');
    const clip = root?.querySelector('.relative.z-10');
    expect(clip?.className).toMatch(/overflow-hidden/);
    expect(clip?.className).toMatch(/rounded-full/);
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
