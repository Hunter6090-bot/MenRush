import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createHotSpotPinElement, HotSpotPin } from './HotSpotPin';
import { markerRootBreaksGeographicPlacement } from '../lib/mapMarkerPlacement';

afterEach(() => {
  cleanup();
});

describe('HotSpotPin', () => {
  it('shows venue name, approximate count, and cruise-ship icon when occupied', () => {
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
    expect(screen.getByTestId('cruise-ship-icon')).toBeInTheDocument();
  });

  it('shows Cruise pin label when empty and still shows cruise-ship icon', () => {
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
