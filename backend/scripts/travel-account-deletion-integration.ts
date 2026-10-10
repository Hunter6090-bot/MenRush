/**
 * Real PG: deleting an account erases the member's Travel trips in the same
 * transaction as the user delete (travel_trips.user_id ON DELETE CASCADE),
 * and a failure anywhere in that transaction — even at COMMIT, after the
 * cascade ran — rolls everything back: user and trips both still there.
 *   DATABASE_URL=postgresql://localhost:5432/menrush_test npx ts-node scripts/travel-account-deletion-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('travel-account-deletion-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
process.env.JWT_SECRET ||= 'travel-account-deletion-integration-placeholder';

let passed = 0;
const ok = (n: string) => {
  passed += 1;
  console.log(`ok - ${n}`);
};

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const bcrypt = (await import('bcryptjs')).default;
  const password = 'pw-travel-123456';
  const hash = await bcrypt.hash(password, 4);
  const ids: string[] = [];

  async function memberWithTrips() {
    const id = randomUUID();
    ids.push(id);
    await query(`INSERT INTO users (id, email, password_hash, name, age) VALUES ($1, $2, $3, 'TD Member', 30)`, [
      id,
      `td-${id.slice(0, 8)}@test.menrush.local`,
      hash,
    ]);
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, is_visible, is_ghost)
       VALUES ($1, ST_MakePoint(-0.12, 51.5)::geography, 51.5, -0.12, TRUE, FALSE)`,
      [id],
    );
    // One live trip and one ended trip.
    await query(
      `INSERT INTO travel_trips (user_id, city_name, country_code, centre_lat, centre_lng,
                                 south, north, west, east, starts_at, ends_at, ended_at)
       VALUES ($1, 'Manchester', 'gb', 53.45, -2.23, 53.34, 53.55, -2.32, -2.14, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days', NULL),
              ($1, 'Leeds', 'gb', 53.8, -1.55, 53.7, 53.9, -1.7, -1.4, NOW() - INTERVAL '9 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days')`,
      [id],
    );
    return id;
  }
  const trips = async (id: string) =>
    Number((await query(`SELECT COUNT(*)::int AS n FROM travel_trips WHERE user_id = $1`, [id])).rows[0].n);
  const userExists = async (id: string) =>
    (await query(`SELECT 1 FROM users WHERE id = $1`, [id])).rows.length === 1;
  const del = (id: string) => authService.deleteAccount(id, { current_password: password, confirmation: 'DELETE' } as any);

  try {
    // ── Deleted member's trips are gone ──────────────────────────────────────
    const a = await memberWithTrips();
    const bystander = await memberWithTrips();
    assert.strictEqual(await trips(a), 2);
    assert.deepStrictEqual(await del(a), { ok: true });
    assert.strictEqual(await userExists(a), false);
    assert.strictEqual(await trips(a), 0, 'live and ended trips erased');
    assert.strictEqual(await trips(bystander), 2, "other members' trips untouched");
    ok("deleting an account erases that member's trips (live and ended), nobody else's");

    // ── Failure at COMMIT, after the cascade ran: nothing is lost ───────────
    const b = await memberWithTrips();
    // Test-only deferred trigger: raises at COMMIT when b's trips are deleted.
    await query(`CREATE OR REPLACE FUNCTION td_test_fail_commit() RETURNS trigger LANGUAGE plpgsql AS $$
                 BEGIN RAISE EXCEPTION 'td simulated failure at commit'; END $$`);
    await query(`DROP TRIGGER IF EXISTS td_test_fail_commit ON travel_trips`);
    await query(
      `CREATE CONSTRAINT TRIGGER td_test_fail_commit AFTER DELETE ON travel_trips
         DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
         WHEN (OLD.user_id = '${b}'::uuid) EXECUTE FUNCTION td_test_fail_commit()`,
    );
    try {
      await assert.rejects(() => del(b), /td simulated failure at commit/);
    } finally {
      await query(`DROP TRIGGER IF EXISTS td_test_fail_commit ON travel_trips`);
      await query(`DROP FUNCTION IF EXISTS td_test_fail_commit()`);
    }
    assert.strictEqual(await userExists(b), true, 'user rolled back');
    assert.strictEqual(await trips(b), 2, 'trips rolled back with the user');
    const loc = (await query(`SELECT lat FROM profiles WHERE user_id = $1`, [b])).rows[0];
    assert.strictEqual(Number(loc.lat), 51.5, 'location erase rolled back too');
    ok('a failure at COMMIT (after the cascade) rolls back the user, trips and location erase');

    // ── Failure before the delete: also nothing lost, and a retry works ─────
    const { locationRetentionService } = await import('../src/services/location-retention.service');
    const realErase = locationRetentionService.eraseAccountLocationData;
    (locationRetentionService as any).eraseAccountLocationData = async () => {
      throw new Error('td simulated erase failure');
    };
    try {
      await assert.rejects(() => del(b), /td simulated erase failure/);
    } finally {
      (locationRetentionService as any).eraseAccountLocationData = realErase;
    }
    assert.strictEqual(await userExists(b), true);
    assert.strictEqual(await trips(b), 2);
    assert.deepStrictEqual(await del(b), { ok: true }, 'retry succeeds');
    assert.strictEqual(await trips(b), 0);
    ok('a failure mid-transaction rolls back; the retry erases the trips');

    console.log(`travel-account-deletion-integration: ${passed} passed`);
  } finally {
    for (const id of ids) {
      await query(`DELETE FROM travel_trips WHERE user_id = $1`, [id]).catch(() => undefined);
      await query(`DELETE FROM users WHERE id = $1`, [id]).catch(() => undefined);
    }
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
