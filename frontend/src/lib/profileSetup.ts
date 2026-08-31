export const PROFILE_SETUP_SKIP_KEY = 'menrush_profile_setup_skipped';

export interface ProfileSetupSnapshot {
  photo_url?: string | null;
  bio?: string | null;
  headline?: string | null;
  looking_for?: string | null;
  interests?: string[] | null;
  lat?: number | string | null;
  lng?: number | string | null;
}

import { hasProfileAvatar, isGenericAvatarUrl } from './genericAvatar';

export const PROFILE_SETUP_STEPS = [
  { id: 'photo', label: 'Photo or avatar' },
  { id: 'about', label: 'Bio & headline' },
  { id: 'looking', label: 'What you want' },
  { id: 'tags', label: 'Your tags' },
  { id: 'live', label: 'Go live' },
] as const;

export type ProfileSetupStepId = (typeof PROFILE_SETUP_STEPS)[number]['id'];

export function hasSkippedProfileSetup(): boolean {
  try {
    return localStorage.getItem(PROFILE_SETUP_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function skipProfileSetup(): void {
  try {
    localStorage.setItem(PROFILE_SETUP_SKIP_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearProfileSetupSkip(): void {
  try {
    localStorage.removeItem(PROFILE_SETUP_SKIP_KEY);
  } catch {
    /* ignore */
  }
}

/** Photo/avatar + bio≥20 + looking_for + ≥3 tags. Location is NOT part of profile completeness. */
export function isProfileSetupComplete(profile: ProfileSetupSnapshot): boolean {
  const hasAvatar = hasProfileAvatar(profile);
  const hasBio = (profile.bio?.trim().length ?? 0) >= 20;
  const hasLooking = Boolean(profile.looking_for?.trim());
  const tagCount = profile.interests?.length ?? 0;
  return hasAvatar && hasBio && hasLooking && tagCount >= 3;
}

/** Avatar required before Discover — photo or generic. */
export function isDiscoverAvatarReady(profile: ProfileSetupSnapshot): boolean {
  return hasProfileAvatar(profile);
}

export function isDiscoverLocationReady(profile: ProfileSetupSnapshot): boolean {
  const lat = profile.lat != null ? Number(profile.lat) : NaN;
  const lng = profile.lng != null ? Number(profile.lng) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/**
 * Minimum fields before Discover skip is allowed.
 * Avatar alone is not enough — hollow profiles kill match quality.
 * Bio (≥20 chars) is required so map cards have real intent, not ghost shells.
 * Location is intentionally excluded — GPS is a Nearby enablement, not profile depth.
 */
export function isDiscoverMinimumReady(profile: ProfileSetupSnapshot): boolean {
  return (
    isDiscoverAvatarReady(profile) &&
    (profile.bio?.trim().length ?? 0) >= 20 &&
    Boolean(profile.looking_for?.trim()) &&
    (profile.interests?.length ?? 0) >= 3
  );
}

/**
 * Redirect to /profile/setup when true.
 * Location / GPS is NEVER a hard setup redirect — missing pin is handled in-place on Discover.
 */
export function needsProfileSetupRedirect(profile: ProfileSetupSnapshot): boolean {
  if (!isDiscoverAvatarReady(profile)) return true;
  if (!isDiscoverMinimumReady(profile)) return true;
  // Profile fields done → stay on Discover even with no lat/lng.
  if (isProfileSetupComplete(profile)) return false;
  return !hasSkippedProfileSetup();
}

/** True when photo/bio/looking/tags are done and only GPS is missing. */
export function isLocationOnlyGap(profile: ProfileSetupSnapshot): boolean {
  return isProfileSetupComplete(profile) && !isDiscoverLocationReady(profile);
}

/** Honest per-step completion for the setup checklist (not decorative). */
export function isProfileSetupStepDone(
  stepId: ProfileSetupStepId,
  profile: ProfileSetupSnapshot,
): boolean {
  switch (stepId) {
    case 'photo':
      return isDiscoverAvatarReady(profile);
    case 'about':
      return (profile.bio?.trim().length ?? 0) >= 20;
    case 'looking':
      return Boolean(profile.looking_for?.trim());
    case 'tags':
      return (profile.interests?.length ?? 0) >= 3;
    case 'live':
      return isDiscoverLocationReady(profile);
    default:
      return false;
  }
}

export type ActivationBlocker = 'avatar' | 'location' | 'bio' | 'looking' | 'tags';

/** Profile-depth blockers only — never location. Use for "Finish profile" CTAs. */
export function profileFieldBlockers(profile: ProfileSetupSnapshot): ActivationBlocker[] {
  return activationBlockers(profile).filter((b) => b !== 'location');
}

export function activationBlockers(profile: ProfileSetupSnapshot): ActivationBlocker[] {
  const blockers: ActivationBlocker[] = [];
  if (!isDiscoverAvatarReady(profile)) blockers.push('avatar');
  if (!isDiscoverLocationReady(profile)) blockers.push('location');
  if ((profile.bio?.trim().length ?? 0) < 20) blockers.push('bio');
  if (!profile.looking_for?.trim()) blockers.push('looking');
  if ((profile.interests?.length ?? 0) < 3) blockers.push('tags');
  return blockers;
}

/** Shared generic avatar — soft upgrade, not a hard Discover gate. */
export function needsRealPhotoUpgrade(profile: ProfileSetupSnapshot): boolean {
  return isGenericAvatarUrl(profile.photo_url);
}

export function profileSetupProgress(profile: ProfileSetupSnapshot): number {
  // Setup steps + live location + real photo (generic counts as partial only).
  const total = PROFILE_SETUP_STEPS.length + 2;
  let done = 0;
  if (hasProfileAvatar(profile)) done++;
  if (hasProfileAvatar(profile) && !isGenericAvatarUrl(profile.photo_url)) done++;
  if ((profile.bio?.trim().length ?? 0) >= 20) done++;
  if (profile.looking_for?.trim()) done++;
  if ((profile.interests?.length ?? 0) >= 3) done++;
  if (isDiscoverLocationReady(profile)) done++;
  return Math.round((done / total) * 100);
}
