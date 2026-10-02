import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Discover } from './Discover';
import { usersAPI, hotSpotsAPI, pulseAPI, profileMetaAPI } from '../api/client';
import { useAuthStore, useLocationStore } from '../hooks/store';
import { DiscoveryShellProvider } from '../context/DiscoveryShellContext';

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

describe('Discover nearby headcount display lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    useAuthStore.setState({
      user: {
        id: 'user-self',
        name: 'Self',
        email: 'self@menrush.test',
        age: 28,
        photo_url: 'https://example.com/me.jpg',
      } as any,
      token: 'fake-token',
    });

    useLocationStore.setState({
      lat: 51.5074,
      lng: -0.1278,
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('min-width: 1024px'),
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

  it('renders "Men nearby" with no digits for nearby people count and keeps pagination', async () => {
    const mockUsers = [
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
      {
        id: 'u2',
        name: 'Dave',
        age: 34,
        lat: 51.52,
        lng: -0.13,
        online: false,
        last_seen: new Date(Date.now() - 3600_000).toISOString(),
        distance_meters: 1500,
        distance_km: 1.5,
        photo_url: 'https://example.com/u2.jpg',
      },
    ];

    vi.mocked(usersAPI.getNearby).mockResolvedValue({
      data: {
        users: mockUsers,
        total: 142,
        page: 1,
        limit: 50,
        has_more: true,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

    render(
      <MemoryRouter>
        <DiscoveryShellProvider>
          <Discover />
        </DiscoveryShellProvider>
      </MemoryRouter>,
    );

    // Wait for the nearby roster to unpack and render
    await waitFor(() => {
      expect(screen.getAllByTestId('nearby-counts').length).toBeGreaterThan(0);
    });

    const pills = screen.getAllByTestId('nearby-counts');
    for (const pill of pills) {
      // Must contain neutral label "Men nearby"
      expect(pill).toHaveTextContent(/men nearby/i);

      // Must NOT contain any digits for the total nearby people count (e.g. 142 or 2 men nearby)
      expect(pill.textContent).not.toMatch(/\b142\b/);
      expect(pill.textContent).not.toMatch(/\d+\s+men\s+nearby/i);
    }

    // Check desktop header
    const headers = screen.queryAllByRole('heading', { level: 2 });
    const nearbyHeader = headers.find((h) => h.textContent?.includes('Nearby') || h.textContent?.includes('Men nearby'));
    expect(nearbyHeader).toBeDefined();
    expect(nearbyHeader?.textContent).toBe('Men nearby');
    expect(nearbyHeader?.textContent).not.toMatch(/\d+/);

    // Verify pagination button exists when has_more is true
    const loadMoreBtn = await screen.findByTestId('nearby-load-more');
    expect(loadMoreBtn).toBeInTheDocument();
    expect(loadMoreBtn).toHaveTextContent('Load more men');
  });
});
