export const PROFILE_SETUP_SKIP_KEY = 'menrush_profile_setup_skipped';

export interface ProfileSetupSnapshot {
  photo_url?: string | null;
  bio?: string | null;
  headline?: string | null;
  looking_for?: string | null;
  interests?: string[] | null;
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

export function profileSetupProgress(profile: ProfileSetupSnapshot): number {
  let done = 0;
  if (hasProfileAvatar(profile)) done++;
  if ((profile.bio?.trim().length ?? 0) >= 20) done++;
  if (profile.looking_for?.trim()) done++;
  if ((profile.interests?.length ?? 0) >= 3) done++;
  return Math.round((done / PROFILE_SETUP_STEPS.length) * 100);
}