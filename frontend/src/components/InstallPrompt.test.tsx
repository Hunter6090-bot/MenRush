import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InstallPrompt } from './InstallPrompt';
import * as androidTwa from '../lib/androidTwa';

vi.mock('../lib/push', () => ({
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/androidTwa', async () => {
  const actual = await vi.importActual<typeof import('../lib/androidTwa')>('../lib/androidTwa');
  return {
    ...actual,
    openAndroidPlayInstall: vi.fn(),
  };
});

const phoneUa =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const androidChromeUa =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
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

  it('shows Android Chrome install banner with Play CTA when not installed', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => androidChromeUa,
    });

    render(
      <MemoryRouter initialEntries={['/discover']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('install-prompt-android')).toHaveTextContent('Install from Play');
    expect(screen.getByText(/Trusted Web Activity|Play Store/i)).toBeTruthy();
  });

  it('opens Play install when Android Chrome banner CTA is tapped', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      get: () => androidChromeUa,
    });

    render(
      <MemoryRouter initialEntries={['/discover']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('install-prompt-android'));
    expect(androidTwa.openAndroidPlayInstall).toHaveBeenCalled();
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
