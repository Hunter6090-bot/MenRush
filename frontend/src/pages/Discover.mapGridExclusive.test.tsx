import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Discover } from './Discover';
import { usersAPI, hotSpotsAPI, pulseAPI, profileMetaAPI } from '../api/client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { DiscoveryShellProvider } from '../context/DiscoveryShellContext';
import { writeHomeView } from '../lib/homeView';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    usersAPI: {
      ...actual.usersAPI,
      getNearby: vi.fn(),
      getProfile: vi.fn(),
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
      getSetupSnapshot: vi.fn().mockResolvedValue({
        data: {
          profile: {
            id: 'test-user',
            name: 'Tester',
            age: 25,
            bio: 'Bio',
            lat: 51.5,
            lng: -0.1,
            photo_url: 'https://example.com/photo.jpg',
          },
        },
      }),
    },
  };
});

vi.mock('../lib/tabListCache', () => ({
  readCachedMatches: () => ({ likedIds: [], matchedIds: [], matches: [] }),
  refreshMatches: vi.fn().mockResolvedValue({ likedIds: [], matchedIds: [], matches: [] }),
}));

vi.mock('../lib/authSession', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/authSession')>();
  return {
    ...actual,
    getAuthToken: () => 'fake-token',
    hasAuthToken: () => true,
  };
});

const nearbyUsers = [
  {
    id: 'u1',
    name: 'James',
    age: 29,
    lat: 51.51,
    lng: -0.12,
    online: true,
    last_seen: new Date().toISOString(),
    distance_meters: 800,
    distance_km: 0.8,
    photo_url: 'https://example.com/u1.jpg',
  },
];

function setLayout(desktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: desktop && query.includes('min-width: 1024px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderDiscover() {
  return render(
    <MemoryRouter>
      <DiscoveryShellProvider>
        <Discover />
      </DiscoveryShellProvider>
    </MemoryRouter>,
  );
}

/** Pete lock (8 Oct 2026): map is home, one toggle, never both views at once. */
describe('Discover map and grid are exclusive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.setState({
      user: { id: 'user-self', name: 'Self', email: 'self@menrush.test', age: 28 } as any,
      token: 'fake-token',
    });
    useLocationStore.setState({ lat: 51.5074, lng: -0.1278 });
    vi.mocked(usersAPI.getNearby).mockResolvedValue({
      data: { users: nearbyUsers, total: 1, page: 1, limit: 60, has_more: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });
  });

  it('phone opens on the map with no grid underneath', async () => {
    setLayout(false);
    renderDiscover();
    await waitFor(() => expect(usersAPI.getNearby).toHaveBeenCalled());
    const panel = screen.getByTestId('discover-map-panel');
    expect(panel).toHaveAttribute('data-map-mode', 'default');
    expect(panel).not.toHaveAttribute('aria-hidden');
    expect(screen.queryByTestId('nearby-counts')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nearby-load-more')).not.toBeInTheDocument();
    expect(screen.queryByTestId('map-drag-handle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('map-hide')).not.toBeInTheDocument();
    expect(screen.queryByTestId('map-expand-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('map-pill-filters')).toBeInTheDocument();
  });

  it('phone swaps the whole screen to the grid and back', async () => {
    setLayout(false);
    renderDiscover();
    await waitFor(() => expect(usersAPI.getNearby).toHaveBeenCalled());
    act(() => {
      writeHomeView('list');
    });
    const loadMore = await screen.findByTestId('nearby-load-more');
    expect(loadMore).toBeInTheDocument();
    const panel = screen.getByTestId('discover-map-panel');
    expect(panel).toHaveAttribute('data-map-mode', 'hidden');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByTestId('map-top-pill-bar')).not.toBeInTheDocument();
    act(() => {
      writeHomeView('map');
    });
    await waitFor(() => expect(screen.queryByTestId('nearby-load-more')).not.toBeInTheDocument());
    expect(screen.getByTestId('discover-map-panel')).toHaveAttribute('data-map-mode', 'default');
  });

  it('desktop opens on the map only and the one toggle swaps to the grid only', async () => {
    setLayout(true);
    renderDiscover();
    await waitFor(() => expect(usersAPI.getNearby).toHaveBeenCalled());
    expect(screen.getByTestId('discover-map-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('nearby-counts')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('nearby-map-grid-toggle')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('nearby-map-grid-toggle'));
    expect(await screen.findByTestId('nearby-load-more')).toBeInTheDocument();
    expect(screen.queryByTestId('discover-map-panel')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('menrush_home_view')).toBe('list');
  });
});
