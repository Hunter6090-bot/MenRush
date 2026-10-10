/**
 * Menu Discretion keeps keyboard and VoiceOver focus while Layout re-renders (QC P1).
 * Before the fix an inline onClose re-ran AccountMenu's open effect and moved focus to Close.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { MAP_PIN_FUZZ_STEPS_M } from '../lib/mapPinFuzz';

const currentPath = vi.hoisted(() => ({ value: '/discover' }));

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
    useLocation: () => ({ pathname: currentPath.value, search: '', hash: '', state: null, key: 'x' }),
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

function tree(n: number) {
  return (
    <MemoryRouter>
      <Layout>
        <div>child {n}</div>
      </Layout>
    </MemoryRouter>
  );
}

describe.each(['/discover', '/rooms'])('Menu Discretion focus on %s', (path) => {
  it('arrow keys keep focus on the slider and change the value through re-renders', async () => {
    currentPath.value = path;
    const { rerender } = render(tree(0));
    fireEvent.click(screen.getAllByTestId('account-menu-button')[0]);
    const range = (await screen.findByTestId('map-discretion-range')) as HTMLInputElement;
    await waitFor(() => expect(range).not.toBeDisabled());

    range.focus();
    expect(document.activeElement).toBe(range);

    let index = MAP_PIN_FUZZ_STEPS_M.indexOf(Number(range.value));
    expect(index).toBeGreaterThanOrEqual(0);
    const dir = index + 3 < MAP_PIN_FUZZ_STEPS_M.length ? 1 : -1;
    for (let i = 1; i <= 3; i += 1) {
      const before = range.value;
      fireEvent.keyDown(range, { key: dir > 0 ? 'ArrowRight' : 'ArrowLeft' });
      // The browser nudges a metre-valued range by 1 m; the slider moves a whole step.
      fireEvent.change(range, { target: { value: String(Number(before) + dir) } });
      index += dir;
      rerender(tree(i)); // parent re-render with fresh inline props
      const now = screen.getByTestId('map-discretion-range') as HTMLInputElement;
      expect(document.activeElement).toBe(now);
      expect(now.value).not.toBe(before);
      expect(now.value).toBe(String(MAP_PIN_FUZZ_STEPS_M[index]));
      expect(now.getAttribute('aria-valuetext')).toBe(`~${MAP_PIN_FUZZ_STEPS_M[index]} m`);
    }
  });
});

describe('Menu closes back to its trigger', () => {
  async function openFromTrigger(focusTrigger: boolean) {
    currentPath.value = '/discover';
    render(tree(0));
    const trigger = screen.getAllByTestId('account-menu-button')[0];
    if (focusTrigger) trigger.focus(); // Safari does not focus a button on tap, so test both
    fireEvent.click(trigger);
    await screen.findByTestId('account-menu');
    expect(document.activeElement).not.toBe(trigger);
    return trigger;
  }

  it.each([true, false])('Escape closes the Menu and focuses the Menu button (opener focused: %s)', async (focused) => {
    const trigger = await openFromTrigger(focused);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('account-menu')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it.each([true, false])('the Close button returns focus to the Menu button (opener focused: %s)', async (focused) => {
    const trigger = await openFromTrigger(focused);
    fireEvent.click(screen.getByTestId('account-menu-close'));
    await waitFor(() => expect(screen.queryByTestId('account-menu')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });
});
