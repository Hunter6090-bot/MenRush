import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfilePhotoViewer } from './ProfilePhotoViewer';

vi.mock('../lib/overlayBack', () => ({
  armOverlayBack: () => () => undefined,
}));

describe('ProfilePhotoViewer', () => {
  it('renders standard frame with Back/Close chrome', () => {
    const onClose = vi.fn();
    render(<ProfilePhotoViewer src="https://example.com/a.jpg" alt="Cover" onClose={onClose} />);

    expect(screen.getByTestId('profile-photo-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('profile-photo-viewer-frame')).toBeInTheDocument();
    expect(screen.getByTestId('profile-photo-viewer-back')).toBeInTheDocument();
    expect(screen.getByTestId('profile-photo-viewer-close')).toBeInTheDocument();
    expect(screen.getByTestId('profile-photo-viewer-img')).toHaveAttribute(
      'src',
      'https://example.com/a.jpg',
    );
  });

  it('closes on Back', () => {
    const onClose = vi.fn();
    render(<ProfilePhotoViewer src="https://example.com/a.jpg" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('profile-photo-viewer-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('legacy generic avatar is never enlarged — Brand cutout instead', () => {
    render(
      <ProfilePhotoViewer
        src="https://menrush.com/avatars/generic/01.svg"
        alt="Gen"
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('profile-photo-viewer-img')).toBeNull();
    expect(screen.getByTestId('profile-photo-viewer-brand-face')).toBeInTheDocument();
    expect(
      screen.getByTestId('faded-brand-face').querySelector('img')?.getAttribute('src'),
    ).toBe('/brand/medallion-transparent.png');
  });

  it('failed real photo shows Brand cutout + Retry (no legacy default)', () => {
    render(<ProfilePhotoViewer src="https://example.com/gone.jpg" onClose={vi.fn()} />);
    fireEvent.error(screen.getByTestId('profile-photo-viewer-img'));
    expect(screen.getByTestId('profile-photo-viewer-brand-face')).toBeInTheDocument();
    expect(screen.getByTestId('profile-photo-viewer-retry')).toBeInTheDocument();
  });
});
