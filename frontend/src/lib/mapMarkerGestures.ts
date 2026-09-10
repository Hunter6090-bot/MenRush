/**
 * @deprecated Soft continuous Nearby pan/pinch (Android Chrome + iPhone) requires
 * the Mapbox canvas to own touches. HTML marker → panBy forwarding (PR #224) cannot
 * deliver native inertia on either platform. Use mapMarkerHitTest.ts +
 * pointer-events:none markers instead.
 */
export {
  hitTestMapPins,
  markMarkerCanvasPassThrough,
  peoplePinHitRadiusPx,
  hotSpotPinHitRadiusPx,
  selfPinHitRadiusPx,
} from './mapMarkerHitTest';
