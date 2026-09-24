/**
 * Matches must paint last-known cards on remount without waiting for network.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  __resetTabListCacheForTests,
  writeCachedMatches,
} from '../lib/tabListCache';

vi.mock('../hooks/store', () => ({
  useAuthStore: (sel?: (s: { user: { id: string; name: string } }) => unknown) => {
    const state = { user: { id: 'me', name: 'Me' }, token: 't' };
    return typeof sel === 'function' ? sel(state) : state;
  },
  useNotificationStore: (sel?: (s: { unreadCount: number }) => unknown) => {
    const state = { unreadCount: 0 };
    return typeof sel === 'function' ? sel(state) : state;
  },
  useUnreadStore: (sel?: (s: { count: number }) => unknown) => {
    const state = { count: 0, unreadBySender: {} };
    return typeof sel === 'function' ? sel(state) : state;
  },
  useLocationStore: (sel?: (s: { lat: null; lng: null }) => unknown) => {
    const state = { lat: null, lng: null, setLocation: vi.fn() };
    return typeof sel === 'function' ? sel(state) : state;
  },
}));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => null,
}));

vi.mock('../lib/nearbyPhotoSrc', () => ({
  useGridPhotoSrc: () => ({ src: undefined, phase: 'loading' }),
  clearGridPhotoQueue: vi.fn(),
}));

vi.mock('../api/client', () => ({
  usersAPI: {
    getMatches: vi.fn(),
    getReceivedLikes: vi.fn(),
    getMe: vi.fn().mockResolvedValue({ data: {} }),
  },
  messagesAPI: {
    getConversations: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

import { Matches } from '../pages/Matches';
import { usersAPI } from '../api/client';

describe('Matches cache-first paint', () => {
  beforeEach(() => {
    __resetTabListCacheForTests();
    vi.mocked(usersAPI.getMatches).mockReset();
    vi.mocked(usersAPI.getReceivedLikes).mockReset();
  });

  afterEach(() => {
    __resetTabListCacheForTests();
  });

  it('shows cached match name immediately while revalidate is slow', async () => {
    writeCachedMatches(
      [
        {
          id: 'm-warm-1',
          name: 'WarmMatch',
          age: 34,
          online: true,
          matched_at: '2026-09-11T12:00:00Z',
          photo_url: '/uploads/profiles/warm.jpg',
        },
      ],
      [],
    );

    let resolveMatches!: (v: unknown) => void;
    vi.mocked(usersAPI.getMatches).mockReturnValue(
      new Promise((resolve) => {
        resolveMatches = resolve;
      }) as never,
    );
    vi.mocked(usersAPI.getReceivedLikes).mockResolvedValue({ data: [] } as never);

    render(
      <MemoryRouter>
        <Matches />
      </MemoryRouter>,
    );

    // Instant — no skeleton when cache exists.
    expect(screen.queryByTestId('matches-skeleton')).toBeNull();
    expect(screen.getByText(/WarmMatch/)).toBeTruthy();
    expect(screen.getByTestId('match-card-m-warm-1')).toBeTruthy();
    // Photo may still be pending — name already visible.
    expect(screen.getByTestId('match-grid-photo-pending')).toBeTruthy();

    resolveMatches({
      data: [
        {
          id: 'm-warm-1',
          name: 'WarmMatch',
          age: 34,
          online: true,
          matched_at: '2026-09-11T12:00:00Z',
        },
      ],
    });

    await waitFor(() => {
      expect(usersAPI.getReceivedLikes).toHaveBeenCalled();
    });
  });

  it('shows skeleton only on cold start, then honest empty', async () => {
    vi.mocked(usersAPI.getMatches).mockResolvedValue({ data: [] } as never);
    vi.mocked(usersAPI.getReceivedLikes).mockResolvedValue({ data: [] } as never);

    render(
      <MemoryRouter>
        <Matches />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('matches-skeleton')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('matches-empty')).toBeTruthy();
    });
    expect(screen.queryByTestId('matches-skeleton')).toBeNull();
  });
});
