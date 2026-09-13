import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatBubbleFace } from './ChatBubbleFace';
import { BRAND_MEDALLION_CUTOUT } from '../lib/brand';

describe('ChatBubbleFace', () => {
  it('empty photo uses faded medallion cutout — not SilhouetteAvatar gold stub', () => {
    render(<ChatBubbleFace userId="peer-1" name="QuietPeer" />);
    const face = screen.getByTestId('faded-brand-face');
    expect(face.getAttribute('data-faded-variant')).toBe('profile');
    expect(face.querySelector('img')?.getAttribute('src')).toBe(BRAND_MEDALLION_CUTOUT);
    expect(face.querySelector('img')?.getAttribute('src')).toBe(
      '/brand/medallion-transparent.png',
    );
    expect(screen.getByTestId('chat-bubble-avatar-empty-peer-1')).toBeTruthy();
    expect(screen.queryByTestId('silhouette-avatar-deprecated')).toBeNull();
  });

  it('generic /avatars/* uses faded cutout', () => {
    render(
      <ChatBubbleFace
        userId="peer-2"
        name="Generic"
        photoUrl="/avatars/generic/01.svg"
      />,
    );
    expect(
      screen.getByTestId('faded-brand-face').querySelector('img')?.getAttribute('src'),
    ).toBe('/brand/medallion-transparent.png');
  });

  it('real /uploads photo keeps media (media lock)', () => {
    render(
      <ChatBubbleFace
        userId="peer-3"
        name="PhotoPeer"
        photoUrl="/uploads/profiles/peer.jpg"
      />,
    );
    expect(screen.queryByTestId('faded-brand-face')).toBeNull();
    const img = screen
      .getByTestId('chat-bubble-avatar-photo-peer-3')
      .querySelector('img');
    expect(img?.getAttribute('src')).toBe('/uploads/profiles/peer.jpg');
  });
});
