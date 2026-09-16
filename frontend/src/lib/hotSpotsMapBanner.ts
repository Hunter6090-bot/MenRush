/**
 * One-time dismiss for the Hot Spots map Legal quiet-face banner.
 * Same localStorage pattern as match coach / pulse nudge / install prompt.
 * Copy itself stays in cruiseCopy.ts — this module only owns dismiss persistence.
 */
export const HOTSPOTS_MAP_BANNER_DISMISS_KEY = 'menrush_hotspots_map_banner_dismissed';

export function isHotSpotsMapBannerDismissed(): boolean {
  try {
    return localStorage.getItem(HOTSPOTS_MAP_BANNER_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissHotSpotsMapBanner(): void {
  try {
    localStorage.setItem(HOTSPOTS_MAP_BANNER_DISMISS_KEY, '1');
  } catch {
    /* private mode / quota */
  }
}
