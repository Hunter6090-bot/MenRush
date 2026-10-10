/**
 * Standard open frame for 1:1 chat photo viewer.
 * Every opened image (tiny or huge) fits this box with object-fit: contain.
 * Pinch-zoom is out of scope.
 */
export const CHAT_IMAGE_VIEWER_FRAME = {
  /** CSS width — phone-safe, capped on desktop */
  width: 'min(90vw, 720px)',
  /** CSS height — leaves room for Back/Close chrome + safe areas */
  height: 'min(75vh, 640px)',
  maxWidth: '90vw',
  maxHeight: '75vh',
} as const;

/** Fraction of viewport the frame must stay within (e2e / sanity). */
export const CHAT_IMAGE_VIEWER_FRAME_BOUNDS = {
  maxWidthRatio: 0.9,
  maxHeightRatio: 0.8,
  minWidthPx: 160,
  minHeightPx: 160,
} as const;
