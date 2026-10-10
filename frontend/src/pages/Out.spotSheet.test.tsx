/**
 * Lose-nothing fix (Pete, 10 Oct 2026): tapping an Out spot card opens the spot
 * sheet with reviews, Check in, Check in anonymously, Directions and View on map.
 * The map pin opens the same HotSpotSheet (guarded below and in the e2e layers spec).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out } from './Out';
import { hotSpotsAPI, type HotSpotDTO } from '../api/client';
import { useLocationStore } from '../hooks/store';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const spot: HotSpotDTO = {
  id: 'spot-a31',
  name: 'A31 Lay-by NB (Froyle Park)',
  city: 'East Hampshire',
  description: 'Lay-by',
  latitude: 51.19,
  longitude: -0.88,
  category_id: 3,
  category_slug: 'parking',
  category_name: 'Parking areas',
  category_icon: '🅿️',
  distance_km: 5.6,
  live_count: 2,
  live_count_exact: null,
  is_checked_in: false,
  my_checkin_anonymous: null,
  checkin_ttl_hours: 2,
  has_active_checkins: true,
  rating_avg: 4,
  review_count: 1,
};

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      listNearby: vi.fn(),
      listReviews: vi.fn(),
      checkIn: vi.fn(),
      checkOut: vi.fn(),
    },
    eventsAPI: { ...actual.eventsAPI, getNearby: vi.fn().mockResolvedValue({ data: [] }) },
  };
});

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function renderOut() {
  return render(
    <MemoryRouter initialEntries={['/out']}>
      <Routes>
        <Route path="/out" element={<Out />} />
        <Route path="/discover" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Out spot card opens the spot sheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocationStore.setState({ lat: 51.2, lng: -0.9 });
    vi.mocked(hotSpotsAPI.listNearby).mockResolvedValue({ data: { spots: [spot] } } as never);
    vi.mocked(hotSpotsAPI.listReviews).mockResolvedValue({
      data: {
        reviews: [
          {
            id: 'r1', spot_id: spot.id, user_id: 'u1', rating: 4, body: 'Quiet after dark.',
            is_anonymous: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            author_name: 'Anonymous', author_photo_url: null, is_mine: false,
          },
        ],
        rating_avg: 4,
        review_count: 1,
      },
    } as never);
    vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({
      data: { ok: true, spot: { ...spot, is_checked_in: true, my_checkin_anonymous: true, live_count: 3 } },
    } as never);
  });

  it('tapping the card shows name, type, distance, reviews, check in, anonymous check in, directions and map', async () => {
    renderOut();
    const open = await screen.findByTestId(`out-spot-open-${spot.id}`);
    expect(screen.queryByTestId('hotspot-sheet')).toBeNull();
    fireEvent.click(open);

    const sheet = await screen.findByTestId('hotspot-sheet');
    const q = within(sheet);
    expect(q.getByRole('heading', { name: spot.name })).toBeInTheDocument();
    expect(q.getByTestId('hotspot-sheet-type')).toHaveTextContent('Parking areas');
    expect(q.getByTestId('hotspot-sheet-meta')).toHaveTextContent('East Hampshire');
    expect(q.getByTestId('hotspot-sheet-activity')).toHaveTextContent('2 checked in');
    expect(q.getByTestId('hotspot-sheet-checkin')).toHaveTextContent('Check in');
    expect(q.getByTestId('hotspot-sheet-checkin-anon')).toHaveTextContent('Check in anonymously');
    expect(q.getByTestId('hotspot-sheet-directions').getAttribute('href')).toContain('51.19');
    expect(q.getByTestId('hotspot-sheet-view-on-map')).toHaveTextContent('View on map');
    expect(q.getByTestId('write-review-btn')).toHaveTextContent('Leave a review');
    expect(await q.findByText('Quiet after dark.')).toBeInTheDocument();
    expect(hotSpotsAPI.listReviews).toHaveBeenCalledWith(spot.id);
  });

  it('anonymous check-in uses the same API and updates the sheet', async () => {
    renderOut();
    fireEvent.click(await screen.findByTestId(`out-spot-open-${spot.id}`));
    fireEvent.click(await screen.findByTestId('hotspot-sheet-checkin-anon'));
    await waitFor(() => expect(hotSpotsAPI.checkIn).toHaveBeenCalledWith(spot.id, true));
    expect(await screen.findByTestId('hotspot-sheet-checkout')).toHaveTextContent('Checked in anonymously');
  });

  it('with no server spot the count is left alone (#368: Ghost viewers are never counted)', async () => {
    vi.mocked(hotSpotsAPI.checkIn).mockResolvedValue({ data: { ok: true } } as never);
    renderOut();
    fireEvent.click(await screen.findByTestId(`out-spot-open-${spot.id}`));
    fireEvent.click(await screen.findByTestId('hotspot-sheet-checkin-anon'));
    await screen.findByTestId('hotspot-sheet-checkout');
    expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('2 checked in');
  });

  it('Escape closes the sheet and returns focus to the card', async () => {
    renderOut();
    const open = await screen.findByTestId(`out-spot-open-${spot.id}`);
    open.focus();
    fireEvent.click(open);
    await screen.findByTestId('hotspot-sheet');
    expect(document.activeElement).toBe(screen.getByTestId('hotspot-sheet-close'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('hotspot-sheet')).toBeNull());
    expect(document.activeElement).toBe(screen.getByTestId(`out-spot-open-${spot.id}`));
  });

  it('View on map goes to the Map tab for that spot (spot id only, no coordinates)', async () => {
    renderOut();
    fireEvent.click(await screen.findByTestId(`out-spot-open-${spot.id}`));
    fireEvent.click(await screen.findByTestId('hotspot-sheet-view-on-map'));
    expect(await screen.findByTestId('where')).toHaveTextContent(`/discover?spot=${spot.id}`);
    expect(screen.getByTestId('where').textContent).not.toMatch(/lat|lng|51\.19/);
  });

  it('the card keeps its look: MAP is still its own directions link above the tap area', async () => {
    renderOut();
    const card = await screen.findByTestId(`out-spot-${spot.id}`);
    const map = within(card).getByRole('link', { name: `Map directions to ${spot.name}` });
    expect(map).toHaveTextContent('Map');
    expect(map.className).toContain('z-10');
    expect(map.className).toContain('min-h-[44px]');
    fireEvent.click(map);
    expect(screen.queryByTestId('hotspot-sheet')).toBeNull();
  });
});

describe('Map pin opens the same sheet', () => {
  const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
  it('Discover renders HotSpotSheet from the pin with the same actions as Out', () => {
    const discover = read('./Discover.tsx');
    expect(discover).toContain("import { HotSpotSheet } from '../components/HotSpotSheet'");
    // Pin element and canvas hit-test both select the spot for the sheet.
    expect(discover).toMatch(/createHotSpotPinElement\(\s*pinData,\s*\(\) => setSelectedHotSpot\(spot\)/);
    expect(discover).toContain('if (entry) setSelectedHotSpot(entry.spot);');
    const sheetUse = discover.slice(discover.indexOf('<HotSpotSheet'), discover.indexOf('/>', discover.indexOf('<HotSpotSheet')));
    for (const prop of ['spot={selectedHotSpot}', 'onCheckIn=', 'onSpotUpdated=', 'onViewOnMap=']) {
      expect(sheetUse).toContain(prop);
    }
    const out = read('./Out.tsx');
    const outUse = out.slice(out.indexOf('<HotSpotSheet'), out.indexOf('/>', out.indexOf('<HotSpotSheet')));
    for (const prop of ['onCheckIn=', 'onSpotUpdated=', 'onViewOnMap=']) {
      expect(outUse).toContain(prop);
    }
  });
});

describe('Out cards use line icons, not emoji', () => {
  beforeEach(() => {
    useLocationStore.setState({ lat: 51.2, lng: -0.9 });
    vi.mocked(hotSpotsAPI.listNearby).mockResolvedValue({
      data: {
        spots: [
          spot,
          { ...spot, id: 'spot-tulle', name: 'Tullecombe', category_slug: 'open-spaces', category_name: 'Open spaces', category_icon: '🏞️' },
          { ...spot, id: 'spot-sauna', name: 'Sauna', category_slug: 'saunas', category_name: 'Saunas & spas', category_icon: '🧖' },
          { ...spot, id: 'spot-bar', name: 'Bar', category_slug: 'bars', category_name: 'Bars', category_icon: '🍸' },
        ],
      },
    } as never);
  });

  it('no card tile or type label renders an emoji', async () => {
    renderOut();
    await screen.findByTestId('out-spot-spot-tulle');
    const list = screen.getByTestId('out-list');
    expect(list.textContent).not.toMatch(/\p{Extended_Pictographic}|\u{FE0F}/u);
    for (const tile of screen.getAllByTestId('out-spot-type-tile')) {
      expect(tile.querySelector('svg')).not.toBeNull();
      expect(tile.className).toContain('text-[var(--nn-accent-text)]');
    }
    for (const label of screen.getAllByTestId('out-spot-type')) {
      expect(label.querySelector('svg')).not.toBeNull();
    }
  });
});
