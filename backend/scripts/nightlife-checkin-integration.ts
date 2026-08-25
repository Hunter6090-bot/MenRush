/**
 * Integration: event venue check-in creates a Hot Spot pin with 4h TTL.
 * Requires local DATABASE_URL. Run from backend/:
 *   DATABASE_URL=postgresql://menrush:menrush123@localhost:5432/menrush \
 *   JWT_SECRET=dev npx ts-node scripts/nightlife-checkin-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import { query } from '../src/db';
import { hotSpotsService, ACTIVE_CHECKIN_TTL_HOURS } from '../src/services/hot-spots.service';
import pool from '../src/db';

async function main() {
  assert.strictEqual(ACTIVE_CHECKIN_TTL_HOURS, 4);

  const userId = randomUUID();
  const eventId = randomUUID();
  const email = `nightlife-${userId.slice(0, 8)}@test.menrush.local`;

  await query(
    `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status)
     VALUES ($1, $2, 'x', 'Nightlife Tester', 28, TRUE, 'verified')
     ON CONFLICT (id) DO NOTHING`,
    [userId, email],
  );

  await query(
    `INSERT INTO rooms (id, name, description, created_by, kind, starts_at, ends_at, venue_name, lat, lng, location)
     VALUES (
       $1, 'UK Copper Night', 'Test nightlife event', $2, 'event',
       NOW() - INTERVAL '1 hour', NOW() + INTERVAL '3 hours',
       'The Copper Bar', 57.1497, -2.0943,
       ST_SetSRID(ST_MakePoint(-2.0943, 57.1497), 4326)::geography
     )`,
    [eventId, userId],
  );

  const spot = await hotSpotsService.checkInAtEvent(
    userId,
    {
      id: eventId,
      name: 'UK Copper Night',
      venue_name: 'The Copper Bar',
      lat: 57.1497,
      lng: -2.0943,
    },
    false,
  );

  assert.ok(spot, 'spot returned');
  assert.strictEqual(spot!.name, 'The Copper Bar');
  assert.strictEqual(spot!.checkin_ttl_hours, 4);
  assert.strictEqual(spot!.has_active_checkins, true);
  assert.ok(spot!.live_count_exact >= 1);
  assert.strictEqual(spot!.is_checked_in, true);
  assert.strictEqual(spot!.category_slug, 'nightlife');

  const linked = await query(`SELECT event_id FROM hot_spots WHERE id = $1`, [spot!.id]);
  assert.strictEqual(linked.rows[0].event_id, eventId);

  // Expired check-ins must not count: backdate beyond TTL
  await query(
    `UPDATE hot_spot_checkins
        SET checked_in_at = NOW() - INTERVAL '${ACTIVE_CHECKIN_TTL_HOURS + 1} hours'
      WHERE user_id = $1 AND spot_id = $2`,
    [userId, spot!.id],
  );

  const afterExpiry = await hotSpotsService.getSpot(userId, spot!.id);
  assert.ok(afterExpiry);
  assert.strictEqual(afterExpiry!.has_active_checkins, false);
  assert.strictEqual(afterExpiry!.live_count_exact, 0);
  assert.strictEqual(afterExpiry!.is_checked_in, false);

  // cleanup
  await query(`DELETE FROM hot_spot_checkins WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM hot_spots WHERE event_id = $1`, [eventId]);
  await query(`DELETE FROM rooms WHERE id = $1`, [eventId]);
  await query(`DELETE FROM users WHERE id = $1`, [userId]);

  console.log('nightlife-checkin-integration: ok');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
