/**
 * Zoul (10 Oct 2026): the location prompt and the Add a photo strip are hidden on
 * the You rows screen (/profile) only, so the rows sit above the fold as on the
 * board. They still show on the Edit screen and everywhere else.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getMe = vi.hoisted(() => vi.fn());
vi.mock('../api/client', () => ({
  usersAPI: { getMe, updateLocation: vi.fn() },
  // #357 synced "Don't show again": signed-in members read their prompt prefs.
  promptPrefsAPI: { get: vi.fn(async () => ({ data: { never: [] } })), setNever: vi.fn(async () => ({ data: {} })) },
}));
vi.mock('../lib/deviceLocation', () => ({
  LOCATION_PRIVACY_LINE: 'We use your location to show who is nearby.',
  requestDeviceLocation: vi.fn(async () => ({ ok: false, message: 'Location is blocked.' })),
}));
vi.mock('../hooks/store', () => {
  const state = { lat: null, lng: null, setLocation: vi.fn() };
  // ProfileDepthStrip uses usePromptDismissal (#357), which reads the signed-in user.
  const auth = { user: { id: 'u-test' } };
  const useAuthStore = Object.assign((sel: (s: typeof auth) => unknown) => sel(auth), { getState: () => auth });
  return { useLocationStore: (sel: (s: typeof state) => unknown) => sel(state), useAuthStore };
});

import { LocationPresenceStrip } from './LocationPresenceStrip';
import { ProfileDepthStrip } from './ProfileDepthStrip';
import { isYouRowsPath } from '../lib/youRows';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationPresenceStrip />
      <ProfileDepthStrip />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getMe.mockReset();
  // No location, no photo, no bio: both strips would normally show.
  getMe.mockResolvedValue({ data: { lat: null, lng: null, photo_url: '', bio: '', looking_for: '', interests: [] } });
});

describe('location and Add a photo strips on the You screen', () => {
  it('only the You rows path counts as You', () => {
    expect(isYouRowsPath('/profile')).toBe(true);
    expect(isYouRowsPath('/profile/')).toBe(true);
    for (const p of ['/profile/edit', '/profile/abc', '/profile/setup', '/settings', '/albums', '/conversations']) {
      expect(isYouRowsPath(p), p).toBe(false);
    }
  });

  it('are hidden on /profile and never fetch or ask for location there', async () => {
    renderAt('/profile');
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('location-presence-strip')).toBeNull();
    expect(screen.queryByTestId('profile-depth-strip')).toBeNull();
    expect(getMe).not.toHaveBeenCalled();
  });

  it.each(['/profile/edit', '/settings', '/conversations', '/rooms', '/out', '/albums'])(
    'still show on %s',
    async (path) => {
      renderAt(path);
      await waitFor(() => expect(screen.getByTestId('location-presence-strip')).toBeInTheDocument());
      expect(screen.getByText('Turn on location for Nearby')).toBeInTheDocument();
      await waitFor(() => expect(screen.getByTestId('profile-depth-strip')).toBeInTheDocument());
      expect(screen.getAllByText('Add a photo').length).toBeGreaterThan(0);
    },
  );
});
