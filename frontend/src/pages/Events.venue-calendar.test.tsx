import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const locationState = { lat: 50.8036 as number | null, lng: -1.0881 as number | null };

vi.mock('../hooks/store', () => ({
  useLocationStore: () => locationState,
  useAuthStore: (sel: (s: { user: { is_premium: boolean } | null }) => unknown) =>
    sel({ user: { is_premium: false } }),
}));

vi.mock('../lib/betaInvite', () => ({
  isBetaPremiumFree: () => false,
}));

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const TROPICS_EVENT = {
  id: 'evt-tropics-1',
  name: 'Tropics Sunday Bear Session',
  description: 'Afternoon steam & sauna session in Portsmouth',
  avatar_url: null,
  created_by: 'claimant-1',
  starts_at: new Date().toISOString(),
  ends_at: null,
  venue_name: 'Tropics Day Spa',
  lat: 50.8035933,
  lng: -1.0881303,
  member_count: 8,
  distance_m: 200,
  is_live: true,
  is_venue_managed: true,
  managed_label: 'Calendar managed by venue',
  status: 'published',
};

describe('Events venue calendar quiet face', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationState.lat = 50.8036;
    locationState.lng = -1.0881;
    getNearby.mockResolvedValue({ data: [TROPICS_EVENT] });
  });

  it('renders venue-managed events with strict quiet face copy', async () => {
    render(
      <MemoryRouter>
        <Events />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Tropics Sunday Bear Session')).toBeInTheDocument();
    expect(screen.getByText('Venue claimed')).toBeInTheDocument();
    expect(screen.getByText('Calendar managed by venue')).toBeInTheDocument();
    expect(screen.getByText(/Venue event submission \(UGC\)/i)).toBeInTheDocument();

    // STRICT LOCK: Never "Verified Business", "Partner", "Sponsored", "Endorsed"
    const containerText = document.body.textContent || '';
    expect(containerText).not.toMatch(/Verified Business/i);
    expect(containerText).not.toMatch(/Official Partner/i);
    expect(containerText).not.toMatch(/Sponsored/i);
    expect(containerText).not.toMatch(/Endorsed/i);
  });
});
