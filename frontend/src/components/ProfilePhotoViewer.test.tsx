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
});
