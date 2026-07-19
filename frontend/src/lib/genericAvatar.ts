const TRIBE_LEAN = new Set(['Twink', 'Twunk', 'Jock']);
const TRIBE_BEAR = new Set(['Bear', 'Cub', 'Daddy', 'Leather']);

const BODY_SLIM = new Set(['Slim', 'Athletic', 'Smooth']);
const BODY_STOCKY = new Set(['Chubby', 'Hairy', 'Stocky']);

/** Small preset pool — users with similar age, tribe & body tags share the same avatar. */
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

export type PhotoChoice = 'upload' | 'generic';

export function isGenericAvatarUrl(url?: string | null): boolean {
  return Boolean(url?.startsWith('/avatars/generic/'));
}

function ageBucket(age?: number): 'young' | 'mid' | 'mature' {
  if (age == null || age < 30) return 'young';
  if (age < 45) return 'mid';
  return 'mature';
}

function tribeBucket(interests: string[]): 'lean' | 'classic' | 'bear' {
  if (interests.some((tag) => TRIBE_BEAR.has(tag))) return 'bear';
  if (interests.some((tag) => TRIBE_LEAN.has(tag))) return 'lean';
  return 'classic';
}

function bodyBucket(interests: string[]): 'slim' | 'built' | 'stocky' {
  if (interests.some((tag) => BODY_SLIM.has(tag))) return 'slim';
  if (interests.some((tag) => BODY_STOCKY.has(tag))) return 'stocky';
  return 'built';
}

/** Pick a shared generic avatar from coarse age / tribe / body signals. */
export function resolveGenericAvatarUrl(input: {
  age?: number;
  interests: string[];
}): string {
  const ageIdx = { young: 0, mid: 1, mature: 2 }[ageBucket(input.age)];
  const tribeIdx = { lean: 0, classic: 1, bear: 2 }[tribeBucket(input.interests)];
  const bodyIdx = { slim: 0, built: 1, stocky: 2 }[bodyBucket(input.interests)];
  const index = (ageIdx * 4 + tribeIdx * 2 + bodyIdx) % GENERIC_AVATAR_VARIANTS.length;
  return GENERIC_AVATAR_VARIANTS[index];
}

export function hasProfileAvatar(profile: { photo_url?: string | null }): boolean {
  return Boolean(profile.photo_url?.trim());
}