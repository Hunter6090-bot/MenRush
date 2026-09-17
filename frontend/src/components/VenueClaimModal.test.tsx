import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VenueClaimModal, LEGAL_ATTESTATION_STATEMENT } from './VenueClaimModal';
import { hotSpotsAPI, HotSpotDTO } from '../api/client';

vi.mock('../api/client', () => ({
  hotSpotsAPI: {
    submitClaim: vi.fn(),
  },
}));

const mockSpot: HotSpotDTO = {
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
  distance_km: 1.2,
  live_count: 5,
  live_count_exact: 5,
  is_checked_in: false,
  my_checkin_anonymous: null,
  venue_type: 'sauna',
  claim_status: 'unclaimed',
};

describe('VenueClaimModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with venue details and legal attestation', () => {
    render(
      <VenueClaimModal
        spot={mockSpot}
        open={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText('Claim Tropics Day Spa')).toBeInTheDocument();
    expect(screen.getByText(/Portsmouth/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(LEGAL_ATTESTATION_STATEMENT, 'i'))).toBeInTheDocument();

    const text = document.body.textContent || '';
    expect(text).not.toMatch(/Verified Business/i);
    expect(text).not.toMatch(/Partner/i);
    expect(text).not.toMatch(/Sponsored/i);
  });

  it('submits claim with legal attestation when form is valid', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    (hotSpotsAPI.submitClaim as any).mockResolvedValue({
      data: {
        ok: true,
        claim: {
          id: 'claim-1',
          spot_id: mockSpot.id,
          status: 'pending',
          venue_role: 'General Manager',
          contact_name: 'Alex Turner',
          contact_email: 'alex@tropicsdayspa.co.uk',
          attestation_agreed: true,
          attestation_text: LEGAL_ATTESTATION_STATEMENT,
        },
        message: 'Venue claim submitted for ops review.',
      },
    });

    render(
      <VenueClaimModal
        spot={mockSpot}
        open={true}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    const nameInput = screen.getByPlaceholderText(/Alex Turner/i);
    const emailInput = screen.getByPlaceholderText(/name@venue\.co\.uk/i);
    const checkbox = screen.getByRole('checkbox');
    const submitBtn = screen.getByRole('button', { name: /Submit Claim/i });

    await user.type(nameInput, 'Alex Turner');
    await user.type(emailInput, 'alex@tropicsdayspa.co.uk');
    await user.click(checkbox);
    await user.click(submitBtn);

    await waitFor(() => {
      expect(hotSpotsAPI.submitClaim).toHaveBeenCalledWith(mockSpot.id, {
        venue_role: 'General Manager',
        contact_name: 'Alex Turner',
        contact_email: 'alex@tropicsdayspa.co.uk',
        contact_phone: null,
        website_or_social_proof: null,
        attestation_agreed: true,
        attestation_text: LEGAL_ATTESTATION_STATEMENT,
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    expect(screen.getByText(/Venue claim submitted for ops review/i)).toBeInTheDocument();
  });
});
