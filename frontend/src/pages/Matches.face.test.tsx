/**
 * Matches empty-mark + Veriff tick must match Nearby Grid (no gold stub / word chip).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  __resetTabListCacheForTests,
  writeCachedMatches,
} from '../lib/tabListCache';
import { BRAND_MEDALLION_CUTOUT } from '../lib/brand';

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
  useGridPhotoSrc: (photoUrl?: string | null) => {
    const trimmed = photoUrl?.trim() || '';
    if (!trimmed) return { src: undefined, phase: 'empty' as const };
    if (trimmed.startsWith('/uploads/')) {
      return { src: `blob:mock-${trimmed}`, phase: 'ready' as const };
    }
    return { src: trimmed, phase: 'ready' as const };
  },
  clearGridPhotoQueue: vi.fn(),
}));

vi.mock('../api/client', () => ({
  usersAPI: {
    getMatches: vi.fn().mockResolvedValue({ data: [] }),
    getReceivedLikes: vi.fn().mockResolvedValue({ data: [] }),
    getMe: vi.fn().mockResolvedValue({ data: {} }),
  },
  messagesAPI: {
    getConversations: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

import { Matches } from '../pages/Matches';

describe('Matches face + Veriff tick', () => {
  beforeEach(() => {
    __resetTabListCacheForTests();
  });

  afterEach(() => {
    __resetTabListCacheForTests();
  });

  it('empty match uses faded medallion cutout — not SilhouetteAvatar gold stub', () => {
    writeCachedMatches(
      [
        {
          id: 'm-empty-1',
          name: 'PJ',
          age: 61,
          online: false,
          matched_at: '2026-09-11T12:00:00Z',
          photo_url: null,
        },
      ],
      [],
    );

    render(
      <MemoryRouter>
        <Matches />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('match-photo-placeholder')).toBeTruthy();
    const face = screen.getByTestId('faded-brand-face');
    expect(face.getAttribute('data-faded-variant')).toBe('tile');
    const img = face.querySelector('img');
    expect(img?.getAttribute('src')).toBe(BRAND_MEDALLION_CUTOUT);
    expect(screen.queryByText('Verified')).toBeNull();
  });

  it('verified match shows tick only — no Verified word chip', () => {
    writeCachedMatches(
      [
        {
          id: 'm-ver-1',
          name: 'Kev',
          age: 59,
          online: true,
          matched_at: '2026-09-11T12:00:00Z',
          photo_url: '/uploads/profiles/kev.jpg',
          is_verified: true,
        },
      ],
      [],
    );

    render(
      <MemoryRouter>
        <Matches />
      </MemoryRouter>,
    );

    const tick = screen.getByRole('button', { name: /Verified/ });
    expect(tick.textContent).toBe('');
    expect(screen.queryByText('Verified')).toBeNull();
    expect(screen.getByTestId('match-grid-photo')).toBeTruthy();
  });

  it('renders icon-driven Chat and Unmatch actions with aria labels', () => {
    writeCachedMatches(
      [
        {
          id: 'm-act-1',
          name: 'Dave',
          age: 40,
          online: true,
          matched_at: '2026-09-11T12:00:00Z',
          photo_url: null,
        },
      ],
      [],
    );

    render(
      <MemoryRouter>
        <Matches />
      </MemoryRouter>,
    );

    const chatBtn = screen.getByTestId('match-message-m-act-1');
    expect(chatBtn).toHaveAttribute('title', 'Chat');
    expect(chatBtn).toHaveAttribute('aria-label', 'Chat with Dave');
    expect(chatBtn).toHaveTextContent('Chat');

    const unmatchBtn = screen.getByTestId('match-unmatch-m-act-1');
    expect(unmatchBtn).toHaveAttribute('title', 'Unmatch');
    expect(unmatchBtn).toHaveAttribute('aria-label', 'Unmatch with Dave');
  });
});

