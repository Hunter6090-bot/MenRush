import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { InstallPrompt } from './InstallPrompt';
import {
  getDeferredInstallPrompt,
  resetInstallPromptStoreForTests,
  startInstallPromptCapture,
} from '../lib/installPromptStore';

vi.mock('../lib/push', () => ({
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

const phoneUa =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const androidUa =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const desktopUa =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function setUa(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => ua,
  });
}

function fireBeforeInstallPrompt() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const userChoice = Promise.resolve({ outcome: 'accepted' as const });
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: typeof prompt;
    userChoice: typeof userChoice;
    preventDefault: () => void;
  };
  Object.defineProperty(event, 'prompt', { value: prompt });
  Object.defineProperty(event, 'userChoice', { value: userChoice });
  window.dispatchEvent(event);
  return { prompt, userChoice };
}

describe('InstallPrompt phone-only gate', () => {
  const originalUa = navigator.userAgent;

  beforeEach(() => {
    localStorage.clear();
    resetInstallPromptStoreForTests();
    startInstallPromptCapture();
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
    setUa(originalUa);
    resetInstallPromptStoreForTests();
  });

  it('hides the sticky banner on desktop browsers', () => {
    setUa(desktopUa);

    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Show me how')).toBeNull();
    expect(screen.queryByText('Install app')).toBeNull();
  });

  it('shows Show me how on iPhone when not installed (no fake native install)', () => {
    setUa(phoneUa);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Show me how')).toBeTruthy();
    expect(screen.queryByText('Install app')).toBeNull();
    expect(screen.getByText('Put MenRush on your Home Screen.')).toBeTruthy();
  });

  it('shows Show me how on Android when no beforeinstallprompt yet (fallback)', () => {
    setUa(androidUa);

    render(
      <MemoryRouter initialEntries={['/discover']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Show me how')).toBeTruthy();
    expect(screen.queryByText('Install app')).toBeNull();
  });

  it('Android with deferred event: primary CTA is Install app and calls prompt()', async () => {
    setUa(androidUa);
    const user = userEvent.setup();
    const { prompt } = fireBeforeInstallPrompt();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Install app')).toBeTruthy());
    expect(screen.queryByText('Show me how')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Install app' }));
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('keeps the deferred event after InstallPrompt unmounts (survives navigation)', async () => {
    setUa(androidUa);
    fireBeforeInstallPrompt();

    const { unmount } = render(
      <MemoryRouter initialEntries={['/login']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Install app')).toBeTruthy());
    expect(getDeferredInstallPrompt()).not.toBeNull();

    unmount();
    expect(getDeferredInstallPrompt()).not.toBeNull();
  });

  it('hides the sticky banner on /messages even on iPhone', () => {
    setUa(phoneUa);

    const { container } = render(
      <MemoryRouter initialEntries={['/messages/abc']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Show me how')).toBeNull();
  });

  it('hides the sticky banner on /conversations and room threads on iPhone', () => {
    setUa(phoneUa);

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
    setUa(phoneUa);

    const { container } = render(
      <MemoryRouter initialEntries={['/settings']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Show me how')).toBeNull();
  });

  it('hides when already standalone', () => {
    setUa(androidUa);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('display-mode: standalone'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    fireBeforeInstallPrompt();

    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('hides on /get-the-app even when deferred is available', async () => {
    setUa(androidUa);
    fireBeforeInstallPrompt();

    const { container } = render(
      <MemoryRouter initialEntries={['/get-the-app']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(getDeferredInstallPrompt()).not.toBeNull();
  });

  it('Install app does not navigate to /get-the-app', async () => {
    setUa(androidUa);
    const user = userEvent.setup();
    fireBeforeInstallPrompt();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<InstallPrompt variant="card" />} />
          <Route path="/get-the-app" element={<div>GET_THE_APP_PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Install app')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Install app' }));
    expect(screen.queryByText('GET_THE_APP_PAGE')).toBeNull();
  });
});
