/**
 * Out EVENT pill and footer links follow the theme: text >= 4.5:1 on light and dark.
 * Plain var(--copper) text was about 3.4:1 on the light card.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Out } from './Out';
import { hotSpotsAPI, eventsAPI } from '../api/client';
import { useLocationStore } from '../hooks/store';
import { contrast, hardcodedColourClasses, loadThemeTokens, tokenContrast, type Theme } from '../test/themeContrast';

vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    hotSpotsAPI: { ...actual.hotSpotsAPI, listNearby: vi.fn() },
    eventsAPI: { ...actual.eventsAPI, getNearby: vi.fn() },
  };
});

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

describe.each<Theme>(['light', 'dark'])('Out EVENT pill and footer contrast (%s)', (theme) => {
  beforeEach(() => {
    useLocationStore.setState({ lat: 51.5, lng: -0.12 });
    vi.mocked(hotSpotsAPI.listNearby).mockResolvedValue({ data: { spots: [] } } as never);
    vi.mocked(eventsAPI.getNearby).mockResolvedValue({
      data: [{ id: 'ev1', name: 'Bear night', venue_name: 'The Eagle', starts_at: 'Sat 21:00' }],
    } as never);
  });

  it('EVENT pill: theme tokens, 15px, 44px, text >= 4.5:1', async () => {
    render(<MemoryRouter><Out /></MemoryRouter>);
    const pill = await screen.findByTestId('out-event-pill');
    expect(hardcodedColourClasses(pill)).toEqual([]);
    expect(pill.className).toContain('text-[15px]');
    expect(pill.className).toContain('min-h-[44px]');
    expect(contrast(pill, theme)).toBeGreaterThanOrEqual(4.5);
    expect(tokenContrast('var(--nn-accent-text)', 'var(--bg-card)', theme)).toBeGreaterThanOrEqual(3);
  });

  it('footer links: theme tokens, 15px, 44px targets, text >= 4.5:1', async () => {
    render(<MemoryRouter><Out /></MemoryRouter>);
    const footer = await screen.findByTestId('out-footer-links');
    expect(hardcodedColourClasses(footer)).toEqual([]);
    const links = within(footer).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Full Cruise map', 'Full Events', 'Community feed']);
    for (const link of links) {
      expect(link.className).toContain('text-[15px]');
      expect(link.className).toContain('min-h-[44px]');
      expect(contrast(link, theme), `${link.textContent} (${theme})`).toBeGreaterThanOrEqual(4.5);
      // Footer sits on the page background, not a card: check that too.
      expect(tokenContrast('var(--nn-accent-text)', 'var(--bg-primary)', theme, 'var(--bg-primary)')).toBeGreaterThanOrEqual(4.5);
    }
  });
});
