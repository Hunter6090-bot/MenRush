/** Shared MenRush brand assets (public/brand/). */
/**
 * Master plate on disk (resize source via brand:sync-logo). Black-plate RGB —
 * never use for UI chrome. Brand + Zoul lock: chrome uses the cutout only.
 */
export const BRAND_LOGO_MASTER = '/brand/menrush-logo.png';
/**
 * Official UI medallion — transparent cutout only (circle, no black square).
 * Brand + Zoul lock: every BrandMark / header / hero chrome mark uses this path.
 * Do not point chrome at menrush-logo.png / menrush-logo-512.png / menrush-logo-192.png.
 */
export const BRAND_MEDALLION = '/brand/medallion-transparent.png';
/** Same cutout at compact sizes (CSS scales; one official asset). */
export const BRAND_MEDALLION_SMALL = '/brand/medallion-transparent.png';
/**
 * Empty-face cutout alias — same official file as BrandMark.
 * Nearby / Messages empty slots only — never wipe /uploads.
 */
export const BRAND_MEDALLION_CUTOUT = '/brand/medallion-transparent.png';

export const BRAND_ICON_512 = '/brand/icon-512.png';
export const BRAND_ICON_192 = '/brand/icon-192.png';
export const BRAND_ICON_48 = '/brand/icon-48.png';
export const BRAND_ICON_32 = '/brand/icon-32.png';
