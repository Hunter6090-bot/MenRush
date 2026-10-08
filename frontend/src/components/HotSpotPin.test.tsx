import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createHotSpotPinElement, HotSpotPin } from './HotSpotPin';
import { markerRootBreaksGeographicPlacement } from '../lib/mapMarkerPlacement';

afterEach(() => {
  cleanup();
});

describe('HotSpotPin', () => {
  it('shows venue name, approximate count, and category icon when occupied', () => {
    render(
      <HotSpotPin
        spot={{
          id: 'spot-1',
          name: 'Heaven',
          category_icon: '🪩',
          live_count_exact: 6,
          live_count: '5+',
        }}
      />,
    );

    expect(screen.getByTestId('hotspot-pin-solid')).toBeInTheDocument();
    expect(screen.getByTestId('hotspot-pin-name')).toHaveTextContent('Heaven');
    expect(screen.getByTestId('hotspot-pin-count')).toHaveTextContent('5+');
    expect(screen.getByTestId('hotspot-category-icon')).toHaveTextContent('🪩');
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
