/**
 * After a check-in or check-out from the spot sheet, Out re-reads the list so the
 * sheet and cards show the server's count. No client +1 / -1 (#368: Ghost and hidden
 * members are never counted, so a client bump would be wrong for them).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out } from './Out';
import { hotSpotsAPI, type HotSpotDTO } from '../api/client';
import { useLocationStore } from '../hooks/store';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      listNearby: vi.fn(),
      listReviews: vi.fn().mockResolvedValue({ data: { reviews: [], rating_avg: null, review_count: 0 } }),
      checkIn: vi.fn(),
      checkOut: vi.fn(),
    },
    eventsAPI: { ...actual.eventsAPI, getNearby: vi.fn().mockResolvedValue({ data: [] }) },
  };
});

const spot: HotSpotDTO = {
  id: 'spot-tulle', name: 'Tullecombe', city: 'Chichester', description: 'Open space',
  latitude: 51.03, longitude: -0.85, category_id: 5, category_slug: 'open-spaces',
  category_name: 'Open spaces', category_icon: '🏞️', distance_km: 12, live_count: 2,
  live_count_exact: null, is_checked_in: false, my_checkin_anonymous: null,
  checkin_ttl_hours: 2, has_active_checkins: true,
};

const list = (s: HotSpotDTO) => ({ data: { spots: [s] } }) as never;

async function openSheet() {
  render(<MemoryRouter><Out /></MemoryRouter>);
  fireEvent.click(await screen.findByTestId(`out-spot-open-${spot.id}`));
  return screen.findByTestId('hotspot-sheet');
}

describe('Out list refreshes after a check-in from the spot sheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocationStore.setState({ lat: 51.0, lng: -0.8 });
  });

  it('check-in re-reads the list and shows the server count', async () => {
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(spot))
      .mockResolvedValueOnce(list({ ...spot, is_checked_in: true, live_count: 4 }));
    vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
      data: { ok: true, spot: { ...spot, is_checked_in: true, live_count: 3 } },
    } as never);
    await openSheet();
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('4 checked in'));
    expect(screen.getByTestId('hotspot-sheet-checkout')).toBeInTheDocument();
    // Quiet refresh: the list never fell back to the loading spinner, the sheet stayed open.
    expect(screen.getByTestId('hotspot-sheet')).toBeInTheDocument();
  });

  it('check-out re-reads the list too', async () => {
    const checkedIn = { ...spot, is_checked_in: true, live_count: 3 };
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(checkedIn))
      .mockResolvedValueOnce(list({ ...spot, live_count: 2 }));
    vi.mocked(hotSpotsAPI.checkOut).mockResolvedValue({ data: { ok: true, spot: null } } as never);
    await openSheet();
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkout'));
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('2 checked in'));
    expect(screen.getByTestId('hotspot-sheet-checkin')).toBeInTheDocument();
  });

  it('Ghost viewer: no client +1, the count stays at the server value', async () => {
    // Server leaves the Ghost viewer out: no spot in the reply, refreshed list still says 2.
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(spot))
      .mockResolvedValueOnce(list({ ...spot, is_checked_in: true, my_checkin_anonymous: true }));
    let resolveCheckIn: (v: unknown) => void = () => {};
    vi.mocked(hotSpotsAPI.checkIn).mockReturnValue(new Promise((r) => { resolveCheckIn = r; }) as never);
    await openSheet();
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin-anon'));
    resolveCheckIn({ data: { ok: true } });
    await waitFor(() => expect(hotSpotsAPI.listNearby).toHaveBeenCalledTimes(2));
    await screen.findByTestId('hotspot-sheet-checkout');
    expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('2 checked in');
    expect(screen.getByTestId('hotspot-sheet-activity')).not.toHaveTextContent('3 checked in');
  });

  it('a failed refresh keeps the server spot from the check-in reply', async () => {
    vi.mocked(hotSpotsAPI.listNearby)
      .mockResolvedValueOnce(list(spot))
      .mockRejectedValueOnce(new Error('offline'));
    vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
      data: { ok: true, spot: { ...spot, is_checked_in: true, live_count: 3 } },
    } as never);
    await openSheet();
    fireEvent.click(screen.getByTestId('hotspot-sheet-checkin'));
    await waitFor(() => expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('3 checked in'));
    expect(screen.queryByText('Check-in failed. Try again.')).toBeNull();
  });
});
