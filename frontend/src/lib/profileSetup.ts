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

import { hasProfileAvatar } from './genericAvatar';

export const PROFILE_SETUP_STEPS = [
  { id: 'photo', label: 'Photo or avatar' },
  { id: 'about', label: 'Bio & headline' },
  { id: 'looking', label: 'What you want' },
  { id: 'tags', label: 'Your tags' },
  { id: 'live', label: 'Go live' },
] as const;

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

/** Redirect to /profile/setup when true. Skip only counts after an avatar exists. */
export function needsProfileSetupRedirect(profile: ProfileSetupSnapshot): boolean {
  if (!isDiscoverAvatarReady(profile)) return true;
  if (isProfileSetupComplete(profile)) return false;
  return !hasSkippedProfileSetup();
}

export type ActivationBlocker = 'avatar' | 'location' | 'bio' | 'looking' | 'tags';

export function activationBlockers(profile: ProfileSetupSnapshot): ActivationBlocker[] {
  const blockers: ActivationBlocker[] = [];
  if (!isDiscoverAvatarReady(profile)) blockers.push('avatar');
  if (!isDiscoverLocationReady(profile)) blockers.push('location');
  if ((profile.bio?.trim().length ?? 0) < 20) blockers.push('bio');
  if (!profile.looking_for?.trim()) blockers.push('looking');
  if ((profile.interests?.length ?? 0) < 3) blockers.push('tags');
  return blockers;
}

export function profileSetupProgress(profile: ProfileSetupSnapshot): number {
  let done = 0;
  if (hasProfileAvatar(profile)) done++;
  if ((profile.bio?.trim().length ?? 0) >= 20) done++;
  if (profile.looking_for?.trim()) done++;
  if ((profile.interests?.length ?? 0) >= 3) done++;
  return Math.round((done / PROFILE_SETUP_STEPS.length) * 100);
}