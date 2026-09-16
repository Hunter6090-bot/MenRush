import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivationBanner } from './ActivationBanner';
import type { ProfileSetupSnapshot } from '../lib/profileSetup';

const completeNoGps: ProfileSetupSnapshot = {
  photo_url: '/avatars/generic/01.svg',
  bio: 'Looking for something real nearby tonight.',
  looking_for: 'Chat',
  interests: ['Otter', 'Casual', 'Gym'],
};

const completeWithGps: ProfileSetupSnapshot = {
  ...completeNoGps,
  lat: 50.37,
  lng: -4.14,
};

const incomplete: ProfileSetupSnapshot = {
  photo_url: '/avatars/generic/01.svg',
  bio: 'short',
  looking_for: '',
  interests: [],
};

describe('ActivationBanner location vs finish-profile', () => {
  it('does not link complete-except-GPS users to /profile/setup', () => {
    const onEnable = vi.fn();
    render(
      <MemoryRouter>
        <ActivationBanner profile={completeNoGps} onEnableLocation={onEnable} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('activation-enable-location')).toBeInTheDocument();
    expect(screen.getByTestId('activation-location-settings')).toHaveAttribute('href', '/settings');
    expect(screen.queryByTestId('activation-finish-profile')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /finish profile/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^profile$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/your profile is ready/i)).toBeInTheDocument();
  });

  it('links Finish profile when profile fields are incomplete', () => {
    render(
      <MemoryRouter>
        <ActivationBanner profile={incomplete} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('activation-finish-profile')).toHaveAttribute(
      'href',
      '/profile/setup',
    );
  });

  it('does not nag to replace a shared avatar when the profile is otherwise ready', () => {
    render(
      <MemoryRouter>
        <ActivationBanner profile={completeWithGps} />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('activation-banner')).toBeNull();
    expect(screen.queryByTestId('activation-photo-upgrade')).toBeNull();
    expect(screen.queryByText(/Add real photo/i)).toBeNull();
    expect(screen.queryByText(/Shared avatar/i)).toBeNull();
  });

  it('still shows when avatar is missing', () => {
    render(
      <MemoryRouter>
        <ActivationBanner
          profile={{
            photo_url: null,
            bio: 'A long enough bio for discover minimum gates to pass here.',
            looking_for: 'Hookup',
            interests: ['Bear', 'Otter', 'Daddy'],
            lat: 50.37,
            lng: -4.14,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('activation-banner')).toBeInTheDocument();
    expect(screen.getByText(/invisible on the map/i)).toBeInTheDocument();
  });
});
