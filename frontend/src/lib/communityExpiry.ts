export const COMMUNITY_POST_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isCommunityPostFresh(createdAt: string | number | Date, now: number = Date.now()): boolean {
  const time = typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return false;
  const ageMs = now - time;
  return ageMs >= 0 && ageMs < COMMUNITY_POST_EXPIRY_MS;
}
