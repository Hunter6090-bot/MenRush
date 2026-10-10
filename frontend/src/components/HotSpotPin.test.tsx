import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createHotSpotPinElement, HotSpotPin } from './HotSpotPin';
import { markerRootBreaksGeographicPlacement } from '../lib/mapMarkerPlacement';

afterEach(() => {
  cleanup();
});

function lum(hex: string): number {
  const c = hex.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
function rgbToHex(rgb: string): string {
  if (rgb.startsWith('#')) return rgb.toUpperCase();
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

describe('HotSpotPin spot-type icons (no emoji)', () => {
  it.each([
    ['sauna', 'Sauna', 'sauna'],
    ['parking-areas', 'Parking areas', 'parking'],
    ['open-spaces', 'Open spaces', 'open-space'],
    ['bars', 'Bar', 'bar'],
  ])('%s pin draws the %s line icon', (slug, name, key) => {
    render(<HotSpotPin spot={{ id: `s-${slug}`, name: 'Spot', category_icon: '🅿️', category_slug: slug, category_name: name, live_count: 0 }} />);
    const icon = screen.getByTestId('hotspot-category-icon');
    expect(icon.getAttribute('data-spot-icon')).toBe(key);
    expect(screen.getByTestId('hotspot-pin-dim').textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    cleanup();
  });

  it.each([
    ['empty', 0],
    ['occupied', 6],
  ])('%s pin icon is >= 3:1 on its disc, so it reads on light and dark maps', (_label, n) => {
    render(<HotSpotPin spot={{ id: 'c', name: 'Spot', category_slug: 'sauna', category_name: 'Sauna', live_count_exact: n, live_count: n }} />);
    const disc = screen.getByTestId('hotspot-pin-disc') as HTMLElement;
    const fg = rgbToHex(disc.style.color);
    const bg = rgbToHex(disc.style.background || disc.style.backgroundColor);
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
    // Copper rim vs a light map (#F2EFE9) and a dark map (#1A1A1A) stays visible (>= 3:1 on one side, disc on the other).
    expect(ratio(bg, '#F2EFE9')).toBeGreaterThanOrEqual(3);
    expect(ratio('#F0E0C0', '#1A1A1A')).toBeGreaterThanOrEqual(3);
    cleanup();
  });
});

describe('HotSpotPin', () => {
  it('shows venue name, approximate count, and category icon when occupied', () => {
    render(
      <HotSpotPin
        spot={{
          id: 'spot-1',
          name: 'Heaven',
          category_icon: '🪩',
          category_slug: 'nightlife',
          category_name: 'Nightlife',
          live_count_exact: 6,
          live_count: '5+',
        }}
      />,
    );

    expect(screen.getByTestId('hotspot-pin-solid')).toBeInTheDocument();
    expect(screen.getByTestId('hotspot-pin-name')).toHaveTextContent('Heaven');
    expect(screen.getByTestId('hotspot-pin-count')).toHaveTextContent('5+');
    const icon = screen.getByTestId('hotspot-category-icon');
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon.getAttribute('data-spot-icon')).toBe('nightlife');
    // Copper line icon, never the server emoji.
    expect(screen.getByTestId('hotspot-pin-solid').textContent).not.toContain('🪩');
    expect(screen.queryByTestId('cruise-ship-icon')).not.toBeInTheDocument();
  });

  it('shows Cruise pin label when empty and falls back to cruise-ship icon without a category icon', () => {
    render(
      <HotSpotPin
        spot={{
          id: 'spot-2',
          name: 'Quiet Venue',
          live_count_exact: 0,
          live_count: 0,
        }}
      />,
    );

    expect(screen.getByTestId('hotspot-pin-dim')).toBeInTheDocument();
    expect(screen.queryByTestId('hotspot-pin-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('cruise-pin-label')).toHaveTextContent('Cruise');
    expect(screen.getByTestId('cruise-ship-icon')).toBeInTheDocument();
  });


  it('hides name label when showLabel is false (zoomed-out piles)', () => {
    render(
      <HotSpotPin
        spot={{
          id: 'spot-3',
          name: 'Heaven',
          live_count_exact: 6,
          live_count: '5+',
        }}
        showLabel={false}
      />,
    );
    expect(screen.getByTestId('hotspot-pin-solid')).toBeInTheDocument();
    expect(screen.queryByTestId('hotspot-pin-name')).not.toBeInTheDocument();
  });

  it('Free pin shows the rounded 5+ from the server with no exact count', () => {
    render(
      <HotSpotPin
        spot={{
          id: 'spot-free',
          name: 'Sauna',
          live_count_exact: null,
          live_count: '5+',
          has_active_checkins: true,
        }}
      />,
    );
    expect(screen.getByTestId('hotspot-pin-solid')).toBeInTheDocument();
    expect(screen.getByTestId('hotspot-pin-count')).toHaveTextContent('5+');
    expect(screen.getByTestId('hotspot-pin-solid').getAttribute('title')).toBe('Sauna · 5+ checked in');
  });

  it('never derives a number from live_count_exact when no display count is sent', () => {
    render(
      <HotSpotPin
        spot={{ id: 'spot-x', name: 'Park', live_count_exact: 7, has_active_checkins: true }}
      />,
    );
    const pin = screen.getByTestId('hotspot-pin-solid');
    expect(screen.getByTestId('hotspot-pin-count').textContent).toBe('');
    expect(pin.textContent ?? '').not.toMatch(/\d/);
    expect(pin.getAttribute('title')).toBe('Park · Active now');
  });

  it('Premium pin shows the exact server count', () => {
    render(
      <HotSpotPin
        spot={{ id: 'spot-p', name: 'Bar', live_count_exact: 12, live_count: 12, has_active_checkins: true }}
      />,
    );
    expect(screen.getByTestId('hotspot-pin-count')).toHaveTextContent('12');
  });

  it('keeps Mapbox marker root free of position:relative (no zoomed-out vertical stack)', async () => {
    const { element, root } = createHotSpotPinElement(
      { id: 'spot-geo', name: 'Geo Lock', live_count_exact: 0, live_count: 0 },
      () => undefined,
      52,
    );
    try {
      // Root style is set synchronously before React paints — this is the Mapbox contract.
      expect(markerRootBreaksGeographicPlacement(element.style)).toBe(false);
      expect(element.style.position).toBe('');
      expect(element.style.display).toBe('flex');
      // Wait a tick for createRoot to mount the inner face.
      await new Promise((r) => setTimeout(r, 0));
      expect(element.querySelector('[data-cruise-pin="1"]')).not.toBeNull();
    } finally {
      root.unmount();
    }
  });
});
