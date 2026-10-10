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

// Record what Discover hands the banner, so the prompt-slot gating inside the real
// banner cannot hide a regression (the slot holds it back while other prompts check).
const bannerProfiles: unknown[] = [];
vi.mock('../components/ActivationBanner', () => ({
  ActivationBanner: ({ profile }: { profile: unknown }) => {
    bannerProfiles.push(profile);
    return <div data-testid="activation-banner-probe" />;
  },
}));

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

/**
 * Guard for main's #354 fix: when a location fix lands before /users/me answers,
 * Discover must not build a coords-only profile stub. That stub reads every field
 * as missing, so complete profiles saw Finish profile on every load. Reverting
 * clearLocationPrompts to `: { lat, lng }` makes the first test fail.
 */
describe('Discover: no coords-only profile stub before /users/me (#354)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bannerProfiles.length = 0;
    window.localStorage.clear();
    window.sessionStorage.clear();
    useAuthStore.setState({
      user: { id: 'owner', name: 'Owner', age: 40, photo_url: completeProfile.photo_url } as never,
      token: 'fake-token',
    });
    useLocationStore.setState({ lat: 51.5074, lng: -0.1278 });
    vi.mocked(usersAPI.getNearby).mockResolvedValue({
      data: { users: [], total: 0, page: 1, limit: 60, has_more: false },
    } as never);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
      })),
    });
  });

  it('a location fix while /users/me is loading does not hand the banner a profile', async () => {
    vi.mocked(usersAPI.getMe).mockReturnValue(new Promise(() => {}) as never);
    renderDiscover();
    await act(async () => {});
    await waitFor(() => expect(usersAPI.getNearby).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('activation-banner-probe')).toBeNull();
    expect(bannerProfiles).toEqual([]);
  });

  it('once /users/me answers, the banner gets the real profile with the live pin merged in', async () => {
    vi.mocked(usersAPI.getMe).mockResolvedValue({ data: completeProfile } as never);
    renderDiscover();
    await waitFor(() => expect(screen.getByTestId('activation-banner-probe')).toBeInTheDocument());
    for (const p of bannerProfiles) {
      expect(p).toEqual(expect.objectContaining({ name: 'Owner', bio: completeProfile.bio }));
    }
  });
});
