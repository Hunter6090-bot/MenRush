/**
 * Remove fake seeded map pins from team accounts so GPS can repopulate.
 * Account emails come from the command line (comma-separated); none are kept
 * in this public repo.
 *   cd backend && CLEAR_PIN_EMAILS=a@example.com,b@example.com npx ts-node scripts/clear-seeded-locations.ts
 */
import 'dotenv/config';
import pool, { query } from '../src/db';

const TEAM_EMAILS = (process.env.CLEAR_PIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function main() {
  if (TEAM_EMAILS.length === 0) {
    throw new Error('Set CLEAR_PIN_EMAILS to a comma-separated list of account emails.');
  }
  const res = await query(
    `UPDATE profiles p
        SET location = NULL, lat = NULL, lng = NULL, updated_at = NOW()
       FROM users u
      WHERE u.id = p.user_id
        AND LOWER(u.email) = ANY($1)
      RETURNING u.id`,
    [TEAM_EMAILS],
  );
  console.log(`Cleared seeded pins for ${res.rowCount ?? 0} of ${TEAM_EMAILS.length} account(s).`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    void pool.end();
    process.exit(1);
  });