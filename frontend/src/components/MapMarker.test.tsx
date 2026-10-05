import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapMarker } from './MapMarker';

vi.mock('../lib/nearbyPhotoSrc', () => ({
  useGridPhotoSrc: (photoUrl?: string | null) => {
    const trimmed = photoUrl?.trim() || '';
    if (!trimmed) return { src: undefined, phase: 'empty' as const };
    return { src: trimmed, phase: 'ready' as const };
  },
  clearGridPhotoQueue: vi.fn(),
}));

describe('MapMarker online square border', () => {
  it('renders a green square rim when the member is online', () => {
    render(
      <MapMarker
        user={{
          id: 'm1',
          name: 'Pete',
          photo_url: '/uploads/profiles/pete.jpg',
          isPulsing: false,
          online: true,
        }}
      />,
    );

    expect(screen.getByTestId('map-marker')).toHaveAttribute('data-online', 'true');
    expect(screen.getByTestId('discovery-photo-frame')).toHaveAttribute('data-online', 'true');
    const border = screen.getByTestId('online-photo-border');
    expect(border.style.borderColor.replace(/\s/g, '')).toMatch(/#4ADE80|rgb\(74,222,128\)/i);
    expect(screen.getByTestId('map-marker').querySelector('[data-avatar-shape="square"]')).toBeTruthy();
  });

  it('keeps last_seen within 1 hour live even when online is false', () => {
    render(
      <MapMarker
        user={{
          id: 'm2',
          name: 'Kev',
          photo_url: '/uploads/profiles/kev.jpg',
          isPulsing: false,
          online: false,
          last_seen: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        }}
      />,
    );

    expect(screen.getByTestId('online-photo-border')).toBeInTheDocument();
  });

  it('does not paint the green rim when offline past the hour', () => {
    render(
      <MapMarker
        user={{
          id: 'm3',
          name: 'Dave',
          photo_url: '/uploads/profiles/dave.jpg',
          isPulsing: false,
          online: false,
          last_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        }}
      />,
    );

    expect(screen.queryByTestId('online-photo-border')).toBeNull();
  });

  it('shows a tick without a circular verified badge', () => {
    render(
      <MapMarker
        user={{
          id: 'm4',
          name: 'Kev',
          photo_url: '/uploads/profiles/kev.jpg',
          isPulsing: false,
          online: true,
          isVerified: true,
        }}
      />,
    );

    const tick = screen.getByRole('button', { name: /Verified/ });
    expect(tick.className).not.toMatch(/rounded-full/);
    expect(screen.queryByTestId('map-identity-checked-badge')).toBeNull();
  });
});
