import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PushAlertBanner } from '../components/PushAlertBanner';
import { InstallPrompt } from '../components/InstallPrompt';
import { ProfileDepthStrip } from '../components/ProfileDepthStrip';
import { promptPrefsAPI, usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import {
  PROMPT_PREFS_TIMEOUT_MS,
  promptNeverKey,
  resetPromptPrefsSyncForTests,
  setPromptPrefsTimeoutForTests,
} from './promptDismissal';
import { resetPromptSlotsForTests } from './promptSlot';
import { resetInstallPromptStoreForTests } from './installPromptStore';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    usersAPI: { ...actual.usersAPI, getMe: vi.fn() },
    promptPrefsAPI: { get: vi.fn(), setNever: vi.fn() },
  };
});

vi.mock('./push', () => ({
  enablePushNotifications: vi.fn().mockResolvedValue('default'),
  getPushSupport: vi.fn(() => 'default'),
  iosNeedsHomeScreenForPush: vi.fn(() => false),
  isPushConfigured: vi.fn().mockResolvedValue(true),
  isStandalonePwa: vi.fn(() => false),
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

const androidUa =
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36';

/** Server state per member, as the API would hold it. */
let server: Record<string, Set<string>>;
let online: boolean;

function signIn(id: string) {
  useAuthStore.setState({ user: { id, name: 'Member' } as never, token: 't' });
}

/** A different phone: empty localStorage and sessionStorage, fresh page load. */
function newDevice() {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetPromptPrefsSyncForTests();
  resetPromptSlotsForTests();
}

/** Same phone, new page load. */
function reload() {
  window.sessionStorage.clear();
  resetPromptPrefsSyncForTests();
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  server = {};
  online = true;
  newDevice();
  resetInstallPromptStoreForTests();
  signIn('member-a');
  vi.mocked(promptPrefsAPI.get).mockReset();
  vi.mocked(promptPrefsAPI.setNever).mockReset();
  vi.mocked(promptPrefsAPI.get).mockImplementation(async () => {
    if (!online) throw new Error('offline');
    const id = useAuthStore.getState().user!.id;
    return { data: { never: [...(server[id] ?? [])] } } as never;
  });
  vi.mocked(promptPrefsAPI.setNever).mockImplementation(async (prompt) => {
    if (!online) throw new Error('offline');
    const id = useAuthStore.getState().user!.id;
    (server[id] ??= new Set()).add(prompt);
    return { data: { never: [...server[id]] } } as never;
  });
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

describe("Don't show again follows the member across devices", () => {
  it('Turn on alerts: ticked on device A is hidden on device B', async () => {
    const user = userEvent.setup();
    const a = render(<PushAlertBanner />);
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
    await user.click(screen.getByLabelText("Don't show again"));
    await user.click(screen.getByTestId('alerts-prompt-close'));
    await waitFor(() => expect(promptPrefsAPI.setNever).toHaveBeenCalledWith('alerts'));
    a.unmount();

    newDevice();
    render(<PushAlertBanner />);
    await settle();
    expect(promptPrefsAPI.get).toHaveBeenCalled();
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    expect(window.localStorage.getItem(promptNeverKey('alerts', 'member-a'))).toBe('1');
  });

  it('Get the app: server says never, so a fresh phone never shows the sheet', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => androidUa });
    server['member-a'] = new Set(['install']);
    render(
      <MemoryRouter initialEntries={['/discover']}>
        <InstallPrompt variant="sheet" />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Install MenRush' })).toBeNull(),
    );
  });

  it('Finish your profile: server says never, so a fresh phone never shows the strip', async () => {
    server['member-a'] = new Set(['profile']);
    vi.mocked(usersAPI.getMe).mockResolvedValue({
      data: { photo_url: '/x.jpg', bio: 'short', looking_for: '', interests: [] },
    } as never);
    render(
      <MemoryRouter initialEntries={['/messages']}>
        <ProfileDepthStrip />
      </MemoryRouter>,
    );
    await settle();
    await settle();
    expect(screen.queryByTestId('profile-depth-strip')).toBeNull();
  });

  it('offline: the tick still holds on this phone and reaches the server once back online', async () => {
    online = false;
    const user = userEvent.setup();
    const first = render(<PushAlertBanner />);
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
    await user.click(screen.getByLabelText("Don't show again"));
    await user.click(screen.getByTestId('alerts-prompt-close'));
    first.unmount();
    expect(server['member-a']).toBeUndefined();

    reload();
    const second = render(<PushAlertBanner />);
    await settle();
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    second.unmount();

    online = true;
    reload();
    render(<PushAlertBanner />);
    await waitFor(() => expect(server['member-a']?.has('alerts')).toBe(true));
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();

    newDevice();
    render(<PushAlertBanner />);
    await settle();
    expect(screen.queryAllByTestId('push-alert-banner')).toHaveLength(0);
  });

  it('offline on a fresh phone with no cache: the prompt shows, nothing breaks', async () => {
    server['member-a'] = new Set(['alerts']);
    online = false;
    render(<PushAlertBanner />);
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
  });

  it("per member: member A's never does not hide it for member B, on the server or this phone", async () => {
    server['member-a'] = new Set(['alerts']);
    const a = render(<PushAlertBanner />);
    await settle();
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    a.unmount();

    reload();
    signIn('member-b');
    render(<PushAlertBanner />);
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
    expect(promptPrefsAPI.setNever).not.toHaveBeenCalled();
  });
});

/** The app shell on a phone: top strip and alerts in Layout, the sheet in App. */
function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/rooms']}>
      <ProfileDepthStrip />
      <PushAlertBanner />
      <InstallPrompt variant="sheet" />
    </MemoryRouter>,
  );
}

/** Records every prompt that was ever put on screen, however briefly. */
function watchPrompts() {
  const seen = new Set<string>();
  const check = () => {
    if (document.querySelector('[data-testid="push-alert-banner"]')) seen.add('banner');
    if (document.querySelector('[data-testid="profile-depth-strip"]')) seen.add('profile');
    if (document.querySelector('[role="dialog"][aria-label="Install MenRush"]')) seen.add('sheet');
  };
  const observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true });
  return {
    seen,
    stop: () => {
      check();
      observer.disconnect();
    },
  };
}

const incompleteMe = { photo_url: '/x.jpg', bio: 'short', looking_for: '', interests: [] };

describe('New device: prompts wait for the server prefs (QC P0 on #357)', () => {
  it('nothing shows while the read is in flight; prompts the member turned off never flash', async () => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => androidUa });
    vi.mocked(usersAPI.getMe).mockResolvedValue({ data: incompleteMe } as never);
    let answer: (v: unknown) => void = () => {};
    vi.mocked(promptPrefsAPI.get).mockReturnValue(
      new Promise((r) => {
        answer = r;
      }) as never,
    );
    const watch = watchPrompts();
    renderShell();
    await settle();
    await settle();
    expect(watch.seen.size).toBe(0);

    await act(async () => answer({ data: { never: ['install', 'alerts'] } }));
    await settle();
    watch.stop();
    expect(screen.getByTestId('profile-depth-strip')).toBeInTheDocument();
    // The sheet and the alerts banner were never on screen, not even for a frame.
    expect([...watch.seen]).toEqual(['profile']);
  });

  it('no answer: falls back to this phone after the short timeout', async () => {
    expect(PROMPT_PREFS_TIMEOUT_MS).toBeGreaterThanOrEqual(1500);
    expect(PROMPT_PREFS_TIMEOUT_MS).toBeLessThanOrEqual(2000);
    setPromptPrefsTimeoutForTests(40);
    vi.mocked(promptPrefsAPI.get).mockReturnValue(new Promise(() => {}) as never);
    render(<PushAlertBanner />);
    await settle();
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
  });

  it('no answer, but this phone already has the tick: stays hidden after the timeout', async () => {
    setPromptPrefsTimeoutForTests(20);
    window.localStorage.setItem(promptNeverKey('alerts', 'member-a'), '1');
    vi.mocked(promptPrefsAPI.get).mockReturnValue(new Promise(() => {}) as never);
    render(<PushAlertBanner />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
  });
});

describe('Server errors (QC P2 on #357)', () => {
  it('a 500 is not asked again on this page load, and the prompt falls back to this phone', async () => {
    vi.mocked(promptPrefsAPI.get).mockRejectedValue(
      Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } }),
    );
    const first = render(<PushAlertBanner />);
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
    first.unmount();
    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <ProfileDepthStrip />
        <PushAlertBanner />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
    expect(promptPrefsAPI.get).toHaveBeenCalledTimes(1);
  });
});

describe('Old device keys are synced up once (QC P1 on #357)', () => {
  for (const legacyKey of ['menrush_home_screen_card_never', 'menrush_install_prompt_dismissed']) {
    it(`${legacyKey}: pushed to the server once, for the member signed in, then not again`, async () => {
      window.localStorage.setItem(legacyKey, '1');
      const a = render(<PushAlertBanner />);
      await waitFor(() => expect(server['member-a']?.has('install')).toBe(true));
      await settle();
      expect(vi.mocked(promptPrefsAPI.setNever).mock.calls).toEqual([['install']]);
      expect(window.localStorage.getItem('menrush_prompt_legacy_synced')).toBe('1');
      expect(window.localStorage.getItem(promptNeverKey('install', 'member-a'))).toBe('1');
      a.unmount();

      // Same phone, another member: the device key still hides it here but is not sent again.
      reload();
      signIn('member-b');
      render(<PushAlertBanner />);
      await settle();
      await settle();
      expect(vi.mocked(promptPrefsAPI.setNever).mock.calls).toEqual([['install']]);
      expect(server['member-b']).toBeUndefined();
    });
  }

  it('already on the server: no write, marked as synced', async () => {
    window.localStorage.setItem('menrush_home_screen_card_never', '1');
    server['member-a'] = new Set(['install']);
    render(<PushAlertBanner />);
    await settle();
    await settle();
    expect(promptPrefsAPI.setNever).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('menrush_prompt_legacy_synced')).toBe('1');
  });

  it('offline during the first sync: tried again on the next page load', async () => {
    window.localStorage.setItem('menrush_install_prompt_dismissed', '1');
    vi.mocked(promptPrefsAPI.setNever).mockRejectedValueOnce(new Error('offline'));
    const a = render(<PushAlertBanner />);
    await settle();
    await settle();
    expect(window.localStorage.getItem('menrush_prompt_legacy_synced')).toBeNull();
    a.unmount();

    reload();
    render(<PushAlertBanner />);
    await waitFor(() => expect(server['member-a']?.has('install')).toBe(true));
    await waitFor(() => expect(window.localStorage.getItem('menrush_prompt_legacy_synced')).toBe('1'));
  });
});
