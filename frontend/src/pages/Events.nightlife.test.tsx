import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Events } from '../pages/Events';

const checkIn = vi.fn();
const getNearby = vi.fn();

vi.mock('../api/client', () => ({
  eventsAPI: {
    getNearby: (...args: unknown[]) => getNearby(...args),
    checkIn: (...args: unknown[]) => checkIn(...args),
  },
}));

vi.mock('../hooks/store', () => ({
  useLocationStore: () => ({ lat: 51.5074, lng: -0.1278 }),
  useAuthStore: (sel: (s: { user: { is_premium: boolean } | null }) => unknown) =>
    sel({ user: { is_premium: false } }),
}));

vi.mock('../lib/betaInvite', () => ({
  isBetaPremiumFree: () => false,
}));

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const SAMPLE_EVENT = {
  id: 'evt-uk-1',
  name: 'Copper Night',
  description: 'UK nightclub night',
  avatar_url: null,
  created_by: 'u1',
  starts_at: new Date().toISOString(),
  ends_at: null,
  venue_name: 'The Copper Bar',
  lat: 51.51,
  lng: -0.13,
  member_count: 12,
  distance_m: 400,
  is_live: true,
};

describe('Events nightlife check-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getNearby.mockResolvedValue({ data: [SAMPLE_EVENT] });
    checkIn.mockResolvedValue({
      data: {
        ok: true,
        spot: {
          id: 'spot-1',
          name: 'The Copper Bar',
          live_count: 1,
          live_count_exact: 1,
          checkin_ttl_hours: 4,
          has_active_checkins: true,
        },
      },
    });
  });

  it('gates Promote Your Event behind Premium for free users', async () => {
    render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>,
    );

    const promote = await screen.findByTestId('promote-event');
    expect(promote).toHaveAttribute('href', '/premium');
    expect(promote).toHaveTextContent(/PREMIUM/i);
  });

  it('lets free users check in from an event card', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>,
    );

    const btn = await screen.findByTestId('event-checkin-evt-uk-1');
    await user.click(btn);

    await waitFor(() => {
      expect(checkIn).toHaveBeenCalledWith('evt-uk-1');
    });
    expect(await screen.findByTestId('event-checkin-notice')).toHaveTextContent(/4 hours/i);
  });
});
