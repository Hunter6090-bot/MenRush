/**
 * Upsert fixed team + e2e test accounts (verified, located, mutually matched).
 *
 *   cd backend && npm run db:seed-test-users
 *
 * Password for all seeded accounts: MenRushTest2026!
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool, { query } from '../src/db';

export const TEST_PASSWORD = 'MenRushTest2026!';

/** Shoreditch-ish — matches default Discover dev center. */
const TEST_LAT = 51.5136;
const TEST_LNG = -0.1365;

type SeedUser = {
  id: string;
  email: string;
  name: string;
  age: number;
  label: string;
};

export const SEED_USERS: SeedUser[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    email: 'al.zain9690@gmail.com',
    name: 'Al',
    age: 30,
    label: 'Founder (Boss)',
  },
  {
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    email: 'petegreen69@hotmail.com',
    name: 'Pete',
    age: 32,
    label: 'Marketing manager',
  },
  {
    id: 'a1000001-0001-4001-8001-000000000001',
    email: 'alice@example.com',
    name: 'Alice',
    age: 28,
    label: 'E2E user A',
  },
  {
    id: 'a1000002-0002-4002-8002-000000000002',
    email: 'bob@example.com',
    name: 'Bob',
    age: 30,
    label: 'E2E user B',
  },
];

async function upsertUser(user: SeedUser, passwordHash: string): Promise<string> {
  const email = user.email.toLowerCase();

  await query(
    `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status)
     VALUES ($1, $2, $3, $4, $5, TRUE, 'verified')
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       age = EXCLUDED.age,
       is_verified = TRUE,
       verification_status = 'verified',
       updated_at = NOW()`,
    [user.id, email, passwordHash, user.name, user.age],
  );

  const isE2eFixture = user.email.endsWith('@example.com');

  if (isE2eFixture) {
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
       VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), TRUE, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET
         location = EXCLUDED.location,
         lat = EXCLUDED.lat,
         lng = EXCLUDED.lng,
         online = TRUE,
         last_seen = NOW(),
         is_visible = TRUE,
         is_ghost = FALSE,
         updated_at = NOW()`,
      [user.id, TEST_LAT, TEST_LNG],
    );
  } else {
    // Real team accounts: no fake map pin — location comes from live GPS on device.
    await query(
      `INSERT INTO profiles (user_id, online, last_seen, is_visible, is_ghost)
       VALUES ($1, TRUE, NOW(), TRUE, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET
         location = NULL,
         lat = NULL,
         lng = NULL,
         online = TRUE,
         last_seen = NOW(),
         is_visible = TRUE,
         is_ghost = FALSE,
         updated_at = NOW()`,
      [user.id],
    );
  }

  return user.id;
}

async function ensureMutualMatch(a: string, b: string) {
  await query(
    `INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [a, b],
  );
  await query(
    `INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [b, a],
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const ids: Record<string, string> = {};

  for (const user of SEED_USERS) {
    ids[user.email.toLowerCase()] = await upsertUser(user, passwordHash);
  }

  // E2E fixtures stay pre-matched; team accounts start unmatched for map/discovery testing.
  await ensureMutualMatch(ids['alice@example.com'], ids['bob@example.com']);

  console.log(`Seeded test accounts (password: ${TEST_PASSWORD}):\n`);
  for (const user of SEED_USERS) {
    console.log(`  ${user.label}`);
    console.log(`    email: ${user.email.toLowerCase()}`);
    console.log(`    id:    ${user.id}\n`);
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    void pool.end();
    process.exit(1);
  });
