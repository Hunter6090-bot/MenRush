import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Discover } from './Discover';
import { usersAPI } from '../api/client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { DiscoveryShellProvider } from '../context/DiscoveryShellContext';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    usersAPI: {
      ...actual.usersAPI,
      getMe: vi.fn(),
      getNearby: vi.fn(),
      getProfile: vi.fn(),
      getSentLikes: vi.fn().mockResolvedValue({ data: { ids: [] } }),
      like: vi.fn(),
    },
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      listNearby: vi.fn().mockResolvedValue({ data: { spots: [] } }),
      getSpot: vi.fn(),
    },
    pulseAPI: {
      ...actual.pulseAPI,
      getStatus: vi.fn().mockResolvedValue({ data: { is_pulsing: false } }),
      start: vi.fn(),
      stop: vi.fn(),
    },
    profileMetaAPI: {
      ...actual.profileMetaAPI,
      getMood: vi.fn().mockResolvedValue({ data: { mood: null } }),
      getMapPinFuzz: vi.fn().mockResolvedValue({ data: { map_pin_fuzz_m: 0 } }),
    },
  };
});

vi.mock('../lib/tabListCache', () => ({
  readCachedMatches: () => ({ likedIds: [], matchedIds: [], matches: [] }),
  refreshMatches: vi.fn().mockResolvedValue({ likedIds: [], matchedIds: [], matches: [] }),
}));

vi.mock('../lib/authSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/authSession')>();
  return { ...actual, getAuthToken: () => 'fake-token', hasAuthToken: () => true };
});

const completeProfile = {
  id: 'owner',
  name: 'Owner',
  age: 40,
  photo_url: 'https://example.com/me.jpg',
  bio: 'Down to earth, gym most mornings, coffee after.',
  looking_for: 'Chat',
  interests: ['Gym', 'Coffee', 'Hiking'],
  lat: 51.5074,
  lng: -0.1278,
};

function renderDiscover() {
  return render(
    <MemoryRouter>
      <DiscoveryShellProvider>
        <Discover />
      </DiscoveryShellProvider>
    </MemoryRouter>,
  );
}

describe('Discover: a complete profile never sees Finish profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    useAuthStore.setState({
      user: { id: 'owner', name: 'Owner', age: 40, photo_url: completeProfile.photo_url } as never,
      token: 'fake-token',
    });
    // Returning member: a saved pin is already in the store when Discover mounts.
    useLocationStore.setState({ lat: 51.5074, lng: -0.1278 });
    vi.mocked(usersAPI.getNearby).mockResolvedValue({
      data: { users: [], total: 0, page: 1, limit: 60, has_more: false },
    } as never);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('no Finish profile banner while /users/me is still loading', async () => {
    vi.mocked(usersAPI.getMe).mockReturnValue(new Promise(() => {}) as never);
    renderDiscover();
    await act(async () => {});
    await waitFor(() => expect(usersAPI.getNearby).toHaveBeenCalled());
    expect(screen.queryByTestId('activation-banner')).toBeNull();
    expect(screen.queryByTestId('activation-finish-profile')).toBeNull();
  });

  it('no Finish profile banner if /users/me fails', async () => {
    vi.mocked(usersAPI.getMe).mockRejectedValue(new Error('offline'));
    renderDiscover();
    await waitFor(() => expect(usersAPI.getNearby).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('activation-banner')).toBeNull();
  });

  it('no Finish profile banner or copy once the complete profile loads', async () => {
    vi.mocked(usersAPI.getMe).mockResolvedValue({ data: completeProfile } as never);
    renderDiscover();
    await waitFor(() => expect(usersAPI.getMe).toHaveBeenCalled());
    await waitFor(() => expect(usersAPI.getNearby).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('activation-banner')).toBeNull();
    expect(screen.queryByText(/finish your profile/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /finish profile/i })).toBeNull();
  });
});
