import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CruisingSearchSheet } from './CruisingSearchSheet';
import { hotSpotsAPI, type HotSpotDTO } from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<any>('../api/client');
  return {
    ...actual,
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      searchCruising: vi.fn(),
    },
  };
});

const mockCruisingSpots: HotSpotDTO[] = [
  {
    id: 'spot-ockham',
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
  },
  {
    id: 'spot-hogs-back',
    name: 'A31 Hog’s Back Rest Lay-by',
    city: 'Guildford',
    description: 'Car park',
    latitude: 51.2260632,
    longitude: -0.6727582,
    category_id: 2,
    category_slug: 'parking',
    category_name: 'Parking',
    category_icon: '🅿️',
    distance_km: 8.4,
    live_count: '—',
    live_count_exact: 0,
    is_checked_in: false,
    my_checkin_anonymous: null,
  },
  {
    id: 'spot-invalid',
    name: 'Ghost Spot Without Coords',
    city: 'Nowhere',
    description: 'Should not appear',
    latitude: 0,
    longitude: 0,
    category_id: 1,
    category_slug: 'parks-trails',
    category_name: 'Parks & Trails',
    category_icon: '🌲',
    distance_km: null,
    live_count: '—',
    live_count_exact: 0,
    is_checked_in: false,
    my_checkin_anonymous: null,
  },
];

describe('CruisingSearchSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hotSpotsAPI.searchCruising).mockResolvedValue({
      data: { spots: mockCruisingSpots },
    } as any);
  });

  it('renders list of nearby spots closest first, filtering out spots without real coords', async () => {
    render(
      <CruisingSearchSheet
        open={true}
        onClose={vi.fn()}
        lat={51.3}
        lng={-0.5}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('cruising-spot-card-spot-ockham')).toBeInTheDocument();
      expect(screen.getByTestId('cruising-spot-card-spot-hogs-back')).toBeInTheDocument();
    });

    // Ghost Spot Without Coords has lat=0, lng=0 -> must be excluded
    expect(screen.queryByTestId('cruising-spot-card-spot-invalid')).not.toBeInTheDocument();

    // Verify ordering: Ockham Common (1.5 km) appears before Hog's Back (8.4 km)
    const cards = screen.getAllByTestId(/cruising-spot-card-/);
    expect(cards[0]).toHaveAttribute('data-testid', 'cruising-spot-card-spot-ockham');
    expect(cards[1]).toHaveAttribute('data-testid', 'cruising-spot-card-spot-hogs-back');
  });

  it('allows filtering by category (e.g. Layby or Woods)', async () => {
    render(
      <CruisingSearchSheet
        open={true}
        onClose={vi.fn()}
        lat={51.3}
        lng={-0.5}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('cruising-spot-card-spot-ockham')).toBeInTheDocument();
    });

    // Click "Layby" tab
    const laybyTab = screen.getByRole('tab', { name: /Layby/i });
    fireEvent.click(laybyTab);

    // Ockham Common is "Woods", so it should be filtered out; Hog's Back is "Layby", so it remains
    expect(screen.queryByTestId('cruising-spot-card-spot-ockham')).not.toBeInTheDocument();
    expect(screen.getByTestId('cruising-spot-card-spot-hogs-back')).toBeInTheDocument();
  });

  it('allows text searching in the search bar', async () => {
    render(
      <CruisingSearchSheet
        open={true}
        onClose={vi.fn()}
        lat={51.3}
        lng={-0.5}
      />,
    );

    const input = screen.getByTestId('cruising-search-input');
    fireEvent.change(input, { target: { value: 'Hog’s Back' } });

    await waitFor(() => {
      expect(hotSpotsAPI.searchCruising).toHaveBeenCalledWith(51.3, -0.5, 'Hog’s Back');
    });
  });

  it('invokes onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <CruisingSearchSheet
        open={true}
        onClose={onClose}
        lat={51.3}
        lng={-0.5}
      />,
    );

    const closeBtn = screen.getByTestId('cruising-search-close');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
