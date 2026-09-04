/**
 * Room-scoped display identity.
 * Default: member's profile name + photo (same identity they already have).
 * Optional: temp name/photo disguise for this room only — never mutates the main profile.
 * Kept free of DB imports so unit tests can run without Postgres.
 */

/** Soft TTL for saved room temp identities (strategy 3). Unsaved wipe on leave. */
export const ROOM_TEMP_IDENTITY_TTL_DAYS = 30;

/**
 * Fallback display name when the account has no usable profile name.
 * Used only after profile fallback — not a forced anon gate.
 */
export const ROOM_ANON_DISPLAY_NAME = 'Member';

/**
 * SQL fragments for room-scoped display identity.
 * `ttlParam` is a query placeholder for TTL days (e.g. `$2` or `$3`).
 * Active temp = non-null display_name AND non-null photo_url within soft TTL.
 * When temp is inactive, fall back to the member's profile name/photo.
 * Assumes users aliased as `u` (or `userAlias`) and temp as `ti` (or `tiAlias`).
 */
export function roomTempNameSql(ttlParam: string, tiAlias = 'ti', userAlias = 'u'): string {
  return `CASE
    WHEN ${tiAlias}.display_name IS NOT NULL
     AND ${tiAlias}.photo_url IS NOT NULL
     AND ${tiAlias}.last_used_at > NOW() - (${ttlParam} || ' days')::interval
    THEN ${tiAlias}.display_name
    ELSE COALESCE(NULLIF(TRIM(${userAlias}.name), ''), '${ROOM_ANON_DISPLAY_NAME}')
  END`;
}

export function roomTempPhotoSql(ttlParam: string, tiAlias = 'ti', userAlias = 'u'): string {
  return `CASE
    WHEN ${tiAlias}.display_name IS NOT NULL
     AND ${tiAlias}.photo_url IS NOT NULL
     AND ${tiAlias}.last_used_at > NOW() - (${ttlParam} || ' days')::interval
    THEN ${tiAlias}.photo_url
    ELSE NULLIF(TRIM(${userAlias}.photo_url), '')
  END`;
}

export function roomUsingTempIdentitySql(ttlParam: string, tiAlias = 'ti'): string {
  return `(${tiAlias}.display_name IS NOT NULL
    AND ${tiAlias}.photo_url IS NOT NULL
    AND ${tiAlias}.last_used_at > NOW() - (${ttlParam} || ' days')::interval)`;
}

/**
 * Resolve what peers see in-room.
 * Active temp disguise wins; otherwise use the member's profile identity.
 * Incomplete temp (name without photo) does not activate disguise — profile is used.
 */
export function sanitizeRoomPresence(input: {
  tempName?: string | null;
  tempPhoto?: string | null;
  tempActive?: boolean;
  profileName?: string | null;
  profilePhoto?: string | null;
}): { name: string; photo_url: string | null; using_temp_identity: boolean } {
  const nameOk = Boolean(input.tempName?.trim());
  const photoOk = Boolean(input.tempPhoto?.trim());
  const active = Boolean(input.tempActive && nameOk && photoOk);
  if (active) {
    return {
      name: String(input.tempName).trim(),
      photo_url: String(input.tempPhoto).trim(),
      using_temp_identity: true,
    };
  }
  const profileName = input.profileName?.trim();
  const profilePhoto = input.profilePhoto?.trim();
  return {
    name: profileName || ROOM_ANON_DISPLAY_NAME,
    photo_url: profilePhoto || null,
    using_temp_identity: false,
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
