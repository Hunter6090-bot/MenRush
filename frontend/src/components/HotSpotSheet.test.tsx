import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { HotSpotDTO } from '../api/client';
import { HotSpotSheet } from './HotSpotSheet';

const mockSpot: HotSpotDTO = {
  id: 'spot-hogs-back',
  name: 'A31 Hog’s Back Rest Lay-by',
  city: 'Guildford',
  description: 'Car park',
  latitude: 51.2260632,
  longitude: -0.6727582,
  category_id: 3,
  category_slug: 'parking',
  category_name: 'Parking',
  category_icon: '🅿️',
  distance_km: 4.2,
  live_count: '—',
  live_count_exact: 0,
  is_checked_in: false,
  my_checkin_anonymous: null,
  checkin_ttl_hours: 2,
  has_active_checkins: false,
  rating_avg: 4.5,
  review_count: 3,
};

describe('HotSpotSheet', () => {
  it('renders spot sheet with quiet face, directions link, and reviews button', () => {
    const onOpenReviews = vi.fn();
    render(
      <MemoryRouter>
        <HotSpotSheet
          spot={mockSpot}
          isPremium={false}
          acting={false}
          error=""
          onClose={vi.fn()}
          onCheckIn={vi.fn()}
          onOpenReviews={onOpenReviews}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('hotspot-sheet')).toBeInTheDocument();
    expect(screen.getByText('A31 Hog’s Back Rest Lay-by')).toBeInTheDocument();
    expect(screen.getByTestId('hotspot-sheet-brand-face')).toBeInTheDocument();

    const dirLink = screen.getByTestId('hotspot-sheet-directions');
    expect(dirLink).toBeInTheDocument();
    expect(dirLink.getAttribute('href')).toContain('51.2260632');
    expect(dirLink.getAttribute('href')).toContain('-0.6727582');

    const revBtn = screen.getByTestId('hotspot-sheet-reviews-btn');
    expect(revBtn).toBeInTheDocument();
    expect(revBtn).toHaveTextContent('3');
    fireEvent.click(revBtn);
    expect(onOpenReviews).toHaveBeenCalledWith(mockSpot);
  });

  it('triggers check-in anonymously when requested', () => {
    const onCheckIn = vi.fn();
    render(
      <MemoryRouter>
        <HotSpotSheet
          spot={mockSpot}
          isPremium={false}
          acting={false}
          error=""
          onClose={vi.fn()}
          onCheckIn={onCheckIn}
        />
      </MemoryRouter>,
    );

    const checkInAnon = screen.getByTestId('hotspot-sheet-checkin-anon');
    fireEvent.click(checkInAnon);
    expect(onCheckIn).toHaveBeenCalledWith(mockSpot, true);
  });
});
