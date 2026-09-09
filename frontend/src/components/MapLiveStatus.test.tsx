import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapLiveStatus } from './MapLiveStatus';

describe('MapLiveStatus', () => {
  it('shows nearby headcount without painting it as Live when nobody is online', () => {
    render(
      <MapLiveStatus nearbyCount={46} liveCount={0} radiusKm={161} onExpandRadius={() => {}} />,
    );
    expect(screen.getByTestId('map-live-status')).toHaveAttribute('data-nearby-count', '46');
    expect(screen.getByTestId('map-live-status')).toHaveAttribute('data-live-count', '0');
    expect(screen.getByText('46 nearby')).toBeInTheDocument();
    expect(screen.getByTestId('map-live-line')).toHaveTextContent('None live now');
    expect(screen.queryByText(/Live ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Live · All/)).not.toBeInTheDocument();
  });

  it('shows green Live · N only for online-now count', () => {
    render(
      <MapLiveStatus nearbyCount={46} liveCount={3} radiusKm={8} onExpandRadius={() => {}} />,
    );
    expect(screen.getByTestId('map-live-line')).toHaveTextContent('Live · 3');
    expect(screen.getByTestId('map-live-status')).toHaveAttribute('data-live-count', '3');
  });

  it('offers Expand radius when nearby is empty and not already at max', () => {
    const onExpand = vi.fn();
    render(
      <MapLiveStatus nearbyCount={0} liveCount={0} radiusKm={8} onExpandRadius={onExpand} />,
    );
    screen.getByRole('button', { name: /Expand radius/i }).click();
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});
