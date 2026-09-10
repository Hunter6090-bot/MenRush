/**
 * @deprecated Soft continuous Nearby pan/pinch requires the Mapbox canvas to own
 * touches. HTML marker → panBy forwarding (PR #224) cannot deliver native inertia.
 * Use mapMarkerHitTest.ts + pointer-events:none markers instead.
 *
 * This file remains only so old imports fail loudly in review — prefer deleting
 * call sites. Kept temporarily with the hit-test re-exports removed.
 */
export {
  hitTestMapPins,
  markMarkerCanvasPassThrough,
  peoplePinHitRadiusPx,
  hotSpotPinHitRadiusPx,
  selfPinHitRadiusPx,
} from './mapMarkerHitTest';
