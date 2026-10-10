import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VenueCalendarModal } from './VenueCalendarModal';
import { hotSpotsAPI, HotSpotDTO } from '../api/client';

vi.mock('../api/client', () => ({
  hotSpotsAPI: {
    listVenueEvents: vi.fn(),
    createVenueEvent: vi.fn(),
    cancelVenueEvent: vi.fn(),
  },
}));

const mockSpot: HotSpotDTO = {
  id: 'spot-tropics-1',
  name: 'Tropics Day Spa',
  city: 'Portsmouth',
  description: 'Portsmouth sauna',
  latitude: 50.8035933,
  longitude: -1.0881303,
  category_id: 4,
  category_slug: 'saunas',
  category_name: 'Saunas & spas',
  category_icon: '🧖',
  distance_km: 1.2,
  live_count: 5,
  live_count_exact: 5,
  is_checked_in: false,
  my_checkin_anonymous: null,
  venue_type: 'sauna',
  claim_status: 'approved',
  is_calendar_managed: true,
  can_manage_calendar: true,
};

const mockEvent = {
  id: 'evt-1',
  spot_id: mockSpot.id,
  venue_claim_id: 'claim-1',
  name: 'Tropics Afternoon Steam',
  description: 'Weekly afternoon steam session',
  venue_name: 'Tropics Day Spa',
  starts_at: new Date(Date.now() + 3600000 * 24).toISOString(),
  ends_at: null,
  lat: 50.8035933,
  lng: -1.0881303,
  status: 'published' as const,
  is_venue_managed: true,
  cancelled_at: null,
  cancellation_reason: null,
  ticket_url: null,
  member_count: 5,
  distance_m: null,
  is_live: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  managed_label: 'Calendar managed by venue' as const,
};

describe('VenueCalendarModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (hotSpotsAPI.listVenueEvents as any).mockResolvedValue({
      data: {
        events: [mockEvent],
        venue_name: mockSpot.name,
        is_claimed: true,
        can_manage: true,
        managed_label: 'Calendar managed by venue',
      },
    });
  });

  it('renders quiet face badges: "Venue claimed" and "Calendar managed by venue"', async () => {
    render(
      <VenueCalendarModal
        spot={mockSpot}
        open={true}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Tropics Afternoon Steam')).toBeInTheDocument();
    expect(screen.getByText('Venue claimed')).toBeInTheDocument();
    expect(screen.getByText('Calendar managed by venue')).toBeInTheDocument();
    expect(screen.getByText(/Venue submissions are UGC/i)).toBeInTheDocument();

    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toMatch(/Verified Business/i);
    expect(bodyText).not.toMatch(/Official Partner/i);
    expect(bodyText).not.toMatch(/Sponsored/i);
  });

  it('allows manager to create a new event', async () => {
    const user = userEvent.setup();
    (hotSpotsAPI.createVenueEvent as any).mockResolvedValue({
      data: {
        ok: true,
        event: { ...mockEvent, id: 'evt-2', name: 'Tropics Night' },
      },
    });

    render(
      <VenueCalendarModal
        spot={mockSpot}
        open={true}
        onClose={vi.fn()}
      />,
    );

    const addBtn = await screen.findByRole('button', { name: /\+ Add Schedule Event/i });
    await user.click(addBtn);

    const nameInput = screen.getByPlaceholderText(/Sunday Bear Session/i);
    await user.type(nameInput, 'Tropics Night');

    const dateInputs = screen.getAllByDisplayValue('');
    const startsAtInput = document.querySelector('input[type="datetime-local"]') as HTMLInputElement;
    expect(startsAtInput).toBeInTheDocument();
  });
});
