/**
 * Official rooms catalog checks (slice 2).
 * Run: cd backend && npx ts-node scripts/official-rooms-checks.ts
 *
 * Requires DATABASE_URL. Applies pending migrations, then asserts:
 * - seed idempotency (10 official rooms, no dupes on re-seed)
 * - getRooms returns official catalog to a non-member free user
 * - joinRoom succeeds for official (verified free)
 * - joinRoom stays invite-only for private custom groups
 * - createRoom (non-location) stays Premium-gated
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pool, { query } from '../src/db';
import { runPendingMigrations } from '../src/scripts/migrate';
import { roomService } from '../src/services/room.service';
import { PremiumRequiredError } from '../src/services/premium.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

const OFFICIAL_NAMES = [
  'Bears & Cubs',
  'Daddies',
  'Leather & Gear',
  'Muscle & Jocks',
  'Twinks & Twunks',
  'Smokers & Cigars',
  'Discreet / DL',
  'Group Play',
  'Kink & Pig',
  'Hosting Tonight',
];

async function ensureFreeVerifiedUser(email: string): Promise<string> {
  const id = uuidv4();
  await query(
    `INSERT INTO users (
       id, email, password_hash, name, age,
       is_verified, verification_status, age_assurance_status,
       is_premium, premium_tier
     ) VALUES (
       $1, $2, $3, $4, 28,
       TRUE, 'verified', 'verified',
       FALSE, 'free'
     )
     ON CONFLICT (email) DO UPDATE SET
       is_verified = TRUE,
       verification_status = 'verified',
       age_assurance_status = 'verified',
       is_premium = FALSE,
       premium_tier = 'free',
       updated_at = NOW()
     RETURNING id`,
    [id, email, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Official Rooms Tester'],
  );
  const res = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
  return res.rows[0].id;
}

async function ensurePremiumUser(email: string): Promise<string> {
  const id = await ensureFreeVerifiedUser(email);
  await query(
    `UPDATE users SET is_premium = TRUE, premium_tier = 'premium', premium_until = NOW() + interval '30 days'
     WHERE id = $1`,
    [id],
  );
  return id;
}

async function reseedOfficialCatalog(): Promise<void> {
  const sqlPath = path.resolve(__dirname, '../database/migrations/034_official_rooms_catalog.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  // Re-run full migration SQL (idempotent ALTER + seed).
  await query(sql);
}

test('seed is idempotent — exactly 10 official rooms after double apply', async () => {
  await reseedOfficialCatalog();
  await reseedOfficialCatalog();

  const count = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM rooms WHERE is_official = TRUE`,
  );
  assert.equal(count.rows[0].n, '10', 'expected exactly 10 official rooms');

  const slugs = await query<{ official_slug: string }>(
    `SELECT official_slug FROM rooms WHERE is_official = TRUE ORDER BY official_slug`,
  );
  assert.equal(slugs.rows.length, 10);
  const unique = new Set(slugs.rows.map((r) => r.official_slug));
  assert.equal(unique.size, 10, 'official_slug values must be unique');

  const names = await query<{ name: string }>(
    `SELECT name FROM rooms WHERE is_official = TRUE ORDER BY name`,
  );
  assert.deepEqual(
    names.rows.map((r) => r.name).sort(),
    [...OFFICIAL_NAMES].sort(),
  );
});

test('getRooms lists official catalog for a free non-member', async () => {
  const userId = await ensureFreeVerifiedUser('official-rooms-free@test.menrush.local');
  // Ensure not a member of any official room
  await query(
    `DELETE FROM room_members
      WHERE user_id = $1
        AND room_id IN (SELECT id FROM rooms WHERE is_official = TRUE)`,
    [userId],
  );

  const listed = await roomService.getRooms(userId);
  assert.ok(Array.isArray(listed.official_rooms), 'official_rooms array present');
  assert.equal(listed.official_rooms.length, 10);

  for (const room of listed.official_rooms) {
    assert.equal(room.is_official, true);
    assert.equal(room.user_role, null);
  }

  const listedNames = listed.official_rooms.map((r: { name: string }) => r.name).sort();
  assert.deepEqual(listedNames, [...OFFICIAL_NAMES].sort());
});

test('joinRoom succeeds for official room as verified free user', async () => {
  const userId = await ensureFreeVerifiedUser('official-rooms-joiner@test.menrush.local');
  const room = await query<{ id: string }>(
    `SELECT id FROM rooms WHERE official_slug = 'bears-cubs' LIMIT 1`,
  );
  assert.ok(room.rows[0]?.id);
  const roomId = room.rows[0].id;

  await query(`DELETE FROM room_members WHERE user_id = $1 AND room_id = $2`, [userId, roomId]);

  await roomService.joinRoom(userId, roomId);
  const member = await roomService.isMember(userId, roomId);
  assert.equal(member, true);

  // Idempotent membership insert
  await roomService.joinRoom(userId, roomId);
  const again = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM room_members WHERE user_id = $1 AND room_id = $2`,
    [userId, roomId],
  );
  assert.equal(again.rows[0].n, '1');
});

test('joinRoom rejects private custom groups (invite-only)', async () => {
  // Disable beta free so create path can still be tested separately;
  // here we insert a private room directly (non-official, non-location).
  const ownerId = await ensurePremiumUser('official-rooms-owner@test.menrush.local');
  const outsiderId = await ensureFreeVerifiedUser('official-rooms-outsider@test.menrush.local');
  const roomId = uuidv4();

  await query(
    `INSERT INTO rooms (id, name, description, created_by, is_location_based, is_official, max_members, kind)
     VALUES ($1, $2, 'private test', $3, FALSE, FALSE, 50, 'room')
     ON CONFLICT (id) DO NOTHING`,
    [roomId, `Private Test ${roomId.slice(0, 8)}`, ownerId],
  );
  await roomService.insertRoomMember(roomId, ownerId, 'owner');

  await assert.rejects(
    () => roomService.joinRoom(outsiderId, roomId),
    (err: unknown) =>
      err instanceof Error && /invite-only/i.test(err.message),
  );
});

test('createRoom custom group stays Premium-gated for free users', async () => {
  const prev = process.env.BETA_PREMIUM_FREE;
  process.env.BETA_PREMIUM_FREE = 'false';
  try {
    const freeId = await ensureFreeVerifiedUser('official-rooms-creator-free@test.menrush.local');
    await assert.rejects(
      () =>
        roomService.createRoom(freeId, {
          name: 'Should Fail Custom Room',
          description: 'free user create',
          is_location_based: false,
        }),
      (err: unknown) => err instanceof PremiumRequiredError && err.code === 'premium_required',
    );

    const premiumId = await ensurePremiumUser('official-rooms-creator-prem@test.menrush.local');
    const created = await roomService.createRoom(premiumId, {
      name: `Premium Custom ${Date.now()}`,
      description: 'premium ok',
      is_location_based: false,
    });
    assert.ok(created.id);
    assert.equal(created.is_official, false);
  } finally {
    if (prev === undefined) delete process.env.BETA_PREMIUM_FREE;
    else process.env.BETA_PREMIUM_FREE = prev;
  }
});

test('addMember cannot use premium invite path on official rooms', async () => {
  const ownerish = await ensurePremiumUser('official-rooms-add-owner@test.menrush.local');
  const target = await ensurePremiumUser('official-rooms-add-target@test.menrush.local');
  const room = await query<{ id: string }>(
    `SELECT id FROM rooms WHERE official_slug = 'daddies' LIMIT 1`,
  );
  const roomId = room.rows[0].id;

  await assert.rejects(
    () => roomService.addMember(ownerish, roomId, target),
    (err: unknown) =>
      err instanceof Error && /Use join to enter official rooms/i.test(err.message),
  );
});

async function main() {
  // Ensure premium gate tests are not short-circuited by env.
  if (process.env.BETA_PREMIUM_FREE === 'true') {
    console.warn('Note: BETA_PREMIUM_FREE was true; create-gate test forces false locally.');
  }

  await runPendingMigrations();

  let failures = 0;
  for (const current of tests) {
    try {
      await current.run();
      console.log(`PASS ${current.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${current.name}`);
      console.error(error);
    }
  }

  await pool.end();
  if (failures > 0) process.exit(1);
  console.log(`Official rooms checks passed (${tests.length}).`);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
