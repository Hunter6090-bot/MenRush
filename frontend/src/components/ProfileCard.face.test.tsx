/**
 * Discovery ProfileCard empty face — faded cutout, never SilhouetteAvatar gold stub.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileCard, type NearbyUser } from './ProfileCard';
import { BRAND_MEDALLION_CUTOUT } from '../lib/brand';

vi.mock('../api/client', () => ({
  usersAPI: {
    likeUser: vi.fn(),
  },
}));

vi.mock('../hooks/store', () => ({
  useAuthStore: (sel?: (s: { user: { id: string } | null }) => unknown) => {
    const state = { user: { id: 'me' } };
    return typeof sel === 'function' ? sel(state) : state;
  },
}));

function emptyUser(overrides: Partial<NearbyUser> = {}): NearbyUser {
  return {
    id: 'u-empty',
    name: 'QuietOne',
    age: 29,
    online: false,
    distance_km: 1.2,
    photo_url: undefined,
    ...overrides,
  };
}

function renderCard(user: NearbyUser) {
  return render(
    <MemoryRouter>
      <ProfileCard user={user} />
    </MemoryRouter>,
  );
}

describe('ProfileCard empty face', () => {
  it('empty photo uses faded medallion cutout — not SilhouetteAvatar gold stub', () => {
    renderCard(emptyUser());
    const face = screen.getByTestId('faded-brand-face');
    expect(face).toBeTruthy();
    expect(face.getAttribute('data-faded-variant')).toBe('tile');
    const img = face.querySelector('img');
    expect(img?.getAttribute('src')).toBe(BRAND_MEDALLION_CUTOUT);
    expect(img?.getAttribute('src')).toBe('/brand/medallion-transparent.png');
    expect(screen.queryByTestId('silhouette-avatar-deprecated')).toBeNull();
  });

  it('generic /avatars/* slot also uses faded cutout', () => {
    renderCard(emptyUser({ photo_url: '/avatars/generic/02.svg' }));
    const face = screen.getByTestId('faded-brand-face');
    expect(face.querySelector('img')?.getAttribute('src')).toBe(
      '/brand/medallion-transparent.png',
    );
  });

  it('real /uploads photo keeps media (media lock)', () => {
    renderCard(emptyUser({ id: 'u-real', photo_url: '/uploads/profiles/real.jpg' }));
    expect(screen.queryByTestId('faded-brand-face')).toBeNull();
    const photo = screen.getByTestId('profile-card-photo-u-real').querySelector('img');
    expect(photo?.getAttribute('src')).toContain('/uploads/profiles/real.jpg');
  });
});
