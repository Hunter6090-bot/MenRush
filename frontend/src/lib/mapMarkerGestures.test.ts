import { describe, expect, it, vi } from 'vitest';
import {
  exceedsDragThreshold,
  wireHtmlMarkerMapGestures,
  type MarkerGestureMap,
} from './mapMarkerGestures';

function fakeMap(): MarkerGestureMap & { zoom: number; pans: Array<[number, number]> } {
  const state = { zoom: 14, pans: [] as Array<[number, number]> };
  return {
    get zoom() {
      return state.zoom;
    },
    get pans() {
      return state.pans;
    },
    getZoom: () => state.zoom,
    setZoom: (z: number) => {
      state.zoom = z;
    },
    panBy: (offset: [number, number]) => {
      state.pans.push(offset);
    },
  };
}

function touch(x: number, y: number): Touch {
  return {
    clientX: x,
    clientY: y,
    identifier: 0,
    pageX: x,
    pageY: y,
    screenX: x,
    screenY: y,
    radiusX: 1,
    radiusY: 1,
    rotationAngle: 0,
    force: 1,
    target: document.body,
  } as Touch;
}

function fireTouch(
  el: HTMLElement,
  type: 'touchstart' | 'touchmove' | 'touchend',
  touches: Touch[],
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: touches });
  Object.defineProperty(event, 'changedTouches', { value: touches });
  el.dispatchEvent(event);
}

describe('exceedsDragThreshold', () => {
  it('treats small jitter as a tap', () => {
    expect(exceedsDragThreshold(100, 100, 103, 102)).toBe(false);
  });

  it('treats movement past threshold as a drag', () => {
    expect(exceedsDragThreshold(100, 100, 110, 100)).toBe(true);
  });
});

describe('wireHtmlMarkerMapGestures', () => {
  it('forwards one-finger drag onto map.panBy and marks the element wired', () => {
    const el = document.createElement('div');
    const map = fakeMap();
    const onNavigate = vi.fn();
    const suppressClickRef = { current: false };

    wireHtmlMarkerMapGestures(el, map, { onNavigate, suppressClickRef });
    expect(el.dataset.mapGestureWired).toBe('1');

    fireTouch(el, 'touchstart', [touch(50, 50)]);
    fireTouch(el, 'touchmove', [touch(50, 50)]); // under threshold — no pan yet
    expect(map.pans).toHaveLength(0);
    expect(onNavigate).not.toHaveBeenCalled();

    fireTouch(el, 'touchmove', [touch(50, 70)]); // past threshold
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(suppressClickRef.current).toBe(true);
    expect(map.pans.length).toBeGreaterThan(0);
    // Finger moved down → map content should move down (negative panBy y in screen space)
    const last = map.pans[map.pans.length - 1];
    expect(last[1]).toBeLessThan(0);
  });

  it('forwards two-finger pinch onto map.setZoom', () => {
    const el = document.createElement('div');
    const map = fakeMap();
    wireHtmlMarkerMapGestures(el, map);

    fireTouch(el, 'touchstart', [touch(40, 40), touch(60, 40)]);
    const zoomBefore = map.getZoom();
    fireTouch(el, 'touchmove', [touch(20, 40), touch(80, 40)]); // wider pinch → zoom in
    expect(map.getZoom()).toBeGreaterThan(zoomBefore);
  });
});
