import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PushAlertBanner } from './PushAlertBanner';
import { useAuthStore } from '../hooks/store';
import * as push from '../lib/push';

vi.mock('../lib/push', () => ({
  enablePushNotifications: vi.fn().mockResolvedValue('default'),
  getPushSupport: vi.fn(() => 'default'),
  iosNeedsHomeScreenForPush: vi.fn(() => false),
  isPushConfigured: vi.fn().mockResolvedValue(true),
  isStandalonePwa: vi.fn(() => false),
  registerServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

function signIn(id: string) {
  useAuthStore.setState({ user: { id, name: 'Member' } as never, token: 't' });
}

/** A reload or a new session: fresh mount, sessionStorage gone, localStorage kept. */
function newSession() {
  window.sessionStorage.clear();
}

async function tickAndClose(user: ReturnType<typeof userEvent.setup>, prefix: string) {
  await user.click(screen.getByLabelText("Don't remind me again"));
  await user.click(screen.getByTestId(`${prefix}-close`));
}

const variants = [
  {
    name: 'Turn on alerts (Android Chrome, Samsung, desktop, installed app)',
    ios: false,
    standalone: false,
    title: 'Turn on alerts',
    prefix: 'alerts-prompt',
  },
  {
    name: 'Turn on alerts inside the installed app',
    ios: false,
    standalone: true,
    title: 'Turn on alerts',
    prefix: 'alerts-prompt',
  },
  {
    name: 'Add MenRush to Home Screen (iPhone Safari)',
    ios: true,
    standalone: false,
    title: 'Add MenRush to Home Screen',
    prefix: 'install-prompt',
  },
];

describe("PushAlertBanner: Don't remind me again", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.mocked(push.getPushSupport).mockReturnValue('default');
    vi.mocked(push.iosNeedsHomeScreenForPush).mockReturnValue(false);
    vi.mocked(push.isStandalonePwa).mockReturnValue(false);
    signIn('member-a');
  });

  for (const v of variants) {
    it(`${v.name}: ticked stays gone after remount, reload and a new session`, async () => {
      vi.mocked(push.iosNeedsHomeScreenForPush).mockReturnValue(v.ios);
      vi.mocked(push.isStandalonePwa).mockReturnValue(v.standalone);
      const user = userEvent.setup();

      const first = render(<PushAlertBanner />);
      expect(await screen.findByText(v.title)).toBeInTheDocument();
      expect(screen.queryByText('Later')).toBeNull();
      await tickAndClose(user, v.prefix);
      expect(screen.queryByTestId('push-alert-banner')).toBeNull();
      first.unmount();

      // Remount (navigation).
      const second = render(<PushAlertBanner />);
      await act(async () => {});
      expect(screen.queryByTestId('push-alert-banner')).toBeNull();
      second.unmount();

      // Reload and new session.
      newSession();
      render(<PushAlertBanner />);
      await act(async () => {});
      expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    });
  }

  it('Close without the tick comes back next session', async () => {
    const user = userEvent.setup();
    const first = render(<PushAlertBanner />);
    await screen.findByText('Turn on alerts');
    await user.click(screen.getByTestId('alerts-prompt-close'));
    first.unmount();

    const second = render(<PushAlertBanner />);
    await act(async () => {});
    expect(screen.queryByTestId('push-alert-banner')).toBeNull();
    second.unmount();

    newSession();
    render(<PushAlertBanner />);
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
  });

  it('the choice belongs to the member who made it', async () => {
    const user = userEvent.setup();
    const first = render(<PushAlertBanner />);
    await screen.findByText('Turn on alerts');
    await tickAndClose(user, 'alerts-prompt');
    first.unmount();

    newSession();
    signIn('member-b');
    render(<PushAlertBanner />);
    expect(await screen.findByText('Turn on alerts')).toBeInTheDocument();
  });

  it('tick and Close are at least 44px tall and 15px text', async () => {
    render(<PushAlertBanner />);
    await screen.findByText('Turn on alerts');
    const label = screen.getByTestId('alerts-prompt-never-label');
    const close = screen.getByTestId('alerts-prompt-close');
    expect(label.className).toContain('min-h-[44px]');
    expect(label.className).toContain('text-[15px]');
    expect(close.className).toContain('min-h-[44px]');
    expect(close.className).toContain('text-[15px]');
    await waitFor(() => expect(screen.getByTestId('push-alert-banner-enable')).toBeInTheDocument());
  });
});
