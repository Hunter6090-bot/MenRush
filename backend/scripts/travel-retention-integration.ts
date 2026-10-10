/**
 * Integration: Travel trip retention on real Postgres.
 *   - Ending (deleting) a trip deletes its place and dates at once.
 *   - Replacing a trip deletes the old one at once.
 *   - Ended trips are deleted 30 days after they end (ends_at, or ended_at if
 *     it ended early, e.g. Premium lapse); newer ones are kept.
 * Needs a migrated DATABASE_URL. Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npx ts-node scripts/travel-retention-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('travel-retention-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { travelService, TRAVEL_TRIP_RETENTION_DAYS } = await import('../src/services/travel.service');
  const { premiumService } = await import('../src/services/premium.service');
  const { ukToday } = await import('../src/lib/travel');

  const ids: string[] = [];
  async function makeUser(name: string) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status,
                          verification_provider, photo_url, is_premium, premium_tier, premium_until)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', 'veriff', '/uploads/test.jpg', TRUE, 'premium',
               NOW() + INTERVAL '30 days')`,
      [id, `trr-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
       VALUES ($1, ST_MakePoint(-0.1278, 51.5074)::geography, 51.5074, -0.1278, TRUE, NOW(), TRUE, FALSE)`,
      [id],
    );
    return id;
  }
  const rows = async (userId: string) =>
    (await query(`SELECT id, city_name, centre_lat, starts_at, ends_at, ended_at FROM travel_trips WHERE user_id = $1`, [userId])).rows;
  const exists = async (tripId: string) =>
    (await query(`SELECT 1 FROM travel_trips WHERE id = $1`, [tripId])).rows.length === 1;
  async function insertTrip(userId: string, endsDaysAgo: number, endedDaysAgo: number | null) {
    // Closed rows (ended_at set) don't hit the one-open-trip index.
    const res = await query(
      `INSERT INTO travel_trips (user_id, city_name, country_code, centre_lat, centre_lng,
                                 south, north, west, east, starts_at, ends_at, ended_at)
       VALUES ($1, 'Manchester', 'gb', 53.48, -2.24, 53.3, 53.6, -2.4, -2.1,
               NOW() - make_interval(days => $2::int + 3), NOW() - make_interval(days => $2::int),
               CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() - make_interval(days => $3::int) END)
       RETURNING id`,
      [userId, endsDaysAgo, endedDaysAgo],
    );
    return res.rows[0].id as string;
  }

  const origBetaFree = premiumService.isBetaPremiumFree;
  premiumService.isBetaPremiumFree = () => false;
  const today = ukToday();
  try {
    assert.strictEqual(TRAVEL_TRIP_RETENTION_DAYS, 30);
    const a = await makeUser('TRR A');

    // ── Member ends (deletes) the trip: row gone at once ──
    const t1 = await travelService.planTrip(a, { city: 'Manchester', startsOn: today, endsOn: today });
    assert.ok(await exists(t1.id));
    assert.deepStrictEqual(await travelService.endTrip(a), { ended: true });
    assert.strictEqual(await exists(t1.id), false, 'ended trip: place and dates deleted at once');
    assert.strictEqual((await rows(a)).length, 0);
    assert.deepStrictEqual(await travelService.endTrip(a), { ended: false }, 'nothing left to end');

    // ── Replacing a trip deletes the old one at once ──
    const t2 = await travelService.planTrip(a, { city: 'Manchester', startsOn: today, endsOn: today });
    const t3 = await travelService.planTrip(a, { city: 'Manchester', startsOn: today, endsOn: today });
    assert.strictEqual(await exists(t2.id), false, 'replaced trip deleted at once');
    assert.ok(await exists(t3.id));
    assert.strictEqual((await rows(a)).length, 1, 'only the new trip is stored');

    // ── 30-day purge ──
    const b = await makeUser('TRR B');
    const ended31 = await insertTrip(b, 31, 31); // ran to its end date 31 days ago
    const ended29 = await insertTrip(b, 29, 29); // ended 29 days ago: kept
    const lapsed31 = await insertTrip(b, 10, 31); // ended early (lapse) 31 days ago; ends_at only 10 days ago
    const lapsed20 = await insertTrip(b, 0, 20); // ends_at now, ended early 20 days ago: kept
    const c = await makeUser('TRR C');
    const openStale = await insertTrip(c, 35, null); // never tidied, ends_at 35 days ago
    const cLive = await makeUser('TRR Live');
    const live = await travelService.planTrip(cLive, { city: 'Manchester', startsOn: today, endsOn: today });

    const n = await travelService.purgeEndedTrips();
    assert.ok(n >= 3, `purged at least 3, got ${n}`);
    assert.strictEqual(await exists(ended31), false, 'trip ended 31 days ago: deleted');
    assert.strictEqual(await exists(lapsed31), false, 'trip that ended early 31 days ago: deleted (counts from ended_at)');
    assert.strictEqual(await exists(openStale), false, 'untidied open trip 35 days past its end: deleted');
    assert.ok(await exists(ended29), 'trip ended 29 days ago: kept');
    assert.ok(await exists(lapsed20), 'trip ended 20 days ago: kept');
    assert.ok(await exists(live.id), 'live trip: kept');
    assert.ok(await exists(t3.id), "A's current trip: kept");

    console.log('travel-retention-integration: OK');
  } finally {
    premiumService.isBetaPremiumFree = origBetaFree;
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
