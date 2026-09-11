/**
 * React 19 upgrade smoke — BOA90 soft-refresh checklist:
 * login, Nearby↔Matches↔Chat routing, match → open chat.
 * Router stays on react-router-dom v6.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Login } from './pages/Login';
import { Matches } from './pages/Matches';
import { useAuthStore } from './hooks/store';
import { clearAuthSession } from './lib/authSession';
import {
  __resetTabListCacheForTests,
  writeCachedMatches,
} from './lib/tabListCache';
import { getNavItems, isNavActive } from './lib/navConfig';
import { authAPI, usersAPI } from './api/client';

vi.mock('./components/InstallPrompt', () => ({
  InstallPrompt: () => null,
}));

vi.mock('./hooks/useSocket', () => ({
  useSocket: () => null,
}));

vi.mock('./lib/nearbyPhotoSrc', () => ({
  useGridPhotoSrc: () => ({ src: undefined, phase: 'loading' }),
  clearGridPhotoQueue: vi.fn(),
}));

vi.mock('./components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock('./api/client', () => ({
  authAPI: {
    login: vi.fn(),
    verifyTwoFactorLogin: vi.fn(),
  },
  usersAPI: {
    getMatches: vi.fn(),
    getReceivedLikes: vi.fn(),
    getMe: vi.fn().mockResolvedValue({ data: {} }),
    updateLocation: vi.fn(),
  },
  messagesAPI: {
    getConversations: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

describe('React 19 BOA90 — login', () => {
  beforeEach(() => {
    clearAuthSession();
    useAuthStore.setState({ user: null, token: null });
    vi.mocked(authAPI.login).mockReset();
  });

  afterEach(() => {
    clearAuthSession();
    useAuthStore.setState({ user: null, token: null });
  });

  it('signs in and lands on /discover (Router v6 MemoryRouter)', async () => {
    const user = userEvent.setup();
    vi.mocked(authAPI.login).mockResolvedValue({
      data: {
        token: 'tok.sig',
        user: {
          id: 'u-al',
          email: 'al@menrush.com',
          name: 'Al',
          is_verified: true,
          verification_status: 'verified',
        },
      },
    } as never);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/discover"
            element={
              <div data-testid="discover-landed">
                Nearby
                <LocationProbe />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText('you@example.com'), 'al@menrush.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: /^Sign In$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('discover-landed')).toBeTruthy();
    });
    expect(screen.getByTestId('loc').textContent).toBe('/discover');
    expect(authAPI.login).toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe('tok.sig');
  });
});

describe('React 19 BOA90 — routing / bottom nav + deep links', () => {
  it('exposes Nearby, Matches, and Chat as primary mobile tabs', () => {
    const mobile = getNavItems().filter((i) => i.mobileTab).map((i) => i.to);
    expect(mobile).toEqual(
      expect.arrayContaining(['/discover', '/matches', '/conversations']),
    );
    // Stable primary order: Nearby before Chat before Matches in mobile chrome.
    expect(mobile.indexOf('/discover')).toBeLessThan(mobile.indexOf('/conversations'));
    expect(mobile.indexOf('/conversations')).toBeLessThan(mobile.indexOf('/matches'));
  });

  it('treats /messages/:id as Chat-active deep link (Router v6 path)', () => {
    expect(isNavActive('/messages/peer-42', '/conversations')).toBe(true);
    expect(isNavActive('/matches', '/matches')).toBe(true);
    expect(isNavActive('/discover', '/discover')).toBe(true);
    expect(isNavActive('/matches', '/discover')).toBe(false);
  });
});

describe('React 19 BOA90 — match flow → open chat', () => {
  beforeEach(() => {
    __resetTabListCacheForTests();
    vi.mocked(usersAPI.getMatches).mockReset();
    vi.mocked(usersAPI.getReceivedLikes).mockReset();
    // Keep revalidate pending so cache-backed match card is not wiped mid-click.
    vi.mocked(usersAPI.getMatches).mockReturnValue(new Promise(() => {}) as never);
    vi.mocked(usersAPI.getReceivedLikes).mockReturnValue(new Promise(() => {}) as never);
  });

  afterEach(() => {
    __resetTabListCacheForTests();
  });

  it('Message on a mutual match navigates to /messages/:id', async () => {
    const user = userEvent.setup();
    writeCachedMatches(
      [
        {
          id: 'm-peer-9',
          name: 'PeerNine',
          age: 31,
          online: true,
          matched_at: '2026-09-11T12:00:00Z',
        },
      ],
      [],
    );

    render(
      <MemoryRouter initialEntries={['/matches']}>
        <Routes>
          <Route path="/matches" element={<Matches />} />
          <Route
            path="/messages/:otherId"
            element={
              <div data-testid="chat-from-match">
                <LocationProbe />
              </div>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('match-card-m-peer-9')).toBeTruthy();
    await user.click(screen.getByTestId('match-message-m-peer-9'));

    await waitFor(() => {
      expect(screen.getByTestId('chat-from-match')).toBeTruthy();
    });
    expect(screen.getByTestId('loc').textContent).toBe('/messages/m-peer-9');
  });
});
