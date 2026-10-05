import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiscoveryPhotoFrame, ONLINE_PHOTO_BORDER_COLOR } from './DiscoveryPhotoFrame';

describe('DiscoveryPhotoFrame', () => {
  it('paints a green inset border on the square photo when online', () => {
    render(
      <DiscoveryPhotoFrame online>
        <img alt="face" src="/uploads/profiles/a.jpg" />
      </DiscoveryPhotoFrame>,
    );

    const frame = screen.getByTestId('discovery-photo-frame');
    expect(frame).toHaveAttribute('data-online', 'true');
    const border = screen.getByTestId('online-photo-border');
    expect(border.style.borderColor).toBe(ONLINE_PHOTO_BORDER_COLOR);
    expect(border.className).toMatch(/absolute/);
    expect(border.className).toMatch(/inset-0/);
  });

  it('does not paint the online rim when offline', () => {
    render(
      <DiscoveryPhotoFrame online={false}>
        <img alt="face" src="/uploads/profiles/a.jpg" />
      </DiscoveryPhotoFrame>,
    );

    expect(screen.getByTestId('discovery-photo-frame')).toHaveAttribute('data-online', 'false');
    expect(screen.queryByTestId('online-photo-border')).toBeNull();
  });

  it('keeps a verified tick without a circular badge', () => {
    render(
      <DiscoveryPhotoFrame online verified>
        <img alt="face" src="/uploads/profiles/a.jpg" />
      </DiscoveryPhotoFrame>,
    );

    const tick = screen.getByRole('button', { name: /Verified/ });
    expect(tick.textContent).toBe('');
    expect(tick.className).not.toMatch(/rounded-full/);
    expect(tick.className).not.toMatch(/border-2/);
    expect(tick.className).not.toMatch(/bg-\[#C4832A\]/);
  });
});
