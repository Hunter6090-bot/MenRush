import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HotSpots } from '../pages/HotSpots';
import { hotSpotsAPI } from '../api/client';

vi.mock('../api/client', () => ({
  hotSpotsAPI: {
    listCategories: vi.fn(),
    listNearby: vi.fn(),
    getSpot: vi.fn(),
    submitClaim: vi.fn(),
    listVenueEvents: vi.fn(),
    getMyCheckIn: vi.fn(),
  },
}));

vi.mock('mapbox-gl', () => {
  return {
    default: {
      Map: vi.fn().mockImplementation(function () {
        return {
          on: vi.fn(),
          remove: vi.fn(),
          flyTo: vi.fn(),
          addControl: vi.fn(),
          setStyle: vi.fn(),
        };
      }),
      Marker: vi.fn().mockImplementation(function () {
        return {
          setLngLat: vi.fn().mockReturnThis(),
          addTo: vi.fn().mockReturnThis(),
          remove: vi.fn(),
        };
      }),
      AttributionControl: vi.fn().mockImplementation(function () {
        return {};
      }),
      NavigationControl: vi.fn().mockImplementation(function () {
        return {};
      }),
    },
  };
});

const locationState = { lat: 50.8036 as number | null, lng: -1.0881 as number | null };

vi.mock('../hooks/store', () => ({
  useLocationStore: () => locationState,
  useAuthStore: (sel: (s: { user: { is_premium: boolean } | null }) => unknown) =>
    sel({ user: { is_premium: false } }),
}));

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const TROPICS_SPOT = {
  id: 'spot-tropics-1',
  name: 'Tropics Day Spa',
  city: 'Portsmouth',
  description: 'Portsmouth commercial sauna & day spa',
  latitude: 50.8035933,
  longitude: -1.0881303,
  category_id: 4,
  category_slug: 'saunas',
  category_name: 'Saunas & spas',
  category_icon: '🧖',
  distance_km: 0.5,
  live_count: 5,
  live_count_exact: 5,
  is_checked_in: false,
  my_checkin_anonymous: null,
  venue_type: 'sauna',
  claim_status: 'unclaimed',
};

describe('HotSpots venue claim & calendar integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (hotSpotsAPI.listCategories as any).mockResolvedValue({
      data: {
        categories: [
          { id: 4, slug: 'saunas', name: 'Saunas & spas', icon: '🧖', description: 'Saunas' },
        ],
      },
    });
    (hotSpotsAPI.listNearby as any).mockResolvedValue({
      data: { spots: [TROPICS_SPOT] },
    });
    (hotSpotsAPI.getMyCheckIn as any).mockResolvedValue({ data: { check_in: null } });
  });

  it('renders commercial venue with Claim venue calendar action', async () => {
    render(
      <MemoryRouter>
        <HotSpots />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Tropics Day Spa')).toBeInTheDocument();
    const claimButton = screen.getByTestId(`claim-venue-${TROPICS_SPOT.id}`);
    expect(claimButton).toHaveTextContent(/Claim venue calendar/i);

    const venueCalendarBtn = screen.getByTestId(`venue-calendar-${TROPICS_SPOT.id}`);
    expect(venueCalendarBtn).toHaveTextContent(/Venue calendar/i);

    // Verify quiet face copy — never verified business
    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toMatch(/Verified Business/i);
    expect(bodyText).not.toMatch(/Official Partner/i);
    expect(bodyText).not.toMatch(/Sponsored/i);
  });

  it('opens VenueClaimModal when Claim venue calendar is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HotSpots />
      </MemoryRouter>,
    );

    const claimButton = await screen.findByTestId(`claim-venue-${TROPICS_SPOT.id}`);
    await user.click(claimButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Claim Tropics Day Spa')).toBeInTheDocument();
    expect(screen.getByText(/Legal Attestation/i)).toBeInTheDocument();
  });
});
