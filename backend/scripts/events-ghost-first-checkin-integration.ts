/**
 * Integration (real Postgres + PostGIS): a Ghost or hidden member who is first to
 * check in at an event with no spot does not create a public spot or pin.
 * - Ghost first: checkInAtEvent returns null, no hot_spots row for the event,
 *   no check-in row, nothing near the venue in the public list.
 * - Hidden (is_visible = FALSE) first: same.
 * - The first visible check-in creates the pin and counts.
 * - Once the pin exists, a Ghost member checks in as usual (their own check-in).
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://localhost:5432/menrush_ci npm run test:events-ghost-first-checkin
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('events-ghost-first-checkin-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

// Isolated venue far from any seeded spot.
const LAT = 58.9113;
const LNG = -3.5127;

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { hotSpotsService } = await import('../src/services/hot-spots.service');

  const userIds: string[] = [];
  const eventIds: string[] = [];
  async function makeUser(name: string, profile?: { ghost?: boolean; visible?: boolean }) {
    const id = randomUUID();
    userIds.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [id, `egfc-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    if (profile) {
      await query(
        `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
         VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), $4, $5)`,
        [id, LAT, LNG, profile.visible ?? true, profile.ghost ?? false],
      );
    }
    return id;
  }
  async function makeEvent(owner: string, name: string, lat: number) {
    const id = randomUUID();
    eventIds.push(id);
    await query(
      `INSERT INTO rooms (id, name, description, created_by, kind, starts_at, ends_at, venue_name, lat, lng, location)
       VALUES ($1, $2::text, 'Test event', $3, 'event', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '3 hours',
               $2::text, $4::float8, $5::float8, ST_SetSRID(ST_MakePoint($5::float8, $4::float8), 4326)::geography)`,
      [id, name, owner, lat, LNG],
    );
    return { id, name, venue_name: name, lat, lng: LNG };
  }
  const spotsFor = async (eventId: string) =>
    (await query(`SELECT id FROM hot_spots WHERE event_id = $1`, [eventId])).rows.map((r) => r.id as string);
  const spotsNear = async (lat: number) =>
    (
      await query(
        `SELECT id FROM hot_spots
          WHERE ST_DWithin(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                           ST_MakePoint($2, $1)::geography, 200)`,
        [lat, LNG],
      )
    ).rows.length;
  const checkinsBy = async (uid: string) =>
    Number((await query(`SELECT COUNT(*)::int AS n FROM hot_spot_checkins WHERE user_id = $1`, [uid])).rows[0].n);

  try {
    const owner = await makeUser('EGFC Owner', {});
    const ghost = await makeUser('EGFC Ghost', { ghost: true });
    const hidden = await makeUser('EGFC Hidden', { visible: false });
    const visible = await makeUser('EGFC Visible', {});
    const noProfile = await makeUser('EGFC No profile');

    // ── Ghost first at a venue with no spot: nothing is created.
    const ev1 = await makeEvent(owner, 'EGFC Night One', LAT);
    assert.strictEqual(await hotSpotsService.checkInAtEvent(ghost, ev1, false), null, 'Ghost first check-in is deferred');
    assert.deepStrictEqual(await spotsFor(ev1.id), [], 'no spot created for the event');
    assert.strictEqual(await spotsNear(LAT), 0, 'no spot or pin near the venue');
    assert.strictEqual(await checkinsBy(ghost), 0, 'no check-in row written');
    const list = await hotSpotsService.listNearby({ userId: visible, lat: LAT, lng: LNG, radiusKm: 5 });
    assert.strictEqual(list.length, 0, 'public list shows nothing at the venue');

    // ── Hidden first (anonymous or not): same.
    assert.strictEqual(await hotSpotsService.checkInAtEvent(hidden, ev1, true), null, 'hidden first check-in is deferred');
    assert.deepStrictEqual(await spotsFor(ev1.id), [], 'still no spot');
    assert.strictEqual(await checkinsBy(hidden), 0);

    // ── First visible check-in creates the pin and counts 1.
    const created = await hotSpotsService.checkInAtEvent(visible, ev1, true);
    assert.ok(created?.id, 'visible check-in creates the pin');
    assert.deepStrictEqual(await spotsFor(ev1.id), [created!.id]);
    assert.strictEqual(created?.is_checked_in, true);
    assert.ok(created?.has_active_checkins, 'pin shows activity from the visible check-in');

    // ── Once the pin exists, Ghost checks in as usual (their own check-in, same pin).
    const ghostThere = await hotSpotsService.checkInAtEvent(ghost, ev1, false);
    assert.strictEqual(ghostThere?.id, created!.id, 'Ghost uses the existing pin');
    assert.strictEqual(ghostThere?.is_checked_in, true, 'Ghost sees their own check-in');
    assert.deepStrictEqual(await spotsFor(ev1.id), [created!.id], 'no second spot');

    // ── A member with no profile row counts as visible, as before: creates the pin.
    const ev2 = await makeEvent(owner, 'EGFC Night Two', LAT + 0.05);
    const byNoProfile = await hotSpotsService.checkInAtEvent(noProfile, ev2, false);
    assert.ok(byNoProfile?.id, 'no profile row: pin created as before');

    console.log('events-ghost-first-checkin-integration: ok');
  } finally {
    const spotIds = (
      await query(`SELECT id FROM hot_spots WHERE event_id = ANY($1::uuid[])`, [eventIds]).catch(() => ({ rows: [] }))
    ).rows.map((r: { id: string }) => r.id);
    await query(`DELETE FROM hot_spot_checkins WHERE spot_id = ANY($1::uuid[]) OR user_id = ANY($2::uuid[])`, [spotIds, userIds]).catch(() => undefined);
    await query(`DELETE FROM hot_spots WHERE id = ANY($1::uuid[])`, [spotIds]).catch(() => undefined);
    await query(`DELETE FROM rooms WHERE id = ANY($1::uuid[])`, [eventIds]).catch(() => undefined);
    await query(`DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [userIds]).catch(() => undefined);
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('events-ghost-first-checkin-integration: FAILED', err);
  process.exit(1);
});
