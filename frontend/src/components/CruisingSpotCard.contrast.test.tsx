/**
 * QC #386 contrast guard, light and dark, tokens only:
 * - Out card type badge: icon >= 3:1 and label >= 4.5:1 on its tinted fill over the card.
 * - Map thumbnail fallback coordinates: 15px and >= 4.5:1 on the tile fill.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HotSpotDTO } from '../api/client';
import { CruisingSpotCard } from './CruisingSpotCard';
import { CruisingSpotMapThumbnail } from './CruisingSpotMapThumbnail';
import { contrast, hardcodedColourClasses, loadThemeTokens, type Theme } from '../test/themeContrast';

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
loadThemeTokens(read('../styles/menrush-tokens.css'));

const spot: HotSpotDTO = {
  id: 'spot-contrast',
  name: 'Steamer Quay',
  city: 'Torquay',
  description: null,
  latitude: 50.46,
  longitude: -3.53,
  category_id: 2,
  category_slug: 'saunas',
  category_name: 'Saunas',
  category_icon: '♨️',
  distance_km: 3.1,
  live_count: '—',
  live_count_exact: 0,
  is_checked_in: false,
  my_checkin_anonymous: null,
  checkin_ttl_hours: 2,
  has_active_checkins: false,
} as HotSpotDTO;

describe.each<Theme>(['light', 'dark'])('Out card contrast (%s)', (theme) => {
  it('type badge: token colours, icon >= 3:1, label >= 4.5:1', () => {
    render(<CruisingSpotCard spot={spot} />);
    const badge = screen.getByTestId('cruising-category-badge');
    expect(hardcodedColourClasses(badge)).toEqual([]);
    const icon = badge.querySelector('svg')!;
    // The icon strokes in currentColor, so it takes the badge text colour on the badge fill.
    expect(contrast(icon, theme), `badge icon (${theme})`).toBeGreaterThanOrEqual(3);
    const label = badge.querySelector('span')!;
    expect(contrast(label, theme), `badge label (${theme})`).toBeGreaterThanOrEqual(4.5);
  });

  it('map thumbnail coordinates: 15px, token colours, >= 4.5:1', () => {
    render(<CruisingSpotMapThumbnail latitude={50.46} longitude={-3.53} name="Steamer Quay" />);
    const coords = screen.getByTestId('cruising-map-thumbnail-coords');
    expect(coords.className).toContain('text-[15px]');
    expect(coords.className).not.toMatch(/text-\[(?:1[0-4]|\d)px\]/);
    expect(hardcodedColourClasses(coords)).toEqual([]);
    expect(hardcodedColourClasses(screen.getByTestId('cruising-map-thumbnail'), (el) => el !== screen.getByTestId('cruising-map-thumbnail'))).toEqual([]);
    expect(coords).toHaveTextContent('50.46,');
    expect(coords).toHaveTextContent('-3.53');
    expect(contrast(coords, theme), `coords (${theme})`).toBeGreaterThanOrEqual(4.5);
  });
});
