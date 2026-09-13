import { beforeEach, describe, expect, it } from 'vitest';
import {
  HOTSPOTS_MAP_BANNER_DISMISS_KEY,
  dismissHotSpotsMapBanner,
  isHotSpotsMapBannerDismissed,
} from './hotSpotsMapBanner';
import { HOT_SPOTS_LEGAL_FACE, HOT_SPOTS_MAP_BANNER } from './cruiseCopy';

describe('hotSpotsMapBanner dismiss (Al order)', () => {
  beforeEach(() => {
    localStorage.removeItem(HOTSPOTS_MAP_BANNER_DISMISS_KEY);
  });

  it('starts unread / not dismissed', () => {
    expect(isHotSpotsMapBannerDismissed()).toBe(false);
  });

  it('persists dismiss so the banner does not nag every visit', () => {
    dismissHotSpotsMapBanner();
    expect(localStorage.getItem(HOTSPOTS_MAP_BANNER_DISMISS_KEY)).toBe('1');
    expect(isHotSpotsMapBannerDismissed()).toBe(true);
  });

  it('does not alter Legal quiet-face wording', () => {
    expect(HOT_SPOTS_MAP_BANNER).toBe(HOT_SPOTS_LEGAL_FACE);
    expect(HOT_SPOTS_MAP_BANNER).toBe(
      'Map spots include independent venues and outdoor locations. 18+ only. Follow the law and any venue rules. MenRush does not run these places. No illegal activity. Consent first.',
    );
  });
});
