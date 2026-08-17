import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    getMe: vi.fn().mockResolvedValue({ data: {} }),
    updateLocation: vi.fn(),
  },
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
  ],
  isNavActive: () => true,
  mobilePageTitle: () => 'Nearby',
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
});
