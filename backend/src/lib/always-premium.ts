/**
 * Owner accounts that must never lose Premium entitlement.
 *
 * The repo is public, so no member id, name or email lives in code. The
 * owner accounts are set on the server as comma-separated user ids:
 *
 *   ALWAYS_PREMIUM_USER_IDS   owners who always have Premium (and Travel)
 *   TRAVEL_OWNER_USER_IDS     optional extra ids that get Travel only
 *
 * Unset or empty means no owner perks (safe default). Anything that is not a
 * UUID is ignored, so a typo can never widen the list. Read on every call so
 * an env change applies without a code change.
 */

export const ALWAYS_PREMIUM_ENV = 'ALWAYS_PREMIUM_USER_IDS';
export const TRAVEL_OWNER_ENV = 'TRAVEL_OWNER_USER_IDS';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Parse a comma-separated id list: trimmed, lower-case, UUIDs only, no repeats. */
export function parseUserIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim().toLowerCase();
    if (UUID_RE.test(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function alwaysPremiumUserIds(env: NodeJS.ProcessEnv = process.env): string[] {
  return parseUserIdList(env[ALWAYS_PREMIUM_ENV]);
}

/** Owners with the Travel bypass: always-Premium owners plus any Travel-only ids. */
export function travelOwnerUserIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const ids = alwaysPremiumUserIds(env);
  for (const id of parseUserIdList(env[TRAVEL_OWNER_ENV])) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function isAlwaysPremiumUserId(
  userId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!userId) return false;
  return alwaysPremiumUserIds(env).includes(String(userId).trim().toLowerCase());
}

export function isTravelOwnerUserId(
  userId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!userId) return false;
  return travelOwnerUserIds(env).includes(String(userId).trim().toLowerCase());
}
