import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InstallPrompt } from './InstallPrompt';
import { resetInstallPromptStoreForTests } from '../lib/installPromptStore';
import { useAuthStore } from '../hooks/store';
import { resetPromptPrefsSyncForTests } from '../lib/promptDismissal';

// Server prefs: nothing stored, so these cases cover the on-device rule.
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    promptPrefsAPI: {
      get: vi.fn().mockResolvedValue({ data: { never: [] } }),
      setNever: vi.fn().mockResolvedValue({ data: { never: [] } }),
    },
  };
});

vi.mock('../lib/push', () => ({
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

const phones = {
  'iPhone Safari':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Android Chrome':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  'Samsung Internet':
    'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
};

function setUa(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua });
}

function renderSheet(variant: 'sheet' | 'card' = 'sheet') {
  return render(
    <MemoryRouter initialEntries={['/discover']}>
      <InstallPrompt variant={variant} />
    </MemoryRouter>,
  );
}

describe("InstallPrompt: Don't show again", () => {
  const originalUa = navigator.userAgent;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetPromptPrefsSyncForTests();
    resetInstallPromptStoreForTests();
    useAuthStore.setState({ user: { id: 'member-a', name: 'Member' } as never, token: 't' });
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
  });

  for (const [phone, ua] of Object.entries(phones)) {
    it(`${phone}: ticked stays gone after remount, reload and a new session`, async () => {
      setUa(ua);
      const user = userEvent.setup();

      const first = renderSheet();
      expect(await screen.findByText('Put MenRush on your Home Screen.')).toBeInTheDocument();
      expect(screen.queryByText('Not now')).toBeNull();
      await user.click(screen.getByLabelText("Don't show again"));
      await user.click(screen.getByTestId('install-prompt-close'));
      expect(screen.queryByRole('dialog', { name: 'Install MenRush' })).toBeNull();
      first.unmount();

      const second = renderSheet();
      expect(screen.queryByRole('dialog', { name: 'Install MenRush' })).toBeNull();
      second.unmount();

      window.sessionStorage.clear();
      renderSheet();
      expect(screen.queryByRole('dialog', { name: 'Install MenRush' })).toBeNull();
    });
  }

  it('Close without the tick comes back next session, for that member only', async () => {
    setUa(phones['Android Chrome']);
    const user = userEvent.setup();
    const first = renderSheet();
    await user.click(await screen.findByTestId('install-prompt-close'));
    first.unmount();

    window.sessionStorage.clear();
    const second = renderSheet();
    expect(await screen.findByRole('dialog', { name: 'Install MenRush' })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Don't show again"));
    await user.click(screen.getByTestId('install-prompt-close'));
    second.unmount();

    window.sessionStorage.clear();
    useAuthStore.setState({ user: { id: 'member-b', name: 'Other' } as never, token: 't' });
    renderSheet();
    expect(await screen.findByRole('dialog', { name: 'Install MenRush' })).toBeInTheDocument();
  });
});

describe('InstallPrompt sheet and the phone tab bar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetPromptPrefsSyncForTests();
    resetInstallPromptStoreForTests();
    useAuthStore.setState({ user: { id: 'member-a', name: 'Member' } as never, token: 't' });
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

  for (const [phone, ua] of Object.entries(phones)) {
    it(`${phone}: the Get the app sheet sits above the tab bar, not over it`, async () => {
      Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua });
      renderSheet();
      const sheet = await screen.findByRole('dialog', { name: 'Install MenRush' });
      const classes = sheet.className.split(/\s+/);
      expect(classes).toContain('fixed');
      expect(classes).toContain('bottom-[var(--mobile-tab-bar-height)]');
      expect(classes).not.toContain('bottom-0');
    });
  }
});
