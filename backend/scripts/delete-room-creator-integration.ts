/**
 * Integration (real Postgres): a member who created a room can delete their
 * account. rooms.created_by is ON DELETE SET NULL, but it used to be NOT NULL
 * as well, so the delete failed for anyone who had ever created a room.
 * After the fix the delete succeeds, the room stays for its other members and
 * its creator is NULL. A group they owned gets the longest-standing remaining
 * member as owner, or is deleted when nobody else is in it.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npm run test:delete-room-creator-integration
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('delete-room-creator-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
// Placeholder for the test process only; auth.service needs a value at import.
process.env.JWT_SECRET ||= 'delete-room-creator-integration-placeholder';
process.env.ADULT_ASSURANCE_SIGNUP_REQUIRED = 'false';

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { roomService } = await import('../src/services/room.service');

  const suffix = randomUUID().slice(0, 8);
  const password = 'Password123!';
  const userIds: string[] = [];
  const roomIds: string[] = [];

  async function makeUser(label: string): Promise<string> {
    const id = randomUUID();
    const bcrypt = (await import('bcryptjs')).default;
    const hash = await bcrypt.hash(password, 4);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age) VALUES ($1, $2, $3, $4, 30)`,
      [id, `room-${label}-${suffix}@test.menrush.local`, hash, `Room ${label} ${suffix}`],
    );
    userIds.push(id);
    return id;
  }

  try {
    const creator = await makeUser('creator');
    const member = await makeUser('member');

    // A nearby (location-based) room: open to join, no Premium needed.
    const room = await roomService.createRoom(creator, {
      name: `Delete creator ${suffix}`,
      description: 'integration test',
      is_location_based: true,
      lat: 51.5,
      lng: -0.12,
    } as any);
    const roomId = String((room as { id: string }).id);
    roomIds.push(roomId);
    await roomService.joinRoom(member, roomId);

    const before = await query(`SELECT created_by FROM rooms WHERE id = $1`, [roomId]);
    assert.strictEqual(String(before.rows[0].created_by), creator, 'room created by the creator');

    // The creator deletes their account (same path as Settings > Delete account).
    const res = await authService.deleteAccount(creator, { current_password: password, confirmation: 'DELETE' } as any);
    assert.deepStrictEqual(res, { ok: true }, 'deleteAccount returns ok');

    const gone = await query(`SELECT 1 FROM users WHERE id = $1`, [creator]);
    assert.strictEqual(gone.rows.length, 0, 'creator account is deleted');
    console.log('ok  - member who created a room can delete their account');

    const after = await query(`SELECT created_by FROM rooms WHERE id = $1`, [roomId]);
    assert.strictEqual(after.rows.length, 1, 'room still exists');
    assert.strictEqual(after.rows[0].created_by, null, 'room creator is NULL');
    const members = await query(`SELECT user_id, role FROM room_members WHERE room_id = $1`, [roomId]);
    assert.deepStrictEqual(
      members.rows.map((r) => [String(r.user_id), r.role]),
      [[member, 'owner']],
      'other member still in the room, now its owner',
    );
    console.log('ok  - room stays for its other members with a NULL creator');

    // Private groups: owner hand-over, or delete when empty.
    async function privateGroup(owner: string, others: Array<{ id: string; joinedAt: string }>) {
      const id = randomUUID();
      roomIds.push(id);
      await query(
        `INSERT INTO rooms (id, name, created_by, is_location_based, is_official) VALUES ($1, $2, $3, FALSE, FALSE)`,
        [id, `Private ${suffix}`, owner],
      );
      await query(
        `INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES ($1, $2, 'owner', '2026-01-01T00:00:00Z')`,
        [id, owner],
      );
      for (const o of others) {
        await query(
          `INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES ($1, $2, 'member', $3)`,
          [id, o.id, o.joinedAt],
        );
      }
      return id;
    }
    const owner2 = await makeUser('owner2');
    const oldest = await makeUser('oldest');
    const newer = await makeUser('newer');
    const shared = await privateGroup(owner2, [
      { id: newer, joinedAt: '2026-05-01T00:00:00Z' },
      { id: oldest, joinedAt: '2026-02-01T00:00:00Z' },
    ]);
    const lonely = await privateGroup(owner2, []);
    await authService.deleteAccount(owner2, { current_password: password, confirmation: 'DELETE' } as any);
    const roles = await query(`SELECT user_id, role FROM room_members WHERE room_id = $1 ORDER BY joined_at`, [shared]);
    assert.deepStrictEqual(
      roles.rows.map((r) => [String(r.user_id), r.role]),
      [[oldest, 'owner'], [newer, 'member']],
      'private group: longest-standing remaining member is the new owner',
    );
    assert.strictEqual(
      (await query(`SELECT 1 FROM rooms WHERE id = $1`, [lonely])).rows.length,
      0,
      'private group with nobody else in it is deleted',
    );
    console.log('ok  - private group: ownership passes to the longest-standing member, or the empty group is deleted');

    // Same transaction: if the user delete fails, the hand-over is rolled back.
    const owner3 = await makeUser('owner3');
    const heir3 = await makeUser('heir3');
    const g3 = await privateGroup(owner3, [{ id: heir3, joinedAt: '2026-03-01T00:00:00Z' }]);
    const lonely3 = await privateGroup(owner3, []);
    await query(`CREATE OR REPLACE FUNCTION drc_block_delete() RETURNS trigger AS $$
      BEGIN
        IF OLD.id = '${owner3}'::uuid THEN RAISE EXCEPTION 'drc: delete blocked'; END IF;
        RETURN OLD;
      END $$ LANGUAGE plpgsql`);
    await query(`CREATE TRIGGER drc_block_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION drc_block_delete()`);
    try {
      await assert.rejects(
        () => authService.deleteAccount(owner3, { current_password: password, confirmation: 'DELETE' } as any),
        /delete blocked/,
      );
    } finally {
      await query(`DROP TRIGGER IF EXISTS drc_block_delete ON users`);
      await query(`DROP FUNCTION IF EXISTS drc_block_delete()`);
    }
    const r3 = await query(`SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2`, [g3, heir3]);
    assert.strictEqual(r3.rows[0].role, 'member', 'failed deletion: no hand-over');
    assert.strictEqual((await query(`SELECT 1 FROM rooms WHERE id = $1`, [lonely3])).rows.length, 1, 'failed deletion: empty group kept');
    console.log('ok  - hand-over runs in the deletion transaction (rolled back on failure)');

    console.log('\ndelete-room-creator-integration: all checks passed');
  } finally {
    if (roomIds.length) {
      await query(`DELETE FROM rooms WHERE id = ANY($1::uuid[])`, [roomIds]).catch(() => undefined);
    }
    if (userIds.length) {
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]).catch(() => undefined);
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error('delete-room-creator-integration: FAIL');
  console.error(err);
  process.exit(1);
});
