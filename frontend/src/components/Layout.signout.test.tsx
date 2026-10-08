import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { profileMetaAPI } from '../api/client';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';

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

describe('Layout sign out', () => {
  beforeEach(() => {
    logout.mockClear();
    navigate.mockClear();
  });

  it('requires confirmation before signing out', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Layout>
          <div>child</div>
        </Layout>
      </MemoryRouter>,
    );

    const trigger = screen.getByTestId('desktop-sign-out');
    expect(trigger).toHaveAttribute('aria-label', 'Sign out');
    expect(trigger).toHaveAttribute('title', 'Sign out');

    await user.click(trigger);
    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByTestId('sign-out-confirm')).toBeInTheDocument();

    await user.click(screen.getByTestId('sign-out-cancel'));
    expect(screen.queryByTestId('sign-out-confirm')).not.toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();

    await user.click(trigger);
    await user.click(screen.getByTestId('sign-out-confirm-btn'));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('renders home Map|List toggle + Chat · Rooms · Out · You', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>child</div>
        </Layout>
      </MemoryRouter>,
    );

    const primary = screen.getByRole('navigation', { name: 'Primary' });
    // First slot is a toggle button, not a /discover link.
    expect(primary.querySelector('a[href="/discover"]')).toBeFalsy();
    expect(screen.getByTestId('mobile-nav-home-toggle')).toBeTruthy();
    expect(screen.getByTestId('mobile-nav-home-toggle').textContent).toMatch(/List|Map/);
    expect(primary.querySelector('a[href="/conversations"]')).toBeTruthy();
    expect(primary.querySelector('a[href="/rooms"]')).toBeTruthy();
    expect(primary.querySelector('a[href="/out"]')).toBeTruthy();
    expect(primary.querySelector('a[href="/profile"]')).toBeTruthy();
    expect(primary.querySelector('a[href="/matches"]')).toBeFalsy();
    expect(screen.getByTestId('mobile-nav-conversations')).toBeTruthy();
    expect(screen.getByTestId('mobile-nav-out')).toBeTruthy();
  });

  it('top-right Menu opens account links and Sign out still confirms', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Layout>
          <div>child</div>
        </Layout>
      </MemoryRouter>,
    );

    // Phone header + desktop top bar each carry one Menu button.
    const buttons = screen.getAllByTestId('account-menu-button');
    expect(buttons.length).toBe(2);
    for (const b of buttons) {
      expect(b).toHaveAttribute('aria-label', 'Menu');
      expect(b.className).toMatch(/min-h-\[44px\]/);
      expect(b.className).toMatch(/min-w-\[44px\]/);
    }
    // Header keeps theme, search and bell.
    expect(screen.getAllByRole('button', { name: 'Search profiles' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Alerts' })).toBeTruthy();

    expect(screen.queryByTestId('account-menu')).not.toBeInTheDocument();
    await user.click(buttons[0]);
    const menu = screen.getByTestId('account-menu');
    const hrefs = Array.from(menu.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/settings',
        '/settings#account',
        '/settings#two-factor',
        '/settings#notifications',
        '/settings#blocked',
        '/settings#delete-account',
        '/premium',
        '/albums',
        '/matches',
        '/notifications',
        '/stream',
        '/events',
        '/hot-spots',
        '/safety',
        '/help',
        '/get-the-app',
        '/terms',
        '/privacy',
        '/cookies',
        '/guidelines',
        '/contact',
      ]),
    );
    for (const id of ['you', 'discover', 'account', 'help']) {
      expect(screen.getByTestId(`account-menu-section-${id}`)).toBeInTheDocument();
    }
    for (const a of Array.from(menu.querySelectorAll('nav a'))) {
      expect(a.className).toMatch(/min-h-\[(4[4-9]|5\d)px\]/);
    }
    expect(menu.textContent).not.toMatch(/beta/i);
    expect(menu.textContent).not.toMatch(/\u2014/);

    await user.click(screen.getByTestId('account-menu-sign-out'));
    expect(screen.queryByTestId('account-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('sign-out-confirm')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it('Discretion sits in the Menu, reads the saved value and only writes on change', async () => {
    const user = userEvent.setup();
    vi.mocked(profileMetaAPI.setMapPinFuzz).mockClear();
    render(
      <MemoryRouter>
        <Layout>
          <div>child</div>
        </Layout>
      </MemoryRouter>,
    );
    await user.click(screen.getAllByTestId('account-menu-button')[0]);
    const range = (await screen.findByTestId('map-discretion-range')) as HTMLInputElement;
    await waitFor(() => expect(range).not.toBeDisabled());
    expect(screen.getByTestId('map-discretion-pill').textContent).toMatch(/400/);
    expect(profileMetaAPI.setMapPinFuzz).not.toHaveBeenCalled();

    const heard: number[] = [];
    const onFuzz = (e: Event) => heard.push((e as CustomEvent<number>).detail);
    window.addEventListener('menrush:map-pin-fuzz', onFuzz);
    fireEvent.change(range, { target: { value: String(Number(range.value) + 1) } });
    window.removeEventListener('menrush:map-pin-fuzz', onFuzz);
    expect(profileMetaAPI.setMapPinFuzz).toHaveBeenCalledTimes(1);
    expect(heard).toHaveLength(1);
  });
});
