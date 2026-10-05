import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiscoveryPhotoFrame } from './DiscoveryPhotoFrame';

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
    expect(border.style.borderColor.replace(/\s/g, '')).toMatch(/#4ADE80|rgb\(74,222,128\)/i);
    expect(border.className).toMatch(/absolute/);
    expect(border.className).toMatch(/inset-0/);
    expect(frame).toHaveAttribute('data-shape', 'square');
    expect(frame.className).not.toMatch(/rounded-full/);
  });

  it('paints a circular green rim for map pins', () => {
    render(
      <DiscoveryPhotoFrame online shape="circle">
        <img alt="face" src="/uploads/profiles/a.jpg" />
      </DiscoveryPhotoFrame>,
    );

    const frame = screen.getByTestId('discovery-photo-frame');
    expect(frame).toHaveAttribute('data-shape', 'circle');
    expect(frame.className).toMatch(/rounded-full/);
    expect(screen.getByTestId('online-photo-border').className).toMatch(/rounded-full/);
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
