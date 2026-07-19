/**
 * Remove fake seeded map pins from real team accounts so GPS can repopulate.
 *   cd backend && npx ts-node scripts/clear-seeded-locations.ts
 */
import 'dotenv/config';
import pool, { query } from '../src/db';

const TEAM_EMAILS = [
  'al.zain9690@gmail.com',
  'petegreen69@hotmail.com',
  'rfell30@hotmail.com',
];

async function main() {
  const res = await query(
    `UPDATE profiles p
        SET location = NULL, lat = NULL, lng = NULL, updated_at = NOW()
       FROM users u
      WHERE u.id = p.user_id
        AND LOWER(u.email) = ANY($1)
      RETURNING u.email`,
    [TEAM_EMAILS],
  );
  console.log('Cleared seeded pins for:', res.rows.map((r) => r.email).join(', ') || '(none)');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    void pool.end();
    process.exit(1);
  });