/**
 * Clear dating-profile data for PeteGreen69@hotmail.com (team / staff login)
 * while keeping the auth user so team access is unbroken.
 *
 * Pete's personal account is Bigbear25 (petegreen690@gmail.com) — separate user.
 * Team membership is by email allowlist in scripts (TEAM_EMAILS / SEED_USERS),
 * not a DB role column — deleting the users row would break that.
 *
 *   cd backend && DATABASE_URL=... npx ts-node --transpile-only src/scripts/ops-clear-petegreen69-profile.ts
 *   # or: railway run --service backend npx ts-node --transpile-only src/scripts/ops-clear-petegreen69-profile.ts
 */
import 'dotenv/config';
import pool, { query } from '../db';

const TEAM_EMAIL = 'PeteGreen69@hotmail.com';
const PERSONAL_NAME = 'bigbear25';
const PERSONAL_EMAIL_HINT = 'petegreen690@gmail.com';

async function main() {
  const pete = await query(
    `SELECT u.id, u.email, u.name, u.photo_url, u.cover_url, u.bio, u.looking_for,
            cardinality(COALESCE(u.interests, '{}')) AS interest_count,
            p.id AS profile_id, p.lat, p.lng
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)`,
    [TEAM_EMAIL],
  );
  if (!pete.rows[0]) throw new Error('team_user_not_found');

  const bigbear = await query(
    `SELECT id, email, name, photo_url
       FROM users
      WHERE LOWER(name) = LOWER($1)
         OR LOWER(email) = LOWER($2)`,
    [PERSONAL_NAME, PERSONAL_EMAIL_HINT],
  );
  if (!bigbear.rows[0]) {
    throw new Error('personal_account_bigbear25_not_found — aborting; do not clear team profile without confirming separate account');
  }
  if (bigbear.rows[0].id === pete.rows[0].id) {
    throw new Error('bigbear25_same_as_team_email — unexpected; aborting');
  }

  const teamId = pete.rows[0].id as string;

  // Snapshot custom photo counts BEFORE (proof we never mass-touch uploads).
  const beforePhotos = await query(
    `SELECT
       COUNT(*) FILTER (
         WHERE photo_url IS NOT NULL
           AND TRIM(photo_url) <> ''
           AND photo_url NOT LIKE '/avatars/generic/%'
       )::int AS custom_photo,
       COUNT(*) FILTER (WHERE photo_url LIKE '/avatars/generic/%')::int AS generic_avatar
     FROM users`,
  );

  const customBefore = await query(
    `SELECT id, email, photo_url FROM users
      WHERE photo_url IS NOT NULL AND TRIM(photo_url) <> '' AND photo_url NOT LIKE '/avatars/generic/%'
      ORDER BY email`,
  );

  // Clear users.* profile fields only (keep auth: email, password_hash, name, age, verification).
  const clearedUser = await query(
    `UPDATE users
        SET bio = NULL,
            headline = NULL,
            looking_for = NULL,
            photo_url = NULL,
            cover_url = NULL,
            cover_position_x = 50,
            cover_position_y = 50,
            cover_zoom = 1,
            interests = '{}',
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, photo_url, cover_url, bio, looking_for, interests`,
    [teamId],
  );

  // Clear geospatial / presence profile row; keep the row so FK/auth flows stay intact.
  const clearedProfile = await query(
    `UPDATE profiles
        SET location = NULL,
            lat = NULL,
            lng = NULL,
            online = FALSE,
            is_visible = FALSE,
            is_ghost = FALSE,
            mood = NULL,
            mood_set_at = NULL,
            available_until = NULL,
            share_live_location_with_matches = FALSE,
            updated_at = NOW()
      WHERE user_id = $1
      RETURNING id, user_id, lat, lng, is_visible, online`,
    [teamId],
  );

  const afterPhotos = await query(
    `SELECT
       COUNT(*) FILTER (
         WHERE photo_url IS NOT NULL
           AND TRIM(photo_url) <> ''
           AND photo_url NOT LIKE '/avatars/generic/%'
       )::int AS custom_photo,
       COUNT(*) FILTER (WHERE photo_url LIKE '/avatars/generic/%')::int AS generic_avatar
     FROM users`,
  );

  const customAfter = await query(
    `SELECT id, email, photo_url FROM users
      WHERE photo_url IS NOT NULL AND TRIM(photo_url) <> '' AND photo_url NOT LIKE '/avatars/generic/%'
      ORDER BY email`,
  );

  const customUnchanged =
    JSON.stringify(customBefore.rows) === JSON.stringify(customAfter.rows) &&
    beforePhotos.rows[0].custom_photo === afterPhotos.rows[0].custom_photo;

  console.log(
    JSON.stringify(
      {
        ok: true,
        kept_auth_user: {
          id: teamId,
          email: pete.rows[0].email,
          name: pete.rows[0].name,
          note: 'password_hash / verification untouched; team email allowlist still works',
        },
        personal_account_confirmed: {
          id: bigbear.rows[0].id,
          email: bigbear.rows[0].email,
          name: bigbear.rows[0].name,
          photo_url: bigbear.rows[0].photo_url,
        },
        before: {
          photo_url: pete.rows[0].photo_url,
          cover_url: pete.rows[0].cover_url,
          bio: pete.rows[0].bio,
          looking_for: pete.rows[0].looking_for,
          interest_count: pete.rows[0].interest_count,
          lat: pete.rows[0].lat,
          lng: pete.rows[0].lng,
        },
        after_user: clearedUser.rows[0],
        after_profile: clearedProfile.rows[0] ?? null,
        deleted: [
          'users.bio',
          'users.headline',
          'users.looking_for',
          'users.photo_url',
          'users.cover_url',
          'users.interests',
          'profiles.location/lat/lng',
          'profiles.mood',
          'profiles.available_until',
        ],
        kept: [
          'users row (id, email, password_hash, name, age, verification)',
          'profiles row (soft-cleared, not deleted)',
          'likes / messages / rooms (not touched)',
          'Bigbear25 personal account (not touched)',
        ],
        custom_photos_untouched: customUnchanged,
        photo_counts: { before: beforePhotos.rows[0], after: afterPhotos.rows[0] },
        custom_photo_urls_after: customAfter.rows,
      },
      null,
      2,
    ),
  );

  if (!customUnchanged) {
    throw new Error('custom_photos_changed_unexpectedly');
  }
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end().finally(() => process.exit(1));
  });
