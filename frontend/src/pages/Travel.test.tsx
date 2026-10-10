import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrast, hardcodedColourClasses, loadThemeTokens, type Theme } from '../test/themeContrast';
import { LookAroundPage } from './Travel';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

const mocks = vi.hoisted(() => ({
  user: { id: 'me', name: 'Member', is_premium: true } as { id: string; name: string; is_premium: boolean },
  lookAround: vi.fn(),
  hotSpots: vi.fn(),
  events: vi.fn(),
}));

vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: unknown }) => <div>{children as never}</div> }));
vi.mock('../hooks/store', () => ({
  useAuthStore: (sel: (s: { user: typeof mocks.user }) => unknown) => sel({ user: mocks.user }),
}));
vi.mock('../api/client', () => ({
  travelAPI: { lookAround: mocks.lookAround },
  hotSpotsAPI: { listNearby: mocks.hotSpots },
  eventsAPI: { getNearby: mocks.events },
}));

const place = {
  name: 'Manchester',
  country_code: 'gb',
  centre: { lat: 53.45, lng: -2.23 },
  bounds: { south: 53.34, north: 53.55, west: -2.32, east: -2.14 },
};

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname}</p>;
}

function renderPage(city = 'Manchester') {
  return render(
    <MemoryRouter initialEntries={[`/travel/look?city=${city}`]}>
      <Routes>
        <Route path="/travel/look" element={<LookAroundPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Look around', () => {
  beforeEach(() => {
    mocks.user = { id: 'me', name: 'Member', is_premium: true };
    mocks.lookAround.mockReset().mockResolvedValue({
      data: {
        place,
        members: [
          { id: 'v1', name: 'Rob', age: 40, headline: null, photo_url: null, is_verified: false, online: true,
            lat: 53.45, lng: -2.23, distance_label: 'Visiting Manchester',
            visiting: { city: 'Manchester', starts_at: '2026-10-09T23:00:00Z', ends_at: '2026-10-12T23:00:00Z' } },
          { id: 'l1', name: 'Sam', age: 35, headline: null, photo_url: null, is_verified: true, online: false,
            lat: 53.48, lng: -2.24 },
        ],
      },
    });
    mocks.hotSpots.mockReset().mockResolvedValue({ data: { spots: [{ id: 's1', name: 'The Spot', category_name: 'Sauna', latitude: 53.47, longitude: -2.24 }] } });
    mocks.events.mockReset().mockResolvedValue({ data: [{ id: 'e1', name: 'Bear night', venue_name: 'Via' }] });
  });

  it('shows "Looking around: Manchester" and goes back to Near me in one tap', async () => {
    renderPage();
    expect(await screen.findByTestId('look-around-label')).toHaveTextContent('Looking around: Manchester');
    fireEvent.click(screen.getByTestId('look-around-near-me'));
    expect(screen.getByTestId('where')).toHaveTextContent('/discover');
  });

  it('asks the server for that city only (no location sent) and loads spots and events at the centre', async () => {
    renderPage();
    await waitFor(() => expect(mocks.lookAround).toHaveBeenCalledWith('Manchester'));
    expect(mocks.lookAround.mock.calls[0]).toHaveLength(1);
    await waitFor(() => expect(mocks.hotSpots).toHaveBeenCalledWith(53.45, -2.23, 15));
    expect(mocks.events).toHaveBeenCalledWith(53.45, -2.23, 15, 20);
    expect(await screen.findByText('The Spot')).toBeInTheDocument();
    expect(screen.getByText('Bear night')).toBeInTheDocument();
  });

  it('visitors read "Visiting Manchester", locals "In Manchester", and nobody gets a distance', async () => {
    renderPage();
    const visitor = await screen.findByTestId('look-member-v1');
    expect(within(visitor).getByTestId('look-member-label')).toHaveTextContent('Visiting Manchester');
    const local = screen.getByTestId('look-member-l1');
    expect(within(local).getByTestId('look-member-label')).toHaveTextContent('In Manchester');
    expect(screen.getByTestId('look-around-page').textContent).not.toMatch(/\d+\s*(mi|km|m)\b/);
  });

  it('Free members keep the bar and see the Premium card; nothing is fetched', async () => {
    mocks.user = { id: 'me', name: 'Member', is_premium: false };
    renderPage();
    expect(screen.getByTestId('look-around-label')).toHaveTextContent('Looking around: Manchester');
    expect(screen.getByTestId('travel-premium-gate')).toBeInTheDocument();
    expect(mocks.lookAround).not.toHaveBeenCalled();
  });

  it.each<Theme>(['dark', 'light'])('bar uses tokens with 4.5:1 contrast and 44px Near me (%s)', async (theme) => {
    renderPage();
    const bar = await screen.findByTestId('look-around-bar');
    expect(hardcodedColourClasses(bar)).toEqual([]);
    expect(contrast(screen.getByTestId('look-around-label'), theme)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(screen.getByTestId('look-around-near-me'), theme)).toBeGreaterThanOrEqual(4.5);
    expect(screen.getByTestId('look-around-near-me').className).toMatch(/min-h-\[44px\]/);
  });
});
