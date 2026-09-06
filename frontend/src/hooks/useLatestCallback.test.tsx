import { useEffect, useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLatestCallback } from './useLatestCallback';

describe('stable GPS handlers', () => {
  it('does not restart initial discovery when GPS updates the map, and reads new filters', () => {
    const requestNearby = vi.fn();
    const startWatch = vi.fn();
    const clearWatch = vi.fn();
    let gps: (latitude: number) => void = () => {};
    const { result, rerender, unmount } = renderHook(({ radius }) => {
      const [center, setCenter] = useState<number[] | null>(null);
      const onGps = useLatestCallback((latitude: number) => {
        setCenter([latitude]);
        requestNearby(latitude, radius);
      });
      useEffect(() => {
        startWatch();
        gps = onGps;
        onGps(51); // initial GPS fix forces discovery and changes map state
        return clearWatch;
      }, [onGps]);
      return center;
    }, { initialProps: { radius: 5 } });
    expect(result.current).toEqual([51]);
    expect(startWatch).toHaveBeenCalledTimes(1);
    expect(requestNearby).toHaveBeenCalledTimes(1);
    rerender({ radius: 10 });
    act(() => gps(52));
    expect(result.current).toEqual([52]);
    expect(requestNearby).toHaveBeenLastCalledWith(52, 10);
    expect(startWatch).toHaveBeenCalledTimes(1);
    expect(clearWatch).not.toHaveBeenCalled();
    unmount();
    expect(clearWatch).toHaveBeenCalledTimes(1);
  });
});
