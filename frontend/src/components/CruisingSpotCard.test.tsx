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
