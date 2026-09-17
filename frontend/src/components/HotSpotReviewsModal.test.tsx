import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HotSpotReviewsModal } from './HotSpotReviewsModal';
import { hotSpotsAPI, type HotSpotDTO, type HotSpotReviewDTO } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<any>('../api/client');
  return {
    ...actual,
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      listReviews: vi.fn(),
      submitReview: vi.fn(),
      deleteReview: vi.fn(),
    },
  };
});

const mockSpot: HotSpotDTO = {
  id: 'spot-wisley',
  name: 'Wisley (Ockham Common)',
  city: 'Wisley',
  description: 'Woodland',
  latitude: 51.3171538,
  longitude: -0.453855,
  category_id: 1,
  category_slug: 'parks-trails',
  category_name: 'Parks & Trails',
  category_icon: '🌲',
  distance_km: 1.5,
  live_count: '—',
  live_count_exact: 0,
  is_checked_in: false,
  my_checkin_anonymous: null,
  checkin_ttl_hours: 2,
  has_active_checkins: false,
};

const mockReviews: HotSpotReviewDTO[] = [
  {
    id: 'rev-1',
    spot_id: 'spot-wisley',
    user_id: 'user-1',
    rating: 5,
    body: 'Great discreet trails and woodland walks.',
    is_anonymous: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_name: 'Anonymous',
    author_photo_url: null,
    is_mine: true,
  },
  {
    id: 'rev-2',
    spot_id: 'spot-wisley',
    user_id: 'user-2',
    rating: 4,
    body: 'Quiet during late afternoon. Watch for mud after rain.',
    is_anonymous: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_name: 'Alex',
    author_photo_url: null,
    is_mine: false,
  },
];

describe('HotSpotReviewsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hotSpotsAPI.listReviews).mockResolvedValue({
      data: {
        reviews: mockReviews,
        rating_avg: 4.5,
        review_count: 2,
      },
    } as any);
  });

  it('renders reviews modal with average rating and existing reviews list', async () => {
    render(<HotSpotReviewsModal spot={mockSpot} open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('hotspot-reviews-modal')).toBeInTheDocument();
    expect(screen.getByText('Wisley (Ockham Common)')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('★ 4.5')).toBeInTheDocument();
      expect(screen.getByText(/2 reviews/i)).toBeInTheDocument();
      expect(screen.getByText('Great discreet trails and woodland walks.')).toBeInTheDocument();
      expect(screen.getByText('Quiet during late afternoon. Watch for mud after rain.')).toBeInTheDocument();
    });
  });

  it('allows opening write review form, picking 1-5 stars, and submitting', async () => {
    vi.mocked(hotSpotsAPI.submitReview).mockResolvedValue({
      data: {
        ok: true,
        review: {
          id: 'rev-new',
          spot_id: mockSpot.id,
          user_id: 'user-me',
          rating: 4,
          body: 'Good spot, very quiet.',
          is_anonymous: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          author_name: 'Anonymous',
          author_photo_url: null,
          is_mine: true,
        },
        spot: {
          ...mockSpot,
          rating_avg: 4.3,
          review_count: 3,
        },
      },
    } as any);

    const onSpotUpdated = vi.fn();
    render(
      <HotSpotReviewsModal
        spot={mockSpot}
        open={true}
        onClose={vi.fn()}
        onSpotUpdated={onSpotUpdated}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('write-review-btn')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByTestId('write-review-btn'));
    expect(screen.getByTestId('review-form')).toBeInTheDocument();

    // Select star 4
    fireEvent.click(screen.getByTestId('star-4'));

    // Fill in body text
    const textInput = screen.getByTestId('review-body-input');
    fireEvent.change(textInput, { target: { value: 'Good spot, very quiet.' } });

    // Ensure anonymous checkbox is present and checked by default
    const anonCheckbox = screen.getByTestId('review-anonymous-checkbox') as HTMLInputElement;
    expect(anonCheckbox.checked).toBe(true);

    // Submit
    fireEvent.click(screen.getByTestId('submit-review-btn'));

    await waitFor(() => {
      expect(hotSpotsAPI.submitReview).toHaveBeenCalledWith(
        mockSpot.id,
        4,
        'Good spot, very quiet.',
        true,
      );
      expect(onSpotUpdated).toHaveBeenCalled();
    });
  });

  it('allows user to delete their own review', async () => {
    vi.mocked(hotSpotsAPI.deleteReview).mockResolvedValue({
      data: {
        ok: true,
        spot: {
          ...mockSpot,
          rating_avg: 4.0,
          review_count: 1,
        },
      },
    } as any);

    render(<HotSpotReviewsModal spot={mockSpot} open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId('delete-review-rev-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-review-rev-1'));

    await waitFor(() => {
      expect(hotSpotsAPI.deleteReview).toHaveBeenCalledWith(mockSpot.id, 'rev-1');
    });
  });
});
