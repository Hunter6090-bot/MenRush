/**
 * QC on #354: the Get the app sheet, alerts and Finish profile never stack,
 * and the shared controls meet type size, tap target and contrast rules in
 * light and dark.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InstallPrompt } from './InstallPrompt';
import { PushAlertBanner } from './PushAlertBanner';
import { ProfileDepthStrip } from './ProfileDepthStrip';
import { ActivationBanner } from './ActivationBanner';
import { usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import * as push from '../lib/push';
import { resetInstallPromptStoreForTests } from '../lib/installPromptStore';
import { resetPromptSlotsForTests } from '../lib/promptSlot';
import { resetPromptPrefsSyncForTests } from '../lib/promptDismissal';
import { contrast, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';
import type { ProfileSetupSnapshot } from '../lib/profileSetup';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    usersAPI: { ...actual.usersAPI, getMe: vi.fn() },
    promptPrefsAPI: {
      get: vi.fn().mockResolvedValue({ data: { never: [] } }),
      setNever: vi.fn().mockResolvedValue({ data: { never: [] } }),
    },
  };
});

vi.mock('../lib/push', () => ({
  enablePushNotifications: vi.fn().mockResolvedValue('default'),
  getPushSupport: vi.fn(() => 'default'),
  iosNeedsHomeScreenForPush: vi.fn(() => false),
  isPushConfigured: vi.fn().mockResolvedValue(true),
  isStandalonePwa: vi.fn(() => false),
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

const css = readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8');
loadThemeTokens(css);

const androidUa =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const iphoneUa =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const desktopUa =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const incomplete: ProfileSetupSnapshot = {
  photo_url: 'https://example.com/me.jpg',
  bio: 'short',
  looking_for: '',
  interests: [],
  lat: 51.5,
  lng: -0.12,
};

const originalUa = navigator.userAgent;
function setUa(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua });
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** The app shell: top strip and alerts in Layout, the sheet in App. */
function renderShell(path = '/rooms') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProfileDepthStrip />
      <PushAlertBanner />
      <InstallPrompt variant="sheet" />
    </MemoryRouter>,
  );
}

function visiblePrompts(): string[] {
  const out: string[] = [];
  if (screen.queryByRole('dialog', { name: 'Install MenRush' })) out.push('sheet');
  if (screen.queryByTestId('push-alert-banner')) out.push('banner');
  if (screen.queryByTestId('profile-depth-strip')) out.push('profile');
  if (screen.queryByTestId('activation-banner')) out.push('activation');
  return out;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetInstallPromptStoreForTests();
  resetPromptSlotsForTests();
  resetPromptPrefsSyncForTests();
  useAuthStore.setState({ user: { id: 'member-a', name: 'Member' } as never, token: 't' });
  vi.mocked(push.getPushSupport).mockReturnValue('default');
  vi.mocked(push.iosNeedsHomeScreenForPush).mockReturnValue(false);
  vi.mocked(push.isPushConfigured).mockResolvedValue(true);
  vi.mocked(usersAPI.getMe).mockResolvedValue({ data: incomplete } as never);
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

describe('Top prompts: one at a time', () => {
  it('Android: Get the app sheet first, then alerts, then Finish profile, each after the last is closed', async () => {
    setUa(androidUa);
    const user = userEvent.setup();
    renderShell();
    await settle();
    expect(visiblePrompts()).toEqual(['sheet']);

    await user.click(screen.getByTestId('install-prompt-close'));
    await settle();
    expect(visiblePrompts()).toEqual(['banner']);
    expect(screen.getByText('Turn on alerts')).toBeInTheDocument();

    await user.click(screen.getByTestId('alerts-prompt-close'));
    await settle();
    expect(visiblePrompts()).toEqual(['profile']);

    await user.click(screen.getByTestId('profile-prompt-close'));
    await settle();
    expect(visiblePrompts()).toEqual([]);
  });

  it('Finish profile never flashes while alerts is still being checked', async () => {
    setUa(desktopUa);
    let resolveConfigured: (v: boolean) => void = () => {};
    vi.mocked(push.isPushConfigured).mockReturnValue(
      new Promise<boolean>((r) => {
        resolveConfigured = r;
      }),
    );
    renderShell();
    await settle();
    await settle();
    expect(visiblePrompts()).toEqual([]);

    await act(async () => resolveConfigured(true));
    await settle();
    expect(visiblePrompts()).toEqual(['banner']);
  });

  it('when alerts has nothing to ask, Finish profile shows on its own', async () => {
    setUa(desktopUa);
    vi.mocked(push.getPushSupport).mockReturnValue('granted' as never);
    renderShell();
    await settle();
    await settle();
    expect(visiblePrompts()).toEqual(['profile']);
  });

  it('iPhone Safari: only the Get the app sheet, never a second Add to Home Screen banner under it', async () => {
    setUa(iphoneUa);
    vi.mocked(push.iosNeedsHomeScreenForPush).mockReturnValue(true);
    const user = userEvent.setup();
    renderShell();
    await settle();
    expect(visiblePrompts()).toEqual(['sheet']);

    await user.click(screen.getByTestId('install-prompt-close'));
    await settle();
    // Closing the Get the app prompt closes it everywhere; Finish profile is next.
    expect(visiblePrompts()).toEqual(['profile']);
  });

  it('Discover: the Finish profile banner waits behind the alerts banner', async () => {
    setUa(desktopUa);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/discover']}>
        <PushAlertBanner />
        <ActivationBanner profile={incomplete} />
      </MemoryRouter>,
    );
    await settle();
    expect(visiblePrompts()).toEqual(['banner']);
    await user.click(screen.getByTestId('alerts-prompt-close'));
    await settle();
    expect(visiblePrompts()).toEqual(['activation']);
  });
});

describe("Top prompts: 'Don't show again' wording", () => {
  it('every prompt uses exactly "Don\'t show again"', async () => {
    setUa(androidUa);
    const user = userEvent.setup();
    renderShell();
    await settle();
    for (const prefix of ['install-prompt', 'alerts-prompt', 'profile-prompt']) {
      const label = screen.getByTestId(`${prefix}-never-label`);
      expect(label).toHaveTextContent(/^Don't show again$/);
      expect(document.body.textContent).not.toMatch(/remind me/i);
      await user.click(screen.getByTestId(`${prefix}-close`));
      await settle();
    }
  });
});

describe.each<Theme>(['light', 'dark'])('Top prompts: size and contrast (%s)', (theme) => {
  it('GET THE APP label and Show me how are 15px, Show me how at 4.5:1 or more on copper, 44px tall', async () => {
    setUa(iphoneUa);
    renderShell();
    await settle();
    const label = screen.getByTestId('install-prompt-label');
    expect(label.className).toContain('text-[15px]');
    expect(label.className).not.toMatch(/text-\[1[0-4]px\]/);

    const how = screen.getByTestId('install-prompt-how');
    expect(how).toHaveTextContent('Show me how');
    expect(how.className).toContain('text-[15px]');
    expect(how.className).toContain('min-h-[44px]');
    expect(contrast(how, theme)).toBeGreaterThanOrEqual(4.5);
  });

  it('the tick box is a custom bordered box at 3:1 or more, ticked state readable', async () => {
    setUa(iphoneUa);
    const user = userEvent.setup();
    renderShell();
    await settle();
    const box = screen.getByTestId('install-prompt-never');
    expect(box.className).toContain('appearance-none');
    expect(box.className).toContain('border-2');
    expect(box.className).toContain('border-[var(--cream-muted)]');
    expect(box.className).not.toMatch(/accent-\[/);
    // Box border on the card (sheet and banner) and on the copper tinted Finish profile strip.
    expect(tokenContrast('var(--cream-muted)', 'var(--bg-card)', theme)).toBeGreaterThanOrEqual(3);
    expect(
      tokenContrast('var(--cream-muted)', 'rgba(196, 131, 42, 0.1)', theme, 'var(--nn-bg)'),
    ).toBeGreaterThanOrEqual(3);
    // Ticked: accent fill against the card, and the tick against the fill.
    expect(tokenContrast('var(--nn-accent-text)', 'var(--bg-card)', theme)).toBeGreaterThanOrEqual(3);
    expect(tokenContrast('var(--bg-card)', 'var(--nn-accent-text)', theme)).toBeGreaterThanOrEqual(4.5);
    await user.click(box);
    expect(box).toBeChecked();
    // The tick itself is a 44px target (QC after #392); the label row stays 44px too.
    expect(box.className).toMatch(/min-h-\[44px\]/);
    expect(box.className).toMatch(/min-w-\[44px\]/);
    expect(screen.getByTestId('install-prompt-never-label').className).toContain('min-h-[44px]');
  });

  it('Finish profile strip body and button are 15px, button 44px tall', async () => {
    setUa(desktopUa);
    vi.mocked(push.getPushSupport).mockReturnValue('granted' as never);
    renderShell();
    await settle();
    await settle();
    const strip = screen.getByTestId('profile-depth-strip');
    const body = within(strip).getByTestId('profile-depth-body');
    const button = within(strip).getByTestId('profile-depth-finish');
    expect(body.className).toContain('text-[15px]');
    expect(button.className).toContain('text-[15px]');
    expect(button.className).toContain('min-h-[44px]');
    expect(strip.innerHTML).not.toMatch(/text-sm|text-xs|text-\[1[0-4](?:\.\d+)?px\]/);
  });
});
