import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PushAlertBanner } from '../components/PushAlertBanner';
import { InstallPrompt } from '../components/InstallPrompt';
import { ProfileDepthStrip } from '../components/ProfileDepthStrip';
import { promptPrefsAPI, usersAPI } from '../api/client';
import { useAuthStore } from '../hooks/store';
import { promptNeverKey, resetPromptPrefsSyncForTests } from './promptDismissal';
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

describe("Don't remind me again follows the member across devices", () => {
  it('Turn on alerts: ticked on device A is hidden on device B', async () => {
    const user = userEvent.setup();
    const a = render(<PushAlertBanner />);
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
    await user.click(screen.getByLabelText("Don't remind me again"));
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
    await user.click(screen.getByLabelText("Don't remind me again"));
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
