import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { PushAlertBanner, HOME_SCREEN_CARD_NEVER_KEY } from './PushAlertBanner';
import { useAuthStore } from '../hooks/store';
import { promptNeverKey } from '../lib/promptDismissal';

vi.mock('../lib/push', () => ({
  isPushConfigured: vi.fn().mockResolvedValue(true),
  iosNeedsHomeScreenForPush: vi.fn().mockReturnValue(true),
  isStandalonePwa: vi.fn().mockReturnValue(false),
  getPushSupport: vi.fn().mockReturnValue('default'),
  enablePushNotifications: vi.fn(),
}));

/**
 * Add MenRush to Home Screen card. Pete (8 Oct 2026) asked for a tick box plus
 * Close instead of Later; Al (10 Oct 2026) made it per member on every phone.
 */
describe('Add MenRush to Home Screen card', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    useAuthStore.setState({ user: { id: 'member-a', name: 'Member' } as never, token: 't' });
  });

  it("shows a Don't remind me again tick box and Close, no Later", async () => {
    render(<PushAlertBanner />);
    expect(await screen.findByText('Add MenRush to Home Screen')).toBeInTheDocument();
    expect(screen.getByTestId('install-prompt-never')).not.toBeChecked();
    expect(screen.getByTestId('install-prompt-close')).toBeInTheDocument();
    expect(screen.queryByText('Later')).not.toBeInTheDocument();
  });

  it('ticked never shows again for this member, even after a reload', async () => {
    render(<PushAlertBanner />);
    fireEvent.click(await screen.findByTestId('install-prompt-never'));
    fireEvent.click(screen.getByTestId('install-prompt-close'));
    expect(screen.queryByTestId('push-alert-banner')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(promptNeverKey('install', 'member-a'))).toBe('1');
    // The old device-wide key is not written any more.
    expect(window.localStorage.getItem(HOME_SCREEN_CARD_NEVER_KEY)).toBeNull();

    cleanup();
    window.sessionStorage.clear();
    render(<PushAlertBanner />);
    await act(async () => {});
    expect(screen.queryByTestId('push-alert-banner')).not.toBeInTheDocument();
  });

  it("someone who ticked the redesign's Don't show again stays dismissed", async () => {
    window.localStorage.setItem(HOME_SCREEN_CARD_NEVER_KEY, '1');
    render(<PushAlertBanner />);
    await act(async () => {});
    expect(screen.queryByTestId('push-alert-banner')).not.toBeInTheDocument();
  });

  it('unticked Close hides it for this session and it comes back next session', async () => {
    render(<PushAlertBanner />);
    fireEvent.click(await screen.findByTestId('install-prompt-close'));
    expect(screen.queryByTestId('push-alert-banner')).not.toBeInTheDocument();

    cleanup();
    render(<PushAlertBanner />);
    await act(async () => {});
    expect(screen.queryByTestId('push-alert-banner')).not.toBeInTheDocument();

    cleanup();
    window.sessionStorage.clear();
    render(<PushAlertBanner />);
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
  });
});
