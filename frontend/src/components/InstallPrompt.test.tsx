import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InstallPrompt } from './InstallPrompt';

vi.mock('../lib/push', () => ({
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

const phoneUa =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const desktopUa =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('InstallPrompt phone-only gate', () => {
  const originalUa = navigator.userAgent;

  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => originalUa,
    });
  });

  it('hides the sticky banner on desktop browsers', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => desktopUa,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Show me how')).toBeNull();
  });

  it('shows the sticky banner on iPhone when not installed', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => phoneUa,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Show me how')).toBeTruthy();
    expect(screen.getByText('Put MenRush on your Home Screen.')).toBeTruthy();
  });

  it('shows the sticky banner on Android phone when not installed', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () =>
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });

    render(
      <MemoryRouter initialEntries={['/discover']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Show me how')).toBeTruthy();
  });

  it('hides the sticky banner on /messages even on iPhone', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => phoneUa,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/messages/abc']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Show me how')).toBeNull();
  });

  it('hides the sticky banner on /conversations and room threads on iPhone', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => phoneUa,
    });

    for (const path of ['/conversations', '/rooms/room-1']) {
      const { container, unmount } = render(
        <MemoryRouter initialEntries={[path]}>
          <InstallPrompt variant="sheet" />
        </MemoryRouter>,
      );
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByText('Show me how')).toBeNull();
      unmount();
    }
  });

  it('hides the sticky banner on /settings so Sign out stays tappable', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => phoneUa,
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Show me how')).toBeNull();
  });
});
