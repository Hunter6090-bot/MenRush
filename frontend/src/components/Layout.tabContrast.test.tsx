/**
 * Bottom tab active label contrast guard (light and dark): >= 4.5:1 via --nn-accent-text.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrast, loadThemeTokens, type Theme } from '../test/themeContrast';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

const logout = vi.fn();
const navigate = vi.fn();

vi.mock('../hooks/store', () => ({
  useAuthStore: (sel?: (s: { user: { id: string; name: string }; logout: () => void }) => unknown) => {
    const state = {
      user: { id: 'u1', name: 'Alex', photo_url: null },
      logout,
    };
    return typeof sel === 'function' ? sel(state) : state;
  },
  useNotificationStore: (sel?: (s: { unreadCount: number }) => unknown) => {
    const state = { unreadCount: 0 };
    return typeof sel === 'function' ? sel(state) : state;
  },
  useUnreadStore: (sel?: (s: { count: number }) => unknown) => {
    const state = { count: 0 };
    return typeof sel === 'function' ? sel(state) : state;
  },
  useLocationStore: (sel?: (s: { lat: number | null; lng: number | null }) => unknown) => {
    const state = { lat: null, lng: null, setLocation: vi.fn() };
    return typeof sel === 'function' ? sel(state) : state;
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ pathname: '/discover', search: '', hash: '', state: null, key: 'x' }),
  };
});

vi.mock('../api/client', () => ({
  usersAPI: {
    getMatches: vi.fn().mockResolvedValue({ data: [] }),
    getReceivedLikes: vi.fn().mockResolvedValue({ data: [] }),
    getMe: vi.fn().mockResolvedValue({ data: {} }),
    updateLocation: vi.fn(),
  },
  messagesAPI: {
    getConversations: vi.fn().mockResolvedValue({ data: [] }),
  },
  profileMetaAPI: {
    getMapPinFuzz: vi.fn().mockResolvedValue({ data: { map_pin_fuzz_m: 400 } }),
    setMapPinFuzz: vi.fn().mockResolvedValue({ data: { map_pin_fuzz_m: 640 } }),
  },
}));

vi.mock('../lib/homeView', async () => {
  const actual = await vi.importActual<typeof import('../lib/homeView')>('../lib/homeView');
  return { ...actual };
});

vi.mock('../lib/tabListCache', () => ({
  readCachedMatches: vi.fn().mockReturnValue(undefined),
  refreshMatches: vi.fn().mockResolvedValue({ matches: [], likes: [] }),
}));

vi.mock('../lib/navConfig', () => ({
  getNavItems: () => [
    { to: '/discover', label: 'Map', shortLabel: 'Map', desktopNav: true, mobileTab: true, Icon: () => null },
    { to: '/conversations', label: 'Messages', shortLabel: 'Chat', desktopNav: true, mobileTab: true, Icon: () => null },
    { to: '/rooms', label: 'Rooms', shortLabel: 'Rooms', desktopNav: true, mobileTab: true, Icon: () => null },
    { to: '/out', label: 'Out', shortLabel: 'Out', desktopNav: true, mobileTab: true, Icon: () => null },
    { to: '/profile', label: 'You', shortLabel: 'You', desktopNav: true, mobileTab: true, Icon: () => null },
  ],
  isNavActive: () => true,
  mobilePageTitle: () => 'Map',
}));

describe.each<Theme>(['light', 'dark'])('Bottom tab active label contrast (%s)', (theme) => {
  it('active tab labels are at least 4.5:1', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div />
        </Layout>
      </MemoryRouter>,
    );
    const tabs = [
      screen.getByTestId('mobile-nav-home-toggle'),
      screen.getByTestId('mobile-nav-conversations'),
      screen.getByTestId('mobile-nav-rooms'),
      screen.getByTestId('mobile-nav-out'),
      screen.getByTestId('mobile-nav-profile'),
    ];
    for (const tab of tabs) {
      expect(tab.className).toContain('text-[var(--nn-accent-text)]');
      const label = tab.querySelector('span.text-\\[15px\\]') ?? tab;
      expect(contrast(label, theme), `${tab.textContent} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
