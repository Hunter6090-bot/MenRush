/**
 * Bottom tab icons pinned to the Claude Design board (MenRush Phone App, 9 states):
 * grid for List, speech bubble for Chat, video camera for Rooms, half moon for Out,
 * person for You. Pete's swap lock: on the map the first tab offers List (grid);
 * on the list it offers Map (map pin). Out must never reuse the Map pin.
 * Idle and active icon colours stay >= 3:1 in light and dark.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HOME_VIEW_KEY } from '../lib/homeView';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tokenContrast, loadThemeTokens, type Theme } from '../test/themeContrast';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

const logout = vi.fn();
const navigate = vi.fn();
let currentPath = '/discover';

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
    useLocation: () => ({ pathname: currentPath, search: '', hash: '', state: null, key: 'x' }),
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


function renderShell() {
  return render(
    <MemoryRouter>
      <Layout>
        <div />
      </Layout>
    </MemoryRouter>,
  );
}

function iconOf(testId: string): string | null {
  return screen.getByTestId(testId).querySelector('svg')?.getAttribute('data-icon') ?? null;
}

describe('bottom tab icons match the board', () => {
  it('map home: List (grid) · Chat (bubble) · Rooms (camera) · Out (half moon) · You (person)', () => {
    localStorage.setItem(HOME_VIEW_KEY, 'map');
    renderShell();
    const toggle = screen.getByTestId('mobile-nav-home-toggle');
    expect(toggle.textContent).toContain('List');
    expect(iconOf('mobile-nav-home-toggle')).toBe('grid');
    expect(iconOf('mobile-nav-conversations')).toBe('chat-bubble');
    expect(iconOf('mobile-nav-rooms')).toBe('video-camera');
    expect(iconOf('mobile-nav-out')).toBe('half-moon');
    expect(iconOf('mobile-nav-profile')).toBe('person');
    cleanup();
  });

  it('list home: first tab swaps to Map with the map pin (Pete lock)', () => {
    localStorage.setItem(HOME_VIEW_KEY, 'list');
    renderShell();
    const toggle = screen.getByTestId('mobile-nav-home-toggle');
    expect(toggle.textContent).toContain('Map');
    expect(iconOf('mobile-nav-home-toggle')).toBe('map-pin');
    cleanup();
    localStorage.removeItem(HOME_VIEW_KEY);
  });

  it('Out never reuses the Map pin, and no tab still draws the envelope or star pin', () => {
    localStorage.setItem(HOME_VIEW_KEY, 'list');
    renderShell();
    const icons = ['mobile-nav-home-toggle', 'mobile-nav-conversations', 'mobile-nav-rooms', 'mobile-nav-out', 'mobile-nav-profile'].map(iconOf);
    expect(new Set(icons).size).toBe(5);
    expect(iconOf('mobile-nav-out')).not.toBe('map-pin');
    cleanup();
    localStorage.removeItem(HOME_VIEW_KEY);
  });
});

describe('Chat icon is the board\'s round outlined bubble', () => {
  const ROUND_BUBBLE = 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z';

  function chatSvg(): SVGSVGElement {
    const svg = screen.getByTestId('mobile-nav-conversations').querySelector('svg');
    if (!svg) throw new Error('no chat svg');
    return svg;
  }

  function expectOutline(svg: SVGSVGElement) {
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('stroke-width')).toBe('2');
    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(1);
    expect(paths[0].getAttribute('d')).toBe(ROUND_BUBBLE);
    expect(paths[0].getAttribute('fill')).toBe('none');
    expect(svg.querySelector('[fill="currentColor"]')).toBeNull();
    expect(svg.hasAttribute('filled')).toBe(false);
  }

  it('idle: round bubble path, stroke only, same size and stroke as the other tabs', () => {
    currentPath = '/discover';
    renderShell();
    const svg = chatSvg();
    expectOutline(svg);
    const rooms = screen.getByTestId('mobile-nav-rooms').querySelector('svg');
    expect(svg.getAttribute('width')).toBe(rooms?.getAttribute('width'));
    expect(svg.getAttribute('stroke-width')).toBe(rooms?.getAttribute('stroke-width'));
    cleanup();
  });

  it('active: still an outline (copper via the tab colour), never filled', () => {
    currentPath = '/conversations';
    renderShell();
    const tab = screen.getByTestId('mobile-nav-conversations');
    expect(tab.className).toContain('text-[var(--nn-accent-text)]');
    expectOutline(chatSvg());
    cleanup();
    currentPath = '/discover';
  });

  it('other tabs keep their active fill (Rooms)', () => {
    currentPath = '/rooms';
    renderShell();
    const rooms = screen.getByTestId('mobile-nav-rooms').querySelector('svg');
    expect(rooms?.querySelector('[fill="currentColor"]')).not.toBeNull();
    cleanup();
    currentPath = '/discover';
  });
});

describe.each<Theme>(['light', 'dark'])('bottom tab icon contrast (%s)', (theme) => {
  it('idle icons (cream-muted) and active icons (accent) are >= 3:1 on the tab bar', () => {
    expect(tokenContrast('var(--cream-muted)', 'var(--bg-elevated)', theme)).toBeGreaterThanOrEqual(3);
    expect(tokenContrast('var(--nn-accent-text)', 'var(--bg-elevated)', theme)).toBeGreaterThanOrEqual(3);
  });
});
