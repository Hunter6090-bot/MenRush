import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { HotSpotDTO } from '../api/client';
import { CruisingSpotCard } from './CruisingSpotCard';
import { CruisingSearchBar } from './CruisingSearchBar';

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
  checkin_ttl_hours: 4,
  has_active_checkins: false,
};

describe('CruisingSpotCard', () => {
  it('renders spot name, category, distance, and honest activity placeholder', () => {
    render(<CruisingSpotCard spot={mockSpot} />);

    expect(screen.getByTestId('cruising-spot-name')).toHaveTextContent('A31 Hog’s Back Rest Lay-by');
    expect(screen.getByTestId('cruising-category-badge')).toHaveTextContent('Layby');
    // In UK locale formatDistanceFromKm converts km to miles (2.6 mi)
    expect(screen.getByTestId('cruising-distance')).toHaveTextContent(/2\.6\s*mi|4\.2\s*km/);
    expect(screen.getByTestId('cruising-last-active')).toHaveTextContent('No recent check-ins');
  });

  it('honestly displays "No recent check-ins" when last_activity_at is null with zero check-ins (Wisley and Hog’s Back)', () => {
    const wisleySpot: HotSpotDTO = {
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
      checkin_ttl_hours: 4,
      has_active_checkins: false,
      last_activity_at: null,
    };

    render(<CruisingSpotCard spot={wisleySpot} />);

    const lastActiveElem = screen.getByTestId('cruising-last-active');
    expect(lastActiveElem).toHaveTextContent('No recent check-ins');
    expect(lastActiveElem).not.toHaveTextContent(/Active\s+\d+m\s+ago/i);
    expect(lastActiveElem).not.toHaveTextContent(/Active\s+now/i);

    // Indicator dot must remain muted, not active green
    const dot = lastActiveElem.querySelector('span[aria-hidden="true"]');
    expect(dot).toHaveClass('bg-[rgba(240,224,192,0.35)]');
    expect(dot).not.toHaveClass('bg-[#3D7A2E]');
  });

  it('provides a working "Get directions" link to maps with correct coordinates', () => {
    render(<CruisingSpotCard spot={mockSpot} />);

    const directionsLink = screen.getByTestId('cruising-get-directions');
    expect(directionsLink).toBeInTheDocument();
    const href = directionsLink.getAttribute('href');
    expect(href).toContain('51.2260632');
    expect(href).toContain('-0.6727582');
  });

  it('renders map thumbnail element for the spot', () => {
    render(<CruisingSpotCard spot={mockSpot} />);
    expect(screen.getByTestId('cruising-map-thumbnail')).toBeInTheDocument();
  });

  it('calls onSelect when "View on map" is clicked', () => {
    const onSelect = vi.fn();
    render(<CruisingSpotCard spot={mockSpot} onSelect={onSelect} />);

    const viewBtn = screen.getByTestId('cruising-view-on-map');
    fireEvent.click(viewBtn);
    expect(onSelect).toHaveBeenCalledWith(mockSpot);
  });

  it('renders a commercial sauna spot with Sauna category badge and icon', () => {
    const saunaSpot: HotSpotDTO = {
      id: 'spot-sweatbox',
      name: 'Sweatbox Sauna',
      city: 'London',
      description: 'Central London sauna & wellness',
      latitude: 51.5132,
      longitude: -0.1391,
      category_id: 4,
      category_slug: 'saunas',
      category_name: 'Saunas & spas',
      category_icon: '🧖',
      distance_km: 1.2,
      live_count: '—',
      live_count_exact: 0,
      is_checked_in: false,
      my_checkin_anonymous: null,
      checkin_ttl_hours: 4,
      has_active_checkins: false,
    };

    render(<CruisingSpotCard spot={saunaSpot} />);

    expect(screen.getByTestId('cruising-spot-name')).toHaveTextContent('Sweatbox Sauna');
    expect(screen.getByTestId('cruising-category-badge')).toHaveTextContent('Sauna');
    expect(screen.getByTestId('cruising-category-badge')).toHaveTextContent('🧖');
  });

  it('provides an anonymous check-in button and triggers onCheckIn with anonymous=true', () => {
    const onCheckIn = vi.fn();
    render(<CruisingSpotCard spot={mockSpot} onCheckIn={onCheckIn} />);

    const checkInBtn = screen.getByTestId(`cruising-checkin-anon-${mockSpot.id}`);
    expect(checkInBtn).toHaveTextContent('Check in anonymously');
    fireEvent.click(checkInBtn);
    expect(onCheckIn).toHaveBeenCalledWith(mockSpot, true);
  });

  it('shows "Checked in (Leave)" when user is already checked in and allows checking out', () => {
    const onCheckIn = vi.fn();
    const checkedInSpot: HotSpotDTO = {
      ...mockSpot,
      is_checked_in: true,
      my_checkin_anonymous: true,
      has_active_checkins: true,
      live_count_exact: 1,
    };
    render(<CruisingSpotCard spot={checkedInSpot} onCheckIn={onCheckIn} />);

    const checkOutBtn = screen.getByTestId(`cruising-checkout-${mockSpot.id}`);
    expect(checkOutBtn).toHaveTextContent(/Checked in/i);
    fireEvent.click(checkOutBtn);
    expect(onCheckIn).toHaveBeenCalledWith(checkedInSpot, false);
  });

  it('renders reviews button and triggers onOpenReviews', () => {
    const onOpenReviews = vi.fn();
    const ratedSpot: HotSpotDTO = {
      ...mockSpot,
      rating_avg: 4.8,
      review_count: 5,
    };
    render(<CruisingSpotCard spot={ratedSpot} onOpenReviews={onOpenReviews} />);

    expect(screen.getByTestId('cruising-card-rating')).toHaveTextContent('★ 4.8');
    const reviewsBtn = screen.getByTestId(`cruising-reviews-btn-${mockSpot.id}`);
    expect(reviewsBtn).toHaveTextContent('Reviews');
    expect(reviewsBtn).toHaveTextContent('5');
    fireEvent.click(reviewsBtn);
    expect(onOpenReviews).toHaveBeenCalledWith(ratedSpot);
  });
  });
});

describe('CruisingSearchBar', () => {
  it('triggers onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(<CruisingSearchBar onOpen={onOpen} />);

    const bar = screen.getByTestId('cruising-search-bar');
    fireEvent.click(bar);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
