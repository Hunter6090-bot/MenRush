/**
 * Room-scoped display identity — never emit canonical profile name/photo.
 * Gate requires a temporary display name before join; photo is optional.
 * Kept free of DB imports so unit tests can run without Postgres.
 */

/** Soft TTL for saved room temp identities (strategy 3). Unsaved wipe on leave. */
export const ROOM_TEMP_IDENTITY_TTL_DAYS = 30;

/**
 * Anonymous fallback when a room member has no active temp identity.
 * NEVER substitute users.name / users.photo_url inside a room — that is a privacy leak.
 */
export const ROOM_ANON_DISPLAY_NAME = 'Member';

/**
 * SQL fragments for room-scoped display identity.
 * `ttlParam` is a query placeholder for TTL days (e.g. `$2` or `$3`).
 * Active temp = non-null display_name within soft TTL (photo optional).
 * Null / missing photo must NOT COALESCE to the canonical profile photo.
 */
export function roomTempNameSql(ttlParam: string, tiAlias = 'ti'): string {
  return `CASE
    WHEN ${tiAlias}.display_name IS NOT NULL
     AND ${tiAlias}.last_used_at > NOW() - (${ttlParam} || ' days')::interval
    THEN ${tiAlias}.display_name
    ELSE '${ROOM_ANON_DISPLAY_NAME}'
  END`;
}

export function roomTempPhotoSql(ttlParam: string, tiAlias = 'ti'): string {
  return `CASE
    WHEN ${tiAlias}.display_name IS NOT NULL
     AND ${tiAlias}.photo_url IS NOT NULL
     AND ${tiAlias}.last_used_at > NOW() - (${ttlParam} || ' days')::interval
    THEN ${tiAlias}.photo_url
    ELSE NULL
  END`;
}

export function roomUsingTempIdentitySql(ttlParam: string, tiAlias = 'ti'): string {
  return `(${tiAlias}.display_name IS NOT NULL
    AND ${tiAlias}.last_used_at > NOW() - (${ttlParam} || ' days')::interval)`;
}

/**
 * Pure helper for tests / post-query guards — never returns a canonical profile field.
 * Active temp = name present (photo optional). Incomplete / missing → anon placeholder.
 */
export function sanitizeRoomPresence(input: {
  tempName?: string | null;
  tempPhoto?: string | null;
  tempActive?: boolean;
  /** Forbidden — if passed, must be ignored. */
  profileName?: string | null;
  profilePhoto?: string | null;
}): { name: string; photo_url: string | null; using_temp_identity: boolean } {
  const nameOk = Boolean(input.tempName?.trim());
  const photoOk = Boolean(input.tempPhoto?.trim());
  const active = Boolean(input.tempActive && nameOk);
  return {
    name: active ? String(input.tempName).trim() : ROOM_ANON_DISPLAY_NAME,
    photo_url: active && photoOk ? String(input.tempPhoto).trim() : null,
    using_temp_identity: active,
  };
}

/**
 * Leave leaves no trace: drop the leaver from an in-room presence/roster list.
 * Pure helper for tests and client-side roster sync.
 */
export function dropLeaverFromRoster<T extends { user_id?: string; id?: string }>(
  roster: T[],
  leaverId: string,
): T[] {
  return roster.filter((entry) => {
    const id = entry.user_id ?? entry.id;
    return id !== leaverId;
  });
}
