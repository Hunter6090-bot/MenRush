import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HotSpotPin } from './HotSpotPin';

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

  it('hides name label when empty but still shows cruise-ship icon', () => {
    render(
      <HotSpotPin
        spot={{
          id: 'spot-2',
          name: 'Quiet Park',
          live_count_exact: 0,
          live_count: 0,
        }}
      />,
    );

    expect(screen.getByTestId('hotspot-pin-dim')).toBeInTheDocument();
    expect(screen.queryByTestId('hotspot-pin-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('cruise-ship-icon')).toBeInTheDocument();
  });
});
