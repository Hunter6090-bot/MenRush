/**
 * Upsert fixed team + e2e test accounts (verified, located, mutually matched).
 *
 *   cd backend && npm run db:seed-test-users
 *
 * Password for most seeded accounts: MenRushTest2026!
 * Individual testers may override with a custom password in SEED_USERS.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool, { query } from '../src/db';

export const TEST_PASSWORD = 'MenRushTest2026!';

/** Shoreditch-ish — matches default Discover dev center. */
export const TEST_LAT = 51.5136;
export const TEST_LNG = -0.1365;

/** Deterministic e2e fixture Hot Spot — see seedTestHotSpot() below. */
export const TEST_HOT_SPOT_ID = 'aa000001-0001-4a01-8a01-000000000001';

type SeedUser = {
  id: string;
  email: string;
  name: string;
  age: number;
  label: string;
  password?: string;
  /** Pin to Shoreditch test coords (for remote testers who should appear in London). */
  seedLondonLocation?: boolean;
  /**
   * Auth-only team login (no dating profile). Seed must not restore location / visibility.
   * Pete uses Bigbear25 as his personal account.
   */
  authOnly?: boolean;
  /**
   * Skip the automatic Shoreditch pin that every @example.com fixture otherwise gets.
   * Used for accounts that only need valid login credentials (e.g. Hot Spot check-in
   * fillers) and must NOT appear in other tests' nearby-people radius assertions.
   */
  skipLocationPin?: boolean;
  /** Flip is_premium/premium_tier after upsert — for Premium-vs-Free count fixtures. */
  isPremiumForTest?: boolean;
};

export const SEED_USERS: SeedUser[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    email: 'al.zain9690@gmail.com',
    name: 'Al',
    age: 30,
    label: 'Founder (Boss)',
    seedLondonLocation: true,
  },
  {
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    email: 'petegreen69@hotmail.com',
    name: 'Pete',
    age: 32,
    label: 'Marketing manager (auth-only — personal account is Bigbear25)',
    authOnly: true,
  },
  {
    id: 'b2000003-0003-4003-8003-000000000003',
    email: 'rfell30@hotmail.com',
    name: 'RFell',
    age: 30,
    label: 'Tester',
    seedLondonLocation: true,
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
  {
    id: 'c3000001-0001-4c01-8c01-000000000001',
    email: 'premium@example.com',
    name: 'Premium Tester',
    age: 31,
    label: 'E2E Premium fixture (Hot Spot exact-count tests)',
    skipLocationPin: true,
    isPremiumForTest: true,
  },
  {
    id: 'c3000002-0002-4c02-8c02-000000000002',
    email: 'hotspot1@example.com',
    name: 'Hot Spot Filler 1',
    age: 29,
    label: 'E2E Hot Spot check-in filler',
    skipLocationPin: true,
  },
  {
    id: 'c3000003-0003-4c03-8c03-000000000003',
    email: 'hotspot2@example.com',
    name: 'Hot Spot Filler 2',
    age: 29,
    label: 'E2E Hot Spot check-in filler',
    skipLocationPin: true,
  },
  {
    id: 'c3000004-0004-4c04-8c04-000000000004',
    email: 'hotspot3@example.com',
    name: 'Hot Spot Filler 3',
    age: 29,
    label: 'E2E Hot Spot check-in filler',
    skipLocationPin: true,
  },
];

async function upsertUser(user: SeedUser, passwordHash: string): Promise<string> {
  const email = user.email.toLowerCase();
  const isE2eFixture = user.email.endsWith('@example.com');

  const userRes = await query(
    `INSERT INTO users (id, email, password_hash, name, age, bio, headline, looking_for, interests, is_verified, verification_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, 'verified')
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       age = EXCLUDED.age,
       bio = EXCLUDED.bio,
       headline = EXCLUDED.headline,
       looking_for = EXCLUDED.looking_for,
       interests = EXCLUDED.interests,
       is_verified = TRUE,
       verification_status = 'verified',
       updated_at = NOW()
     RETURNING id`,
    [
      user.id,
      email,
      passwordHash,
      user.name,
      user.age,
      // E2E fixtures need a Discover-ready profile (bio/looking_for/interests)
      // so RequireProfileSetup doesn't redirect them into onboarding mid-test.
      isE2eFixture ? 'E2E test fixture — do not message.' : null,
      isE2eFixture ? 'Test account' : null,
      isE2eFixture ? 'chat' : null,
      isE2eFixture ? ['vers', 'bear', 'athletic'] : [],
    ],
  );
  const userId = userRes.rows[0].id as string;

  const useLondonPin =
    !user.authOnly && !user.skipLocationPin && (isE2eFixture || user.seedLondonLocation === true);

  if (user.authOnly) {
    // Keep login; do not re-pin or make discoverable (profile intentionally cleared).
    await query(
      `INSERT INTO profiles (user_id, online, last_seen, is_visible, is_ghost)
       VALUES ($1, FALSE, NOW(), FALSE, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET
         location = NULL,
         lat = NULL,
         lng = NULL,
         online = FALSE,
         is_visible = FALSE,
         is_ghost = FALSE,
         updated_at = NOW()`,
      [userId],
    );
  } else if (useLondonPin) {
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
      [userId, TEST_LAT, TEST_LNG],
    );
  } else {
    // Real team accounts: no fake map pin — location comes from live GPS on device.
    await query(
      `INSERT INTO profiles (user_id, online, last_seen, is_visible, is_ghost)
       VALUES ($1, TRUE, NOW(), TRUE, FALSE)
       ON CONFLICT (user_id) DO UPDATE SET
         online = TRUE,
         last_seen = NOW(),
         is_visible = TRUE,
         is_ghost = FALSE,
         updated_at = NOW()`,
      [userId],
    );
  }

  if (user.isPremiumForTest) {
    await query(
      `UPDATE users SET is_premium = TRUE, premium_tier = 'premium' WHERE id = $1`,
      [userId],
    );
  }

  return userId;
}

/**
 * Deterministic e2e fixture Hot Spot at TEST_LAT/TEST_LNG, idempotent on TEST_HOT_SPOT_ID.
 * Clearly test-only (name/city/description), reuses the 'open-spaces' category already
 * seeded by migration 024 — never inserts a real venue.
 */
async function seedTestHotSpot() {
  const category = await query(
    `SELECT id FROM hot_spot_categories WHERE slug = 'open-spaces' LIMIT 1`,
  );
  if (category.rows.length === 0) {
    console.warn('hot_spot_categories not seeded yet — skipping test Hot Spot fixture.');
    return;
  }
  const categoryId = category.rows[0].id as number;
  await query(
    `INSERT INTO hot_spots (id, category_id, name, city, description, latitude, longitude, is_user_generated, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE)
     ON CONFLICT (id) DO UPDATE SET
       category_id = EXCLUDED.category_id,
       latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude,
       is_active = TRUE`,
    [
      TEST_HOT_SPOT_ID,
      categoryId,
      'E2E Test Hot Spot',
      'Test Fixture',
      'Deterministic Hot Spot for e2e/Playwright coverage — not a real venue. Safe to check in/out freely.',
      TEST_LAT,
      TEST_LNG,
    ],
  );
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

  const ids: Record<string, string> = {};

  for (const user of SEED_USERS) {
    const password = user.password ?? TEST_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 10);
    ids[user.email.toLowerCase()] = await upsertUser(user, passwordHash);
  }

  // E2E fixtures stay pre-matched; team accounts start unmatched for map/discovery testing.
  await ensureMutualMatch(ids['alice@example.com'], ids['bob@example.com']);

  await seedTestHotSpot();

  console.log('Seeded test accounts:\n');
  for (const user of SEED_USERS) {
    const password = user.password ?? TEST_PASSWORD;
    console.log(`  ${user.label}`);
    console.log(`    email:    ${user.email.toLowerCase()}`);
    console.log(`    password: ${password}`);
    console.log(`    id:       ${user.id}\n`);
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    void pool.end();
    process.exit(1);
  });
