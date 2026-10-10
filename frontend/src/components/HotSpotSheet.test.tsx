import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { HotSpotDTO } from '../api/client';
import { HotSpotSheet } from './HotSpotSheet';
import { contrast, hardcodedColourClasses, loadThemeTokens, type Theme } from '../test/themeContrast';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    hotSpotsAPI: {
      ...actual.hotSpotsAPI,
      listReviews: vi.fn().mockResolvedValue({ data: { reviews: [], rating_avg: null, review_count: 0 } }),
    },
  };
});

loadThemeTokens(readFileSync(resolve(__dirname, '../styles/menrush-tokens.css'), 'utf8'));

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
  checkin_ttl_hours: 2,
  has_active_checkins: false,
  rating_avg: 4.5,
  review_count: 3,
};

describe('HotSpotSheet', () => {
  it('renders spot sheet with quiet face, directions link, and reviews button', () => {
    const onOpenReviews = vi.fn();
    render(
      <MemoryRouter>
        <HotSpotSheet
          spot={mockSpot}
          isPremium={false}
          acting={false}
          error=""
          onClose={vi.fn()}
          onCheckIn={vi.fn()}
          onOpenReviews={onOpenReviews}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('hotspot-sheet')).toBeInTheDocument();
    expect(screen.getByText('A31 Hog’s Back Rest Lay-by')).toBeInTheDocument();
    expect(screen.getByTestId('hotspot-sheet-brand-face')).toBeInTheDocument();

    const dirLink = screen.getByTestId('hotspot-sheet-directions');
    expect(dirLink).toBeInTheDocument();
    expect(dirLink.getAttribute('href')).toContain('51.2260632');
    expect(dirLink.getAttribute('href')).toContain('-0.6727582');

    const revBtn = screen.getByTestId('hotspot-sheet-reviews-btn');
    expect(revBtn).toBeInTheDocument();
    expect(revBtn).toHaveTextContent('3');
    fireEvent.click(revBtn);
    expect(onOpenReviews).toHaveBeenCalledWith(mockSpot);
  });

  it('triggers check-in anonymously when requested', () => {
    const onCheckIn = vi.fn();
    render(
      <MemoryRouter>
        <HotSpotSheet
          spot={mockSpot}
          isPremium={false}
          acting={false}
          error=""
          onClose={vi.fn()}
          onCheckIn={onCheckIn}
        />
      </MemoryRouter>,
    );

    const checkInAnon = screen.getByTestId('hotspot-sheet-checkin-anon');
    fireEvent.click(checkInAnon);
    expect(onCheckIn).toHaveBeenCalledWith(mockSpot, true);
  });

  const renderSheet = (spot: HotSpotDTO) =>
    render(
      <MemoryRouter>
        <HotSpotSheet spot={spot} isPremium={false} acting={false} error="" onClose={vi.fn()} onCheckIn={vi.fn()} />
      </MemoryRouter>,
    );

  it('check-in line is 15px and shows the count, including 1', () => {
    renderSheet({ ...mockSpot, has_active_checkins: true, live_count: 1, live_count_exact: null });
    const line = screen.getByTestId('hotspot-sheet-activity');
    expect(line).toHaveTextContent('1 checked in');
    expect(line).not.toHaveTextContent('Active now');
    expect(line.querySelector('p')).toHaveClass('text-[15px]');
  });

  it('Free 5+ reads "5+ checked in"', () => {
    renderSheet({ ...mockSpot, has_active_checkins: true, live_count: '5+', live_count_exact: null });
    expect(screen.getByTestId('hotspot-sheet-activity')).toHaveTextContent('5+ checked in');
  });

  it('says "Active now" only when there is no count', () => {
    renderSheet({ ...mockSpot, has_active_checkins: true, live_count: null as unknown as number, live_count_exact: null });
    const line = screen.getByTestId('hotspot-sheet-activity');
    expect(line).toHaveTextContent('Active now');
    expect(line).not.toHaveTextContent(/null|undefined/);
  });

  it('half-screen sheet drags (or keys) up to full screen', () => {
    renderSheet(mockSpot);
    const sheet = screen.getByTestId('hotspot-sheet');
    expect(sheet).toHaveAttribute('data-snap', 'half');
    const handle = screen.getByTestId('hotspot-sheet-handle');
    expect(handle.className).toContain('min-h-[44px]');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(sheet).toHaveAttribute('data-snap', 'full');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(sheet).toHaveAttribute('data-snap', 'half');
  });

  it('traps focus: Tab from the last control wraps to the first, Shift+Tab from the first wraps to the last', () => {
    renderSheet(mockSpot);
    const sheet = screen.getByTestId('hotspot-sheet');
    const items = Array.from(
      sheet.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])'),
    );
    const first = items[0];
    const last = items[items.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <HotSpotSheet spot={mockSpot} isPremium={false} acting={false} error="" onClose={onClose} onCheckIn={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('every text class is 15px or larger, every control is at least 44px, no em dashes or beta', () => {
    renderSheet({ ...mockSpot, source_url: 'https://example.com' });
    const sheet = screen.getByTestId('hotspot-sheet');
    for (const el of [sheet, ...Array.from(sheet.querySelectorAll('*'))]) {
      const cls = el.getAttribute('class') ?? '';
      expect(cls, cls).not.toMatch(/\btext-(xs|sm|\[1[0-4]px\]|\[[0-9]px\])\b/);
    }
    for (const el of Array.from(sheet.querySelectorAll('a, button, [role="slider"]'))) {
      const cls = el.getAttribute('class') ?? '';
      expect(/min-h-\[44px\]|h-11/.test(cls), `${el.textContent} ${cls}`).toBe(true);
    }
    expect(sheet.textContent).not.toMatch(/\u2014/);
    expect(sheet.textContent).not.toMatch(/\bbeta\b/i);
    // Report/block stays under the three-dots menu, not on the sheet face.
    expect(sheet.textContent).not.toMatch(/\b(report|block)\b/i);
  });

  it.each<Theme>(['light', 'dark'])('follows the theme: text >= 4.5:1 and icons >= 3:1 (%s)', (theme) => {
    renderSheet({ ...mockSpot, has_active_checkins: true, live_count: 2 });
    const sheet = screen.getByTestId('hotspot-sheet');
    expect(hardcodedColourClasses(sheet)).toEqual([]);
    for (const id of ['hotspot-sheet-type', 'hotspot-sheet-meta', 'hotspot-sheet-checkin', 'hotspot-sheet-checkin-anon', 'hotspot-sheet-directions', 'hotspot-sheet-reviews-btn', 'hotspot-sheet-brand-face']) {
      expect(contrast(screen.getByTestId(id), theme), `${id} (${theme})`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(screen.getByTestId('hotspot-sheet-activity').querySelector('p')!, theme)).toBeGreaterThanOrEqual(4.5);
    for (const svg of Array.from(sheet.querySelectorAll('svg'))) {
      const host = svg.getAttribute('class')?.includes('text-[') ? svg : (svg.closest('[class*="text-["]') as Element);
      expect(contrast(host, theme), `icon (${theme})`).toBeGreaterThanOrEqual(3);
    }
  });
});
