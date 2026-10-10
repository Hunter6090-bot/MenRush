import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrast, hardcodedColourClasses, loadThemeTokens, type Theme } from '../test/themeContrast';
import { TravelSheet } from './TravelSheet';

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

const mocks = vi.hoisted(() => ({
  user: { id: 'me', name: 'Member', is_premium: true } as { id: string; name: string; is_premium: boolean },
  getTrip: vi.fn(),
  planTrip: vi.fn(),
  endTrip: vi.fn(),
}));

vi.mock('../hooks/store', () => ({
  useAuthStore: (sel: (s: { user: typeof mocks.user }) => unknown) => sel({ user: mocks.user }),
}));
vi.mock('../api/client', () => ({
  travelAPI: { getTrip: mocks.getTrip, planTrip: mocks.planTrip, endTrip: mocks.endTrip },
}));

function Where() {
  const l = useLocation();
  return <p data-testid="where">{`${l.pathname}${l.search}`}</p>;
}

const NOW = new Date('2026-10-10T09:30:00Z');

function renderSheet() {
  return render(
    <MemoryRouter initialEntries={['/travel']}>
      <Routes>
        <Route path="*" element={<><TravelSheet now={NOW} /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TravelSheet', () => {
  beforeEach(() => {
    mocks.user = { id: 'me', name: 'Member', is_premium: true };
    mocks.getTrip.mockReset().mockResolvedValue({ data: { trip: null } });
    mocks.planTrip.mockReset();
    mocks.endTrip.mockReset();
  });

  it('Free members see the plane, an honest Premium card and no form', async () => {
    mocks.user = { id: 'me', name: 'Member', is_premium: false };
    renderSheet();
    expect(screen.getByRole('heading', { name: 'Travel' })).toBeInTheDocument();
    expect(screen.getByTestId('travel-premium-gate')).toHaveTextContent('Travel is part of Premium');
    expect(screen.getByTestId('travel-premium-cta')).toHaveAttribute('href', '/premium');
    expect(screen.queryByTestId('travel-city')).not.toBeInTheDocument();
    expect(screen.queryByTestId('travel-save-trip')).not.toBeInTheDocument();
  });

  it('always-Premium owner accounts get the form even without the flag', () => {
    mocks.user = { id: 'me', name: 'BOA90', is_premium: false };
    renderSheet();
    expect(screen.getByTestId('travel-city')).toBeInTheDocument();
  });

  it('Look around opens that city without sending any location', () => {
    renderSheet();
    fireEvent.change(screen.getByTestId('travel-city'), { target: { value: 'Manchester' } });
    fireEvent.click(screen.getByTestId('travel-look-around'));
    expect(screen.getByTestId('where')).toHaveTextContent('/travel/look?city=Manchester');
    expect(mocks.planTrip).not.toHaveBeenCalled();
  });

  it('checks dates before saving: 7 days ahead, 14 days long', async () => {
    renderSheet();
    fireEvent.change(screen.getByTestId('travel-city'), { target: { value: 'Leeds' } });
    fireEvent.change(screen.getByTestId('travel-start'), { target: { value: '2026-10-18' } });
    fireEvent.change(screen.getByTestId('travel-end'), { target: { value: '2026-10-19' } });
    fireEvent.click(screen.getByTestId('travel-save-trip'));
    expect(await screen.findByTestId('travel-error')).toHaveTextContent('Trips can start up to 7 days ahead.');
    fireEvent.change(screen.getByTestId('travel-start'), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByTestId('travel-end'), { target: { value: '2026-10-24' } });
    fireEvent.click(screen.getByTestId('travel-save-trip'));
    expect(await screen.findByTestId('travel-error')).toHaveTextContent('Trips can be up to 14 days long.');
    expect(mocks.planTrip).not.toHaveBeenCalled();
  });

  it('saves a trip, shows it, and ends it', async () => {
    mocks.planTrip.mockResolvedValue({
      data: {
        trip: {
          id: 't1', city: 'Leeds', country_code: 'gb', centre: { lat: 53.8, lng: -1.55 },
          starts_on: '2026-10-10', ends_on: '2026-10-12', starts_at: '', ends_at: '', status: 'live',
        },
      },
    });
    mocks.endTrip.mockResolvedValue({ data: { ended: true } });
    renderSheet();
    fireEvent.change(screen.getByTestId('travel-city'), { target: { value: 'Leeds' } });
    fireEvent.click(screen.getByTestId('travel-save-trip'));
    await waitFor(() =>
      expect(mocks.planTrip).toHaveBeenCalledWith({ city: 'Leeds', startsOn: '2026-10-10', endsOn: '2026-10-12' }),
    );
    expect(await screen.findByTestId('travel-trip-summary')).toHaveTextContent('Visiting Leeds until 12 Oct');
    expect(screen.getByTestId('travel-save-trip')).toHaveTextContent('Replace trip');
    fireEvent.click(screen.getByTestId('travel-end-trip'));
    await waitFor(() => expect(screen.queryByTestId('travel-current-trip')).not.toBeInTheDocument());
    expect(screen.getByTestId('travel-notice')).toHaveTextContent('Trip ended.');
  });

  it('a 402 from the server shows the Premium card', async () => {
    mocks.planTrip.mockRejectedValue({ response: { status: 402, data: { error: 'premium_required' } } });
    renderSheet();
    fireEvent.change(screen.getByTestId('travel-city'), { target: { value: 'Leeds' } });
    fireEvent.click(screen.getByTestId('travel-save-trip'));
    expect(await screen.findByTestId('travel-premium-gate')).toBeInTheDocument();
  });

  it('tap targets are at least 44px and text is at least 15px', () => {
    renderSheet();
    for (const id of ['travel-look-around', 'travel-save-trip', 'travel-city', 'travel-start', 'travel-end']) {
      expect(screen.getByTestId(id).className, id).toMatch(/min-h-\[44px\]/);
    }
    const sheet = screen.getByTestId('travel-sheet');
    for (const el of Array.from(sheet.querySelectorAll('*'))) {
      for (const m of (el.getAttribute('class') ?? '').matchAll(/text-\[(\d+)px\]/g)) {
        expect(Number(m[1])).toBeGreaterThanOrEqual(15);
      }
      expect(el.getAttribute('class') ?? '').not.toMatch(/\btext-(xs|sm)\b/);
    }
  });

  it.each<Theme>(['dark', 'light'])('colours are tokens with 4.5:1 contrast (%s)', (theme) => {
    renderSheet();
    const sheet = screen.getByTestId('travel-sheet');
    expect(hardcodedColourClasses(sheet)).toEqual([]);
    for (const id of ['travel-look-around', 'travel-save-trip']) {
      expect(contrast(screen.getByTestId(id), theme), `${id} ${theme}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(screen.getByRole('heading', { name: 'Travel' }), theme)).toBeGreaterThanOrEqual(4.5);
  });
});
