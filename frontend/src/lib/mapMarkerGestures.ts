/**
 * HTML Mapbox markers sit above the GL canvas. A touch that starts on a pin
 * never reaches Mapbox dragPan / touchZoomRotate — the map feels sticky and
 * "not movable" exactly where people are (the dense part of Nearby).
 *
 * #216 set touch-action / user-select on markers but did not forward drag or
 * pinch onto the map. This module does.
 */
import type { Map as MapboxMap } from 'mapbox-gl';

const DRAG_THRESHOLD_PX = 6;

export type MarkerGestureMap = Pick<MapboxMap, 'panBy' | 'getZoom' | 'setZoom'>;

export type MarkerGestureOptions = {
  /** Fired once when the user starts panning/pinching from this pin. */
  onNavigate?: () => void;
  /**
   * Shared flag so the marker's click handler can ignore the synthetic click
   * that browsers fire after a drag/pinch.
   */
  suppressClickRef?: { current: boolean };
  dragThresholdPx?: number;
};

/**
 * Forward one-finger pan and two-finger pinch from an HTML marker onto Mapbox.
 * Returns an unwire function.
 */
export function wireHtmlMarkerMapGestures(
  el: HTMLElement,
  map: MarkerGestureMap,
  options: MarkerGestureOptions = {},
): () => void {
  const threshold = options.dragThresholdPx ?? DRAG_THRESHOLD_PX;
  let mode: 'idle' | 'pending' | 'pan' | 'pinch' = 'idle';
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastPinchDist = 0;
  let lastPinchMidX = 0;
  let lastPinchMidY = 0;
  let navigated = false;

  const markNavigate = () => {
    if (!navigated) {
      navigated = true;
      options.onNavigate?.();
    }
    if (options.suppressClickRef) options.suppressClickRef.current = true;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length >= 2) {
      mode = 'pinch';
      const a = e.touches[0];
      const b = e.touches[1];
      lastPinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      lastPinchMidX = (a.clientX + b.clientX) / 2;
      lastPinchMidY = (a.clientY + b.clientY) / 2;
      markNavigate();
      e.preventDefault();
      return;
    }
    if (e.touches.length === 1) {
      mode = 'pending';
      navigated = false;
      if (options.suppressClickRef) options.suppressClickRef.current = false;
      startX = lastX = e.touches[0].clientX;
      startY = lastY = e.touches[0].clientY;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length >= 2) {
      const a = e.touches[0];
      const b = e.touches[1];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const midX = (a.clientX + b.clientX) / 2;
      const midY = (a.clientY + b.clientY) / 2;

      if (mode !== 'pinch') {
        mode = 'pinch';
        lastPinchDist = dist;
        lastPinchMidX = midX;
        lastPinchMidY = midY;
        markNavigate();
      } else if (lastPinchDist > 0) {
        const scale = dist / lastPinchDist;
        if (Number.isFinite(scale) && scale > 0 && scale !== 1) {
          map.setZoom(map.getZoom() + Math.log2(scale));
        }
        const dx = midX - lastPinchMidX;
        const dy = midY - lastPinchMidY;
        if (dx !== 0 || dy !== 0) {
          map.panBy([-dx, -dy], { animate: false });
        }
        lastPinchDist = dist;
        lastPinchMidX = midX;
        lastPinchMidY = midY;
        markNavigate();
      }
      e.preventDefault();
      return;
    }

    if (e.touches.length === 1 && (mode === 'pending' || mode === 'pan')) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      if (mode === 'pending') {
        if (Math.hypot(x - startX, y - startY) < threshold) return;
        mode = 'pan';
        markNavigate();
      }
      const dx = x - lastX;
      const dy = y - lastY;
      lastX = x;
      lastY = y;
      if (dx !== 0 || dy !== 0) {
        map.panBy([-dx, -dy], { animate: false });
      }
      e.preventDefault();
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length === 0) {
      mode = 'idle';
      lastPinchDist = 0;
      return;
    }
    if (e.touches.length === 1) {
      mode = 'pending';
      lastX = startX = e.touches[0].clientX;
      lastY = startY = e.touches[0].clientY;
      lastPinchDist = 0;
    }
  };

  const onClickCapture = (e: MouseEvent) => {
    if (options.suppressClickRef?.current) {
      e.preventDefault();
      e.stopPropagation();
      options.suppressClickRef.current = false;
    }
  };

  el.style.touchAction = 'none';
  el.dataset.mapGestureWired = '1';
  el.addEventListener('touchstart', onTouchStart, { passive: false });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', onTouchEnd);
  el.addEventListener('touchcancel', onTouchEnd);
  el.addEventListener('click', onClickCapture, true);

  return () => {
    delete el.dataset.mapGestureWired;
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('touchcancel', onTouchEnd);
    el.removeEventListener('click', onClickCapture, true);
  };
}

/** Pure helper for tests — did movement clear the tap→drag threshold? */
export function exceedsDragThreshold(
  startX: number,
  startY: number,
  x: number,
  y: number,
  thresholdPx = DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(x - startX, y - startY) >= thresholdPx;
}
