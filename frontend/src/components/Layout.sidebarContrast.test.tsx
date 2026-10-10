/**
 * Desktop sidebar active tab label contrast guard (light and dark): >= 4.5:1 via --nn-accent-text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
}));

vi.mock('../lib/tabListCache', () => ({
  readCachedMatches: vi.fn().mockReturnValue(undefined),
  refreshMatches: vi.fn().mockResolvedValue({ matches: [], likes: [] }),
}));

vi.mock('../lib/navConfig', () => ({
  getNavItems: () => [
    {
      to: '/discover',
      label: 'Nearby',
      shortLabel: 'Near',
      desktopNav: true,
      mobileTab: true,
      Icon: () => null,
    },
    {
      to: '/matches',
      label: 'Matches',
      desktopNav: true,
      mobileTab: true,
      Icon: () => null,
    },
    {
      to: '/conversations',
      label: 'Messages',
      shortLabel: 'Chat',
      desktopNav: true,
      mobileTab: true,
      Icon: () => null,
    },
  ],
  isNavActive: () => true,
  mobilePageTitle: () => 'Nearby',
}));

describe.each<Theme>(['light', 'dark'])('Desktop sidebar active label contrast (%s)', (theme) => {
  beforeEach(() => {
    localStorage.setItem('menrush_desktop_sidebar_expanded', '1');
  });

  it('active sidebar label uses --nn-accent-text and is at least 4.5:1', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div />
        </Layout>
      </MemoryRouter>,
    );
    const nav = screen.getByTestId('app-shell').querySelector('aside nav');
    expect(nav).not.toBeNull();
    const links = Array.from(nav!.querySelectorAll('a'));
    expect(links.length).toBe(3);
    for (const link of links) {
      const classes = (link.getAttribute('class') ?? '').split(/\s+/);
      expect(classes).toContain('text-[var(--nn-accent-text)]');
      // Only the token sets the colour: no cream, muted or copper text class can win by CSS order.
      const textColours = classes.filter((c) => /^text-(?:nn-|\[(?:var|#|rgb))/.test(c));
      expect(textColours, link.textContent ?? '').toEqual(['text-[var(--nn-accent-text)]']);
      const label = link.querySelector('span.truncate');
      expect(label, link.textContent ?? '').not.toBeNull();
      expect(label!.getAttribute('class') ?? '').not.toMatch(/(?:^|\s)text-(?:nn-|\[)/);
      expect(link.className).toContain('text-[15px]');
      expect(contrast(label!, theme), `${link.textContent} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
