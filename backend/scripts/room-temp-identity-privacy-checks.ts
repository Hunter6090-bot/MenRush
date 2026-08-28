/**
 * Room temp-identity privacy checks (P0).
 * Run: cd backend && npx ts-node scripts/room-temp-identity-privacy-checks.ts
 *
 * Asserts:
 * - With temp identity active and null temp photo, roster/presence never return account photo
 * - With temp identity active, roster/presence never return account name when display_name set
 * - setTempIdentity(undefined photo) preserves existing temp photo (upload path)
 * - Private createRoom defaults to capacity 5 and rejects >5
 *
 * Requires DATABASE_URL. Applies pending migrations.
 */
import assert from 'assert';
import { v4 as uuidv4 } from 'uuid';
import pool, { query } from '../src/db';
import { runPendingMigrations } from '../src/scripts/migrate';
import {
  PRIVATE_GROUP_MAX_MEMBERS,
  roomService,
  roomTempDisplayNameSql,
  roomTempDisplayPhotoSql,
} from '../src/services/room.service';

type Test = { name: string; run: () => void | Promise<void> };
const tests: Test[] = [];

function test(name: string, run: Test['run']) {
  tests.push({ name, run });
}

async function ensureUser(email: string, name: string, photoUrl: string): Promise<string> {
  const id = uuidv4();
  await query(
    `INSERT INTO users (
       id, email, password_hash, name, age, photo_url,
       is_verified, verification_status, age_assurance_status,
       is_premium, premium_tier
     ) VALUES (
       $1, $2, $3, $4, 30, $5,
       TRUE, 'verified', 'confirmed',
       TRUE, 'premium'
     )
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       photo_url = EXCLUDED.photo_url,
       is_verified = TRUE,
       verification_status = 'verified',
       age_assurance_status = 'confirmed',
       is_premium = TRUE,
       premium_tier = 'premium',
       premium_until = NOW() + interval '30 days',
       updated_at = NOW()
     RETURNING id`,
    [
      id,
      email,
      '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
      name,
      photoUrl,
    ],
  );
  const res = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  return res.rows[0].id as string;
}

test('SQL helpers never COALESCE temp photo to account photo while temp active', () => {
  const photoSql = roomTempDisplayPhotoSql('$2');
  assert.ok(photoSql.includes('THEN ti.photo_url'), 'temp branch must return ti.photo_url');
  assert.ok(
    !/COALESCE\s*\(\s*CASE[\s\S]*ti\.photo_url[\s\S]*u\.photo_url/i.test(photoSql),
    'must not COALESCE temp photo to u.photo_url',
  );
  const nameSql = roomTempDisplayNameSql('$2');
  assert.ok(nameSql.includes('THEN ti.display_name'));
});

test('getMembers + resolveRoomPresence hide account photo when temp photo is null', async () => {
  const realName = `RealName_${uuidv4().slice(0, 8)}`;
  const realPhoto = `/uploads/profiles/real-${uuidv4().slice(0, 8)}.jpg`;
  const tempName = `TempAlias_${uuidv4().slice(0, 8)}`;

  const userId = await ensureUser(
    `temp-privacy-user-${uuidv4().slice(0, 8)}@test.menrush.local`,
    realName,
    realPhoto,
  );
  const viewerId = await ensureUser(
    `temp-privacy-viewer-${uuidv4().slice(0, 8)}@test.menrush.local`,
    'Viewer',
    '/uploads/profiles/viewer.jpg',
  );

  const room = await roomService.createRoom(userId, {
    name: `Privacy Room ${uuidv4().slice(0, 6)}`,
    is_location_based: false,
    max_members: PRIVATE_GROUP_MAX_MEMBERS,
  });
  await roomService.insertRoomMember(room.id, viewerId, 'member');

  await roomService.setTempIdentity(userId, room.id, {
    display_name: tempName,
    photo_url: null,
    save_name: true,
    save_photo: false,
  });

  const members = await roomService.getMembers(room.id, viewerId);
  const self = members.find((m: { id: string }) => m.id === userId);
  assert.ok(self, 'member row present');
  assert.equal(self.name, tempName, 'roster must show temp name');
  assert.notEqual(self.name, realName, 'roster must not show account name');
  assert.equal(self.photo_url, null, 'null temp photo must stay null — not account photo');
  assert.notEqual(self.photo_url, realPhoto);
  assert.equal(self.using_temp_identity, true);

  const presence = await roomService.resolveRoomPresence(userId, room.id);
  assert.equal(presence.name, tempName);
  assert.notEqual(presence.name, realName);
  assert.equal(presence.photo_url, null, 'join/leave presence must not leak account photo');
  assert.notEqual(presence.photo_url, realPhoto);
  assert.equal(presence.using_temp_identity, true);
});

test('join/leave-style presence stays on temp after name-only update mid-upload', async () => {
  const realName = `Account_${uuidv4().slice(0, 8)}`;
  const realPhoto = `/uploads/profiles/acct-${uuidv4().slice(0, 8)}.jpg`;
  const tempName = `Ghost_${uuidv4().slice(0, 8)}`;
  const tempPhoto = `/uploads/room-temp/prior-${uuidv4().slice(0, 8)}.jpg`;

  const userId = await ensureUser(
    `temp-privacy-upload-${uuidv4().slice(0, 8)}@test.menrush.local`,
    realName,
    realPhoto,
  );

  const room = await roomService.createRoom(userId, {
    name: `Upload Room ${uuidv4().slice(0, 6)}`,
    is_location_based: false,
    max_members: 5,
  });

  await roomService.setTempIdentity(userId, room.id, {
    display_name: tempName,
    photo_url: tempPhoto,
    save_name: true,
    save_photo: true,
  });

  // Simulate name-only / upload-in-flight update that omits photo_url — must keep prior temp photo.
  await roomService.setTempIdentity(userId, room.id, {
    display_name: tempName,
    save_name: true,
    save_photo: true,
  });

  const presence = await roomService.resolveRoomPresence(userId, room.id);
  assert.equal(presence.name, tempName);
  assert.equal(presence.photo_url, tempPhoto, 'prior temp photo must survive undefined photo_url update');
  assert.notEqual(presence.photo_url, realPhoto);

  // Explicit null clears temp photo but still must not fall back to account.
  await roomService.setTempIdentity(userId, room.id, {
    display_name: tempName,
    photo_url: null,
    save_name: true,
    save_photo: false,
  });
  const afterClear = await roomService.resolveRoomPresence(userId, room.id);
  assert.equal(afterClear.photo_url, null);
  assert.notEqual(afterClear.photo_url, realPhoto);
  assert.equal(afterClear.name, tempName);
});

test('private createRoom capacity is 3–5; rejects oversized', async () => {
  const userId = await ensureUser(
    `temp-privacy-create-${uuidv4().slice(0, 8)}@test.menrush.local`,
    'Creator',
    '/uploads/profiles/c.jpg',
  );

  const created = await roomService.createRoom(userId, {
    name: `Small ${uuidv4().slice(0, 6)}`,
    is_location_based: false,
  });
  assert.equal(created.max_members, PRIVATE_GROUP_MAX_MEMBERS);

  await assert.rejects(
    () =>
      roomService.createRoom(userId, {
        name: 'Too Big',
        is_location_based: false,
        max_members: 50,
      }),
    (err: unknown) => err instanceof Error && /capacity 3–5/i.test(err.message),
  );
});

async function main() {
  await runPendingMigrations();
  let failed = 0;
  for (const t of tests) {
    try {
      await t.run();
      console.log(`ok - ${t.name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL - ${t.name}`);
      console.error(err);
    }
  }
  await pool.end();
  if (failed > 0) {
    console.error(`\n${failed} test(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${tests.length} temp-identity privacy checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
