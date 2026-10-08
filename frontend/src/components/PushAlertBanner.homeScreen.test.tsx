import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PushAlertBanner, HOME_SCREEN_CARD_NEVER_KEY } from './PushAlertBanner';

vi.mock('../lib/push', () => ({
  isPushConfigured: vi.fn().mockResolvedValue(true),
  iosNeedsHomeScreenForPush: vi.fn().mockReturnValue(true),
  isStandalonePwa: vi.fn().mockReturnValue(false),
  getPushSupport: vi.fn().mockReturnValue('default'),
  enablePushNotifications: vi.fn(),
}));

const SNOOZE_KEY = 'menrush_push_banner_snooze_until';

/** Pete (8 Oct 2026): Later becomes a Don't show again tick box plus Close. */
describe('Add MenRush to Home Screen card', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('shows a Don\u2019t show again tick box and Close, no Later', async () => {
    render(<PushAlertBanner />);
    expect(await screen.findByText('Add MenRush to Home Screen')).toBeInTheDocument();
    expect(screen.getByTestId('home-screen-card-never')).not.toBeChecked();
    expect(screen.getByTestId('home-screen-card-close')).toBeInTheDocument();
    expect(screen.queryByText('Later')).not.toBeInTheDocument();
  });

  it('ticked never shows again, even after a reload', async () => {
    render(<PushAlertBanner />);
    fireEvent.click(await screen.findByTestId('home-screen-card-never'));
    expect(window.localStorage.getItem(HOME_SCREEN_CARD_NEVER_KEY)).toBe('1');
    expect(window.localStorage.getItem('menrush_install_prompt_dismissed')).toBe('1');
    fireEvent.click(screen.getByTestId('home-screen-card-close'));
    expect(screen.queryByTestId('push-alert-banner')).not.toBeInTheDocument();

    cleanup();
    // Even with an expired snooze it stays hidden.
    window.localStorage.setItem(SNOOZE_KEY, '1');
    render(<PushAlertBanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('push-alert-banner')).not.toBeInTheDocument();
  });

  it('unticked Close hides it for now and it can come back later', async () => {
    render(<PushAlertBanner />);
    fireEvent.click(await screen.findByTestId('home-screen-card-close'));
    expect(screen.queryByTestId('push-alert-banner')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(HOME_SCREEN_CARD_NEVER_KEY)).toBeNull();
    expect(Number(window.localStorage.getItem(SNOOZE_KEY))).toBeGreaterThan(Date.now());

    cleanup();
    render(<PushAlertBanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('push-alert-banner')).not.toBeInTheDocument();

    cleanup();
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now() - 1000));
    render(<PushAlertBanner />);
    expect(await screen.findByTestId('push-alert-banner')).toBeInTheDocument();
  });
});
