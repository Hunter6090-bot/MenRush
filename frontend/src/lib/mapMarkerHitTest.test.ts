import { describe, expect, it } from 'vitest';
import {
  hitTestMapPins,
  peoplePinHitRadiusPx,
  hotSpotPinHitRadiusPx,
  markMarkerCanvasPassThrough,
  type MapProjectable,
} from './mapMarkerHitTest';

function fakeMap(points: Record<string, { x: number; y: number }>): MapProjectable {
  return {
    project: (lngLat) => {
      const lng = Array.isArray(lngLat) ? lngLat[0] : lngLat.lng;
      const lat = Array.isArray(lngLat) ? lngLat[1] : lngLat.lat;
      const key = `${lng},${lat}`;
      return points[key] ?? { x: 0, y: 0 };
    },
  };
}

describe('hitTestMapPins', () => {
  it('returns null when the tap misses every pin', () => {
    const map = fakeMap({ '-74,40': { x: 100, y: 100 } });
    const hit = hitTestMapPins(map, { x: 200, y: 200 }, [
      { kind: 'person', id: 'a', lng: -74, lat: 40, radiusPx: 28 },
    ]);
    expect(hit).toBeNull();
  });

  it('picks the nearest pin when several overlap', () => {
    const map = fakeMap({
      '-74,40': { x: 100, y: 100 },
      '-74.1,40.1': { x: 110, y: 100 },
    });
    const hit = hitTestMapPins(map, { x: 104, y: 100 }, [
      { kind: 'person', id: 'far', lng: -74.1, lat: 40.1, radiusPx: 40 },
      { kind: 'person', id: 'near', lng: -74, lat: 40, radiusPx: 40 },
    ]);
    expect(hit?.id).toBe('near');
    expect(hit?.distancePx).toBeLessThan(10);
  });

  it('respects each pin hit radius', () => {
    const map = fakeMap({ '-74,40': { x: 100, y: 100 } });
    expect(
      hitTestMapPins(map, { x: 130, y: 100 }, [
        { kind: 'person', id: 'a', lng: -74, lat: 40, radiusPx: 28 },
      ]),
    ).toBeNull();
    expect(
      hitTestMapPins(map, { x: 130, y: 100 }, [
        { kind: 'hotspot', id: 'b', lng: -74, lat: 40, radiusPx: 40 },
      ])?.id,
    ).toBe('b');
  });
});

describe('pin hit radii', () => {
  it('sizes people and cruise pins for tap without blocking canvas', () => {
    expect(peoplePinHitRadiusPx(false)).toBeLessThan(peoplePinHitRadiusPx(true));
    expect(hotSpotPinHitRadiusPx(false)).toBeLessThan(hotSpotPinHitRadiusPx(true));
  });
});

describe('markMarkerCanvasPassThrough', () => {
  it('forces pointer-events none on the marker and descendants', () => {
    const el = document.createElement('div');
    const child = document.createElement('img');
    child.style.pointerEvents = 'auto';
    el.appendChild(child);
    markMarkerCanvasPassThrough(el);
    expect(el.dataset.mapCanvasPassThrough).toBe('1');
    expect(el.style.pointerEvents).toBe('none');
    expect(child.style.pointerEvents).toBe('none');
  });
});
