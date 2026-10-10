/**
 * Integration (real Postgres): a member who created a room can delete their
 * account. rooms.created_by is ON DELETE SET NULL, but it used to be NOT NULL
 * as well, so the delete failed for anyone who had ever created a room.
 * After the fix the delete succeeds, the room stays for its other members and
 * its creator is NULL.
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
    const members = await query(`SELECT user_id FROM room_members WHERE room_id = $1`, [roomId]);
    assert.deepStrictEqual(members.rows.map((r) => String(r.user_id)), [member], 'other member still in the room');
    console.log('ok  - room stays for its other members with a NULL creator');

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
