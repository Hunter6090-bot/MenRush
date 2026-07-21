/**
 * Shared generic avatar pool — mirrors frontend/src/lib/genericAvatar.ts.
 * Paths are public static assets served by the frontend origin.
 * Used to keep map density alive when a man has not uploaded a photo yet.
 *
 * SAFETY: Changing avatar artwork = replace files under /avatars/generic/*.svg only.
 * Never mass-UPDATE users.photo_url. Custom uploads (/uploads/...) must stay untouched.
 * ensureDefaultAvatar only writes when photo_url is NULL/empty.
 */

export const GENERIC_AVATAR_VARIANTS = [
  '/avatars/generic/01.svg',
  '/avatars/generic/02.svg',
  '/avatars/generic/03.svg',
  '/avatars/generic/04.svg',
  '/avatars/generic/05.svg',
  '/avatars/generic/06.svg',
  '/avatars/generic/07.svg',
  '/avatars/generic/08.svg',
  '/avatars/generic/09.svg',
  '/avatars/generic/10.svg',
  '/avatars/generic/11.svg',
  '/avatars/generic/12.svg',
] as const;

function ageBucket(age?: number | null): 'young' | 'mid' | 'mature' {
  if (age == null || age < 30) return 'young';
  if (age < 45) return 'mid';
  return 'mature';
}

/** Age-only default when tribe/body tags are not known yet. */
export function defaultGenericAvatarUrl(age?: number | null): string {
  const ageIdx = { young: 0, mid: 1, mature: 2 }[ageBucket(age)];
  // Stable subset so similar ages share a look; 4 variants per age band.
  const index = (ageIdx * 4) % GENERIC_AVATAR_VARIANTS.length;
  return GENERIC_AVATAR_VARIANTS[index];
}

export function isGenericAvatarUrl(url?: string | null): boolean {
  return Boolean(url?.startsWith('/avatars/generic/'));
}
