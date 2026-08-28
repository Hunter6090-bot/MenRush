/**
 * Owner-account (BOA90) local verification for room temp-identity privacy.
 * Does NOT touch production. Seeds a local stand-in for zain.3la2@hotmail.com.
 *
 * Run:
 *   DATABASE_URL=... JWT_SECRET=... BETA_PREMIUM_FREE=false \
 *   npx ts-node scripts/boa90-room-privacy-owner-check.ts
 */
import assert from 'assert';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool, { query } from '../src/db';
import { runPendingMigrations } from '../src/scripts/migrate';
import { roomService } from '../src/services/room.service';
import { authService } from '../src/services/auth.service';

const BOA90_EMAIL = 'zain.3la2@hotmail.com';
const BOA90_REAL_NAME = 'BOA90';
const BOA90_REAL_PHOTO = '/uploads/profiles/boa90-real-account.jpg';
const TEMP_NAME = 'CopperFox';
const PEER_EMAIL = `boa90-peer-${uuidv4().slice(0, 8)}@test.menrush.local`;

async function ensureBoa90(): Promise<string> {
  const hash = await bcryptjs.hash('OwnerTest-Local-Only', 10);
  const id = uuidv4();
  await query(
    `INSERT INTO users (
       id, email, password_hash, name, age, photo_url,
       is_verified, verification_status, age_assurance_status,
       is_premium, premium_tier, premium_until
     ) VALUES (
       $1, $2, $3, $4, 35, $5,
       TRUE, 'verified', 'confirmed',
       TRUE, 'premium', NOW() + interval '365 days'
     )
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       photo_url = EXCLUDED.photo_url,
       password_hash = EXCLUDED.password_hash,
       is_verified = TRUE,
       verification_status = 'verified',
       age_assurance_status = 'confirmed',
       is_premium = TRUE,
       premium_tier = 'premium',
       premium_until = NOW() + interval '365 days',
       updated_at = NOW()`,
    [id, BOA90_EMAIL, hash, BOA90_REAL_NAME, BOA90_REAL_PHOTO],
  );
  const res = await query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [BOA90_EMAIL]);
  return res.rows[0].id as string;
}

async function ensurePeer(): Promise<string> {
  const hash = await bcryptjs.hash('PeerTest-Local', 10);
  const id = uuidv4();
  await query(
    `INSERT INTO users (
       id, email, password_hash, name, age, photo_url,
       is_verified, verification_status, age_assurance_status,
       is_premium, premium_tier, premium_until
     ) VALUES (
       $1, $2, $3, 'PeerReal', 28, '/uploads/profiles/peer-real.jpg',
       TRUE, 'verified', 'confirmed',
       TRUE, 'premium', NOW() + interval '30 days'
     )
     ON CONFLICT (email) DO UPDATE SET
       is_premium = TRUE,
       premium_tier = 'premium',
       updated_at = NOW()`,
    [id, PEER_EMAIL, hash],
  );
  const res = await query(`SELECT id FROM users WHERE email = $1`, [PEER_EMAIL]);
  return res.rows[0].id as string;
}

async function main() {
  await runPendingMigrations();
  const boa90 = await ensureBoa90();
  const peer = await ensurePeer();

  // Login path works for owner stand-in (local only).
  const login = await authService.login({
    email: BOA90_EMAIL,
    password: 'OwnerTest-Local-Only',
  });
  assert.ok(login.token, 'BOA90 local login must succeed');
  assert.equal(login.user.id, boa90);

  const room = await roomService.createRoom(boa90, {
    name: `BOA90 Privacy ${uuidv4().slice(0, 6)}`,
    is_location_based: false,
    max_members: 5,
    member_ids: [peer],
  });
  assert.equal(room.max_members, 5);

  // Enter with temp name, no temp photo (upload pending / optional).
  await roomService.setTempIdentity(boa90, room.id, {
    display_name: TEMP_NAME,
    photo_url: null,
    save_name: true,
    save_photo: false,
  });
  await roomService.setTempIdentity(peer, room.id, {
    display_name: 'PeerGhost',
    photo_url: null,
    save_name: false,
    save_photo: false,
  });

  const presence = await roomService.resolveRoomPresence(boa90, room.id);
  assert.equal(presence.using_temp_identity, true);
  assert.equal(presence.name, TEMP_NAME);
  assert.notEqual(presence.name, BOA90_REAL_NAME);
  assert.equal(presence.photo_url, null);
  assert.notEqual(presence.photo_url, BOA90_REAL_PHOTO);

  const roster = await roomService.getMembers(room.id, peer);
  const boaRow = roster.find((m: { id: string }) => m.id === boa90);
  assert.ok(boaRow);
  assert.equal(boaRow.name, TEMP_NAME);
  assert.notEqual(boaRow.name, BOA90_REAL_NAME);
  assert.equal(boaRow.photo_url, null);
  assert.notEqual(boaRow.photo_url, BOA90_REAL_PHOTO);

  // Simulate failed upload recovery: keep prior temp photo, never account.
  const prior = `/uploads/room-temp/boa90-prior.jpg`;
  await roomService.setTempIdentity(boa90, room.id, {
    display_name: TEMP_NAME,
    photo_url: prior,
    save_name: true,
    save_photo: true,
  });
  await roomService.setTempIdentity(boa90, room.id, {
    display_name: TEMP_NAME,
    // omit photo_url — upload in flight / name touch
    save_name: true,
    save_photo: true,
  });
  const midUpload = await roomService.resolveRoomPresence(boa90, room.id);
  assert.equal(midUpload.photo_url, prior);
  assert.notEqual(midUpload.photo_url, BOA90_REAL_PHOTO);
  assert.equal(midUpload.name, TEMP_NAME);

  console.log(
    JSON.stringify(
      {
        ok: true,
        owner: BOA90_EMAIL,
        room_id: room.id,
        presence_name: presence.name,
        presence_photo: presence.photo_url,
        roster_name: boaRow.name,
        roster_photo: boaRow.photo_url,
        mid_upload_photo: midUpload.photo_url,
        note: 'Local owner-account check only — not claiming production live.',
      },
      null,
      2,
    ),
  );

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
