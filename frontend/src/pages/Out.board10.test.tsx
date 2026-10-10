/**
 * Out tab against Claude Design board 10:
 * (a) Map button in the header opens the Cruise map.
 * (b) Venue photo only when the spot has one and it loads; else the copper type icon tile.
 * (c) Rows show the copper line type icon plus its label, not a MAP button.
 *     Directions stay reachable from the spot sheet a row tap opens.
 * (d) Opening hours only when real hours exist; never invented.
 * Locks: 15px text, 44px targets, text >= 4.5:1 and icons >= 3:1, light and dark.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out } from './Out';
import { hotSpotsAPI, eventsAPI, type HotSpotDTO } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { contrast, hardcodedColourClasses, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    hotSpotsAPI: { ...actual.hotSpotsAPI, listNearby: vi.fn(), checkIn: vi.fn(), checkOut: vi.fn() },
    eventsAPI: { ...actual.eventsAPI, getNearby: vi.fn() },
  };
});

const OUT_SRC = readFileSync(resolve(__dirname, './Out.tsx'), 'utf8');
loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

function spot(over: Partial<HotSpotDTO>): HotSpotDTO {
  return {
    id: 's1',
    name: 'Steam House',
    city: 'London',
    description: null,
    latitude: 51.5,
    longitude: -0.12,
    category_id: 1,
    category_slug: 'saunas',
    category_name: 'Sauna',
    category_icon: '🧖',
    distance_km: 1.2,
    live_count: 0,
    live_count_exact: null,
    is_checked_in: false,
    my_checkin_anonymous: null,
    ...over,
  };
}

function renderOut(spots: HotSpotDTO[]) {
  vi.mocked(hotSpotsAPI.listNearby).mockResolvedValue({ data: { spots } } as never);
  return render(
    <MemoryRouter initialEntries={['/out']}>
      <Out />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useLocationStore.setState({ lat: 51.5, lng: -0.12 });
  vi.mocked(eventsAPI.getNearby).mockResolvedValue({ data: [] } as never);
});

describe('Out board 10: header Map button (a)', () => {
  it('opens the Cruise map, 15px label, 44px target', async () => {
    renderOut([]);
    const pill = await screen.findByTestId('out-map-pill');
    expect(pill.getAttribute('href')).toBe('/hot-spots');
    expect(pill.textContent).toBe('Map');
    expect(pill.className).toContain('text-[15px]');
    expect(pill.className).toContain('min-h-[44px]');
  });
});

describe('Out board 10: spot rows (b, c, d)', () => {
  it('row shows the copper type icon and label, and no MAP button', async () => {
    renderOut([spot({})]);
    const row = await screen.findByTestId('out-spot-s1');
    const type = within(row).getByTestId('out-spot-type-s1');
    expect(type.textContent).toBe('Sauna');
    expect(type.querySelector('[data-spot-icon="sauna"]')).not.toBeNull();
    expect(type.className).toContain('text-[15px]');
    expect(type.className).toContain('text-[var(--nn-accent-text)]');
    expect(within(row).queryByText(/^map$/i)).toBeNull();
    expect(row.querySelector('a')).toBeNull();
    expect(row.textContent).not.toContain('🧖');
  });

  it('a row tap opens the spot sheet, which keeps directions', async () => {
    renderOut([spot({})]);
    fireEvent.click(await screen.findByTestId('out-spot-s1'));
    const directions = await screen.findByTestId('hotspot-sheet-directions');
    expect(directions.getAttribute('href')).toContain('51.5');
  });

  it('no photo: copper type icon tile (never a placeholder photo)', async () => {
    renderOut([spot({})]);
    const thumb = await screen.findByTestId('out-spot-thumb-s1');
    expect(thumb.getAttribute('data-thumb')).toBe('icon');
    expect(thumb.querySelector('img')).toBeNull();
    expect(thumb.querySelector('[data-spot-icon="sauna"]')).not.toBeNull();
  });

  it('real photo: shown; if it fails to load, back to the icon tile', async () => {
    renderOut([spot({ photo_url: 'https://cdn.example.com/steam.jpg' })]);
    const thumb = await screen.findByTestId('out-spot-thumb-s1');
    const img = thumb.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/steam.jpg');
    fireEvent.error(img as HTMLImageElement);
    expect(thumb.getAttribute('data-thumb')).toBe('icon');
    expect(thumb.querySelector('img')).toBeNull();
  });

  it('hours: nothing when there is no hours data, the real text when there is', async () => {
    const { unmount } = renderOut([spot({})]);
    await screen.findByTestId('out-spot-s1');
    expect(screen.queryByTestId('out-spot-hours-s1')).toBeNull();
    expect(screen.getByTestId('out-spot-s1').textContent).not.toMatch(/hours|open/i);
    unmount();
    renderOut([spot({ opening_hours: 'Daily 12:00 to 02:00' })]);
    const hours = await screen.findByTestId('out-spot-hours-s1');
    expect(hours.textContent).toBe('Daily 12:00 to 02:00');
    expect(hours.className).toContain('text-[15px]');
  });

  it('row is a 44px+ target', async () => {
    renderOut([spot({})]);
    const row = await screen.findByTestId('out-spot-s1');
    expect(row.tagName).toBe('BUTTON');
    expect(row.className).toContain('min-h-[72px]');
  });
});

describe.each<Theme>(['light', 'dark'])('Out board 10 contrast (%s)', (theme) => {
  it('header pill, row type label and tile use theme tokens at >= 4.5:1 text, >= 3:1 icons', async () => {
    renderOut([spot({})]);
    const row = await screen.findByTestId('out-spot-s1');
    const pill = screen.getByTestId('out-map-pill');
    expect(hardcodedColourClasses(row)).toEqual([]);
    expect(hardcodedColourClasses(pill)).toEqual([]);
    expect(contrast(pill, theme)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(within(row).getByTestId('out-spot-type-s1'), theme)).toBeGreaterThanOrEqual(4.5);
    // Icons: accent on the card (row label icon, header pin) and on the elevated tile.
    expect(tokenContrast('var(--nn-accent-text)', 'var(--bg-card)', theme)).toBeGreaterThanOrEqual(3);
    expect(tokenContrast('var(--nn-accent-text)', 'var(--bg-elevated)', theme, 'var(--bg-elevated)')).toBeGreaterThanOrEqual(3);
    expect(contrast(screen.getByTestId('out-spot-thumb-s1'), theme)).toBeGreaterThanOrEqual(3);
  });
});

describe('Out copy locks', () => {
  it('no beta wording and no em dashes in Out', () => {
    expect(OUT_SRC).not.toMatch(/\bbeta\b/i);
    expect(OUT_SRC).not.toContain('\u2014');
  });
});
