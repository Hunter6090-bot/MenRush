import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GetTheApp } from '../pages/GetTheApp';
import {
  getDeferredInstallPrompt,
  resetInstallPromptStoreForTests,
  startInstallPromptCapture,
} from '../lib/installPromptStore';

const navigate = vi.fn();

vi.mock('../lib/push', () => ({
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

const iosUa =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const androidUa =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

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
  };
  Object.defineProperty(event, 'prompt', { value: prompt });
  Object.defineProperty(event, 'userChoice', { value: userChoice });
  window.dispatchEvent(event);
  return { prompt };
}

describe('GetTheApp walkthrough', () => {
  const originalUa = navigator.userAgent;

  beforeEach(() => {
    navigate.mockClear();
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
    setUa(iosUa);
  });

  afterEach(() => {
    setUa(originalUa);
    resetInstallPromptStoreForTests();
  });

  it('renders a real apostrophe on the last step, not a unicode escape', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GetTheApp />
      </MemoryRouter>,
    );

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Done' }));

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe("It's on your Home Screen.");
    expect(heading.textContent).not.toContain('\\u2019');
    expect(heading.textContent).not.toContain('u2019');
  });

  it('navigates to /login when Done is pressed on the last step', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <GetTheApp />
      </MemoryRouter>,
    );

    for (let i = 0; i < 3; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(navigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('iPhone tab keeps Safari steps and never shows a native Install button', async () => {
    const user = userEvent.setup();
    fireBeforeInstallPrompt(); // should not invent a one-tap CTA on iOS

    render(
      <MemoryRouter>
        <GetTheApp />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'iPhone' })).toBeTruthy();
    expect(screen.getByText('Open Safari')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Install MenRush' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Android' }));
    // Android tab with deferred: one-tap install (event may still be in store)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Install MenRush' })).toBeTruthy());
  });

  it('Android with deferred: leads with Install MenRush, no four-step how-to', async () => {
    setUa(androidUa);
    const user = userEvent.setup();
    const { prompt } = fireBeforeInstallPrompt();

    render(
      <MemoryRouter>
        <GetTheApp />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Install MenRush' })).toBeTruthy());
    expect(screen.queryByText(/Step 1 of/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Install MenRush' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("It's on your Home Screen.")).toBeTruthy());
    expect(screen.queryByText(/Step 1 of/)).toBeNull();
  });

  it('Android without deferred: shows Chrome-menu how-to fallback', () => {
    setUa(androidUa);

    render(
      <MemoryRouter>
        <GetTheApp />
      </MemoryRouter>,
    );

    expect(screen.getByText('Open Chrome')).toBeTruthy();
    expect(screen.getByText(/Step 1 of 4/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Install MenRush' })).toBeNull();
  });

  it('deferred event captured before mount is available on Get the App', async () => {
    setUa(androidUa);
    fireBeforeInstallPrompt();
    expect(getDeferredInstallPrompt()).not.toBeNull();

    render(
      <MemoryRouter>
        <GetTheApp />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Install MenRush' })).toBeTruthy());
  });
});
