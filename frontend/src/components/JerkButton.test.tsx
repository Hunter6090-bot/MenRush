import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { JerkButton } from './JerkButton';
import { usersAPI } from '../api/client';
import { trackEvent } from '../observability/analytics';
import { JERK_SENT_TOAST, JERK_TOAST_MS } from '../lib/jerk';

vi.mock('../hooks/store', () => {
  const authState = { user: { id: 'me-id', name: 'Me' } };
  const authStore = (sel?: any) => (typeof sel === 'function' ? sel(authState) : authState);
  authStore.getState = () => authState;
  return { useAuthStore: authStore };
});

vi.mock('../api/client', () => ({
  usersAPI: {
    jerkUser: vi.fn(),
    likeUser: vi.fn(),
  },
}));

vi.mock('../observability/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('JerkButton', () => {
  beforeEach(() => {
    vi.mocked(usersAPI.jerkUser).mockReset();
    vi.mocked(usersAPI.likeUser).mockReset();
    vi.mocked(trackEvent).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('one tap sends a jerk (not a like), shows "Sent 😏" briefly and tracks jerk_sent', async () => {
    vi.mocked(usersAPI.jerkUser).mockResolvedValueOnce({
      data: { status: 'sent', jerk_id: 'j1', sent_today: 1, daily_limit: 20 },
    } as any);
    const onSent = vi.fn();
    render(<JerkButton userId="other-1" name="Dan" surface="profile" onSent={onSent} />);

    const btn = screen.getByTestId('jerk-button-profile');
    expect(btn).toHaveTextContent('Jerk');
    expect(btn).toHaveAttribute('aria-label', 'Jerk Dan');
    fireEvent.click(btn);

    await waitFor(() => expect(screen.getByTestId('jerk-toast')).toHaveTextContent(JERK_SENT_TOAST));
    expect(JERK_SENT_TOAST).toBe('Sent 😏');
    expect(usersAPI.jerkUser).toHaveBeenCalledTimes(1);
    expect(usersAPI.jerkUser).toHaveBeenCalledWith('other-1');
    expect(usersAPI.likeUser).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('jerk_sent', { surface: 'profile', repeat: false });
    expect(onSent).toHaveBeenCalled();
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('data-jerk-state', 'sent');

    // A second tap does nothing.
    fireEvent.click(btn);
    expect(usersAPI.jerkUser).toHaveBeenCalledTimes(1);
  });

  it('toast clears after a short time', async () => {
    vi.useFakeTimers();
    vi.mocked(usersAPI.jerkUser).mockResolvedValueOnce({
      data: { status: 'repeat', jerk_id: 'j1', sent_today: 1, daily_limit: 20 },
    } as any);
    render(<JerkButton userId="other-1" name="Dan" surface="grid" variant="icon" />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('jerk-button-grid'));
    });
    expect(screen.getByTestId('jerk-toast')).toHaveTextContent('Sent 😏');
    expect(trackEvent).toHaveBeenCalledWith('jerk_sent', { surface: 'grid', repeat: true });
    await act(async () => {
      vi.advanceTimersByTime(JERK_TOAST_MS + 50);
    });
    expect(screen.queryByTestId('jerk-toast')).toBeNull();
  });

  it('icon variant has no extra wording', () => {
    render(<JerkButton userId="other-1" name="Dan" surface="grid" variant="icon" />);
    const btn = screen.getByTestId('jerk-button-grid');
    expect(btn.textContent).toBe('');
    expect(btn).toHaveAttribute('aria-label', 'Jerk Dan');
  });

  it('daily limit 429 shows the friendly message and stays tappable', async () => {
    vi.mocked(usersAPI.jerkUser).mockRejectedValueOnce({
      response: {
        status: 429,
        data: { error: 'Daily limit reached. Back tomorrow.', code: 'jerk_daily_limit' },
      },
    });
    render(<JerkButton userId="other-1" name="Dan" surface="pin_sheet" />);
    const btn = screen.getByTestId('jerk-button-pin_sheet');
    fireEvent.click(btn);
    await waitFor(() =>
      expect(screen.getByTestId('jerk-toast')).toHaveTextContent('Daily limit reached. Back tomorrow.'),
    );
    expect(btn).not.toBeDisabled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('blocked or hidden target shows a neutral message', async () => {
    vi.mocked(usersAPI.jerkUser).mockRejectedValueOnce({
      response: { status: 404, data: { error: 'User unavailable', code: 'target_unavailable' } },
    });
    render(<JerkButton userId="other-1" name="Dan" surface="chat" />);
    fireEvent.click(screen.getByTestId('jerk-button-chat'));
    await waitFor(() => expect(screen.getByTestId('jerk-toast')).toHaveTextContent('Not available.'));
  });

  it('never renders for yourself', () => {
    render(<JerkButton userId="me-id" name="Me" surface="profile" />);
    expect(screen.queryByTestId('jerk-button-profile')).toBeNull();
  });
});
