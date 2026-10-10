/**
 * Brand (10 Oct 2026): spot-type labels use copper line icons, never emoji.
 * Server categories still carry an emoji in category_icon; nothing may render it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { HotSpotDTO } from '../../api/client';
import { SpotTypeIcon, spotTypeKey, type SpotTypeKey } from './SpotTypeIcon';
import { HotSpotSheet } from '../HotSpotSheet';
import { CruisingSpotCard } from '../CruisingSpotCard';
import { CRUISING_CATEGORIES } from '../../lib/cruising';
import { loadThemeTokens, tokenContrast, type Theme } from '../../test/themeContrast';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>();
  return {
    ...actual,
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      listReviews: vi.fn().mockResolvedValue({ data: { reviews: [], rating_avg: null, review_count: 0 } }),
    },
  };
});

loadThemeTokens(readFileSync(resolve(__dirname, '../../styles/menrush-tokens.css'), 'utf8'));

const EMOJI = /\p{Extended_Pictographic}|\u{1F17F}|\u{FE0F}/u;

/** Every category the server seeds (migrations 024, 040, 048, 061) with its emoji. */
const SERVER_CATEGORIES: [slug: string, name: string, icon: string, expected: SpotTypeKey][] = [
  ['parking', 'Parking areas', '🅿️', 'parking'],
  ['open-spaces', 'Open spaces', '🏞️', 'open-space'],
  ['parks-trails', 'Parks & trails', '🌲', 'trees'],
  ['saunas', 'Saunas & spas', '🧖', 'sauna'],
  ['rest-facilities', 'Rest & facilities', '🏛️', 'facilities'],
  ['transit', 'Transit & stations', '🚉', 'transit'],
  ['nightlife', 'Nightlife', '🪩', 'nightlife'],
  ['bars', 'Bars', '🍸', 'bar'],
  ['cinema', 'Cinema clubs', '🎬', 'cinema'],
];

function spotFor(slug: string, name: string, icon: string): HotSpotDTO {
  return {
    id: `spot-${slug}`, name: `Spot ${slug}`, city: 'Chichester', description: null as unknown as string,
    latitude: 50.9, longitude: -0.8, category_id: 1, category_slug: slug, category_name: name,
    category_icon: icon, distance_km: 12, live_count: 0, live_count_exact: null, is_checked_in: false,
    my_checkin_anonymous: null, checkin_ttl_hours: 2, has_active_checkins: false,
  };
}

describe('spot-type icons', () => {
  it.each(SERVER_CATEGORIES)('%s maps to its own line icon', (slug, name, _icon, expected) => {
    expect(spotTypeKey(slug, name)).toBe(expected);
  });

  it('cruising categories, events and community all have icons', () => {
    expect(CRUISING_CATEGORIES.map((c) => spotTypeKey(c))).toEqual(
      CRUISING_CATEGORIES.map((c) => ({ woods: 'trees', beach: 'beach', layby: 'parking', park: 'open-space', sauna: 'sauna' })[c]),
    );
    expect(spotTypeKey('event')).toBe('event');
    expect(spotTypeKey('community')).toBe('community');
  });

  it('icons are real SVG line icons in currentColor', () => {
    const { container } = render(<SpotTypeIcon type="parking" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('stroke-width')).toBe('2');
  });

  it.each<Theme>(['light', 'dark'])('copper icon colour is at least 3:1 on cards and tiles (%s)', (theme) => {
    for (const bg of ['var(--bg-card)', 'var(--bg-elevated)']) {
      expect(tokenContrast('var(--nn-accent-text)', bg, theme, bg)).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(SERVER_CATEGORIES)('no spot-type label renders an emoji: sheet and search card (%s)', (slug, name, icon) => {
    const spot = spotFor(slug, name, icon);
    const { unmount } = render(
      <MemoryRouter>
        <HotSpotSheet spot={spot} isPremium={false} acting={false} error="" onClose={vi.fn()} onCheckIn={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('hotspot-sheet-type').textContent).not.toMatch(EMOJI);
    expect(screen.getByTestId('hotspot-sheet-type').querySelector('svg')).not.toBeNull();
    unmount();
    render(<CruisingSpotCard spot={spot} />);
    const badge = screen.getByTestId('cruising-category-badge');
    expect(badge.textContent).not.toMatch(EMOJI);
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('source guard: Out, the sheet, the search sheet and the Cruise list never print category_icon or meta.icon', () => {
    const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8');
    for (const file of ['../../pages/Out.tsx', '../HotSpotSheet.tsx', '../CruisingSpotCard.tsx', '../CruisingSearchSheet.tsx', '../../pages/HotSpots.tsx']) {
      const src = read(file);
      expect(src, file).not.toMatch(/\{\s*spot\.category_icon/);
      expect(src, file).not.toMatch(/\{\s*(cat|meta|categoryMeta)\.icon\s*\}/);
      expect(src, file).not.toMatch(/CRUISING_CATEGORY_META\[[^\]]+\]\.icon/);
      expect(src, file).not.toMatch(/🎟|📍|🌲/u);
    }
  });
});
