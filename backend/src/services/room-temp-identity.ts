/**
 * Room-scoped display identity — never emit canonical profile name/photo.
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
 * Active temp = non-null display_name within soft TTL. Photo may be null on purpose;
 * null must NOT COALESCE to the canonical profile photo.
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
     AND ${tiAlias}.last_used_at > NOW() - (${ttlParam} || ' days')::interval
    THEN ${tiAlias}.photo_url
    ELSE NULL
  END`;
}

export function roomUsingTempIdentitySql(ttlParam: string, tiAlias = 'ti'): string {
  return `(${tiAlias}.display_name IS NOT NULL
    AND ${tiAlias}.last_used_at > NOW() - (${ttlParam} || ' days')::interval)`;
}

/** Pure helper for tests / post-query guards — never returns a canonical profile field. */
export function sanitizeRoomPresence(input: {
  tempName?: string | null;
  tempPhoto?: string | null;
  tempActive?: boolean;
  /** Forbidden — if passed, must be ignored. */
  profileName?: string | null;
  profilePhoto?: string | null;
}): { name: string; photo_url: string | null; using_temp_identity: boolean } {
  const active = Boolean(input.tempActive && input.tempName?.trim());
  return {
    name: active ? String(input.tempName).trim() : ROOM_ANON_DISPLAY_NAME,
    photo_url: active ? (input.tempPhoto ?? null) : null,
    using_temp_identity: active,
  };
}
