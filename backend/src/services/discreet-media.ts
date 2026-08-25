/**
 * Discreet Mode media blur (owner-account test).
 *
 * When DISCREET_MEDIA_BLUR=true, non-Premium viewers receive media_clear=false
 * on others' photos/videos so the client can apply a soft CSS blur.
 * Default is off — no production hard-lock on the live public site.
 *
 * Incognito/presence toggle logic lives elsewhere and is intentionally untouched.
 */

import { premiumService } from './premium.service';

export function isDiscreetMediaBlurEnabled(): boolean {
  return String(process.env.DISCREET_MEDIA_BLUR || '').toLowerCase() === 'true';
}

/**
 * Pure policy: whether this viewer may see this visual media unblurred.
 * Audio/location and own media are always clear. Feature off → always clear.
 */
export function computeMediaClear(opts: {
  enabled: boolean;
  viewerIsPremium: boolean;
  isOwnMedia: boolean;
  mediaType: string | null | undefined;
}): boolean {
  if (!opts.enabled) return true;
  const kind = opts.mediaType ?? null;
  if (kind !== 'image' && kind !== 'video') return true;
  if (opts.isOwnMedia) return true;
  return opts.viewerIsPremium;
}

/** Verified backend Premium check for the viewer (respects BETA_PREMIUM_FREE). */
export async function viewerSeesClearMedia(viewerId: string): Promise<boolean> {
  if (!isDiscreetMediaBlurEnabled()) return true;
  return premiumService.isPremium(viewerId);
}
