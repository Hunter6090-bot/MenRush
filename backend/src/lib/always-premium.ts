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

export type OwnerListStatus = { alwaysPremium: number; travelOnly: number; ignored: number };

/** Counts only: valid ids in each list and entries ignored as not-a-UUID. Never the ids. */
export function ownerListStatus(env: NodeJS.ProcessEnv = process.env): OwnerListStatus {
  const entries = (raw: string | undefined) => (raw ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  const premium = alwaysPremiumUserIds(env);
  const travel = parseUserIdList(env[TRAVEL_OWNER_ENV]).filter((id) => !premium.includes(id));
  const invalid = [...entries(env[ALWAYS_PREMIUM_ENV]), ...entries(env[TRAVEL_OWNER_ENV])].filter(
    (p) => !UUID_RE.test(p.toLowerCase()),
  ).length;
  return { alwaysPremium: premium.length, travelOnly: travel.length, ignored: invalid };
}

/**
 * One startup line, counts only. A warning when ALWAYS_PREMIUM_USER_IDS has no valid id, since
 * then no owner account is protected from losing Premium.
 */
export function ownerListStartupLine(env: NodeJS.ProcessEnv = process.env): { level: 'warn' | 'log'; text: string } {
  const s = ownerListStatus(env);
  const counts = `always_premium=${s.alwaysPremium} travel_only=${s.travelOnly} ignored=${s.ignored}`;
  if (s.alwaysPremium === 0) {
    return {
      level: 'warn',
      text: `[owners] WARNING: ${ALWAYS_PREMIUM_ENV} has no valid user id, so no owner account is protected from losing Premium (${counts}).`,
    };
  }
  return { level: 'log', text: `[owners] ${counts}` };
}
