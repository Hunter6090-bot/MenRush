import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActivationBanner } from './ActivationBanner';

describe('ActivationBanner', () => {
  it('does not nag to replace a shared avatar when the profile is otherwise ready', () => {
    render(
      <MemoryRouter>
        <ActivationBanner
          profile={{
            photo_url: '/avatars/generic/03.svg',
            bio: 'A long enough bio for discover minimum gates to pass here.',
            looking_for: 'Hookup',
            interests: ['Bear', 'Otter', 'Daddy'],
            lat: 50.37,
            lng: -4.14,
          }}
        />
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
