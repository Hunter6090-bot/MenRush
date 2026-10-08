/**
 * Integration (real Postgres + PostGIS): hot-spot list for Free and Premium.
 * Free default sort and sort=live must run without a SQL error, never carry
 * live_count_exact, and order by rounded count (0 to 4, then 5+), then
 * distance, then id. Premium keeps the exact-count sort. Closest and search
 * paths run for both. Free last_activity_at is floored to 15 minutes.
 * The Free viewer is forced non-Premium here, whatever the env says about free Premium.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npm run test:hot-spot-live-sort-integration
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('hot-spot-live-sort-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

// Spots sit together at an isolated spot so other local rows cannot interfere.
const LAT = 60.7712;
const LNG = -0.8523;
const KM_LAT = 1 / 111.2; // degrees of latitude per km

// Fixed ids so the id tie-break is known: tie-low < tie-high.
const ID = {
  near6: '00000000-0000-4000-8000-0000000a0001',
  far9: '00000000-0000-4000-8000-0000000a0002',
  tieHigh7: '00000000-0000-4000-8000-0000000a0004',
  tieLow5: '00000000-0000-4000-8000-0000000a0003',
  few2: '00000000-0000-4000-8000-0000000a0005',
  empty0: '00000000-0000-4000-8000-0000000a0006',
};

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { premiumService } = await import('../src/services/premium.service');
  const { hotSpotsService } = await import('../src/services/hot-spots.service');

  const premiumIds = new Set<string>();
  // Force the viewer tier: the free-Premium env flag (default on) would make everyone Premium.
  (premiumService as unknown as { isPremium: unknown }).isPremium = async (uid: string) => premiumIds.has(uid);

  const userIds: string[] = [];
  const spotIds = Object.values(ID);
  async function makeUser(name: string) {
    const id = randomUUID();
    userIds.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [id, `hsls-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    return id;
  }

  try {
    await query(`DELETE FROM hot_spots WHERE id = ANY($1::uuid[])`, [spotIds]);
    const cat = await query(
      `SELECT id FROM hot_spot_categories WHERE is_commercial = TRUE ORDER BY (slug = 'saunas') DESC, id LIMIT 1`,
    );
    const categoryId = cat.rows[0]?.id;
    assert.ok(categoryId, 'a commercial hot-spot category exists');

    // [id, km north of the viewer, exact live count]
    const spots: Array<[string, number, number]> = [
      [ID.near6, 1, 6],
      [ID.far9, 3, 9],
      [ID.tieLow5, 2, 5],
      [ID.tieHigh7, 2, 7],
      [ID.few2, 0.5, 2],
      [ID.empty0, 0.2, 0],
    ];
    for (const [id, km, _n] of spots) {
      await query(
        `INSERT INTO hot_spots (id, category_id, name, city, latitude, longitude, is_user_generated, is_active, last_activity_at)
         VALUES ($1, $2, $3, 'Test', $4, $5, FALSE, TRUE, $6)`,
        [id, categoryId, `HSLS ${id.slice(-4)}`, LAT + km * KM_LAT, LNG, '2026-10-08T21:52:37.123Z'],
      );
    }
    const totalCheckins = spots.reduce((sum, s) => sum + s[2], 0);
    const checkers: string[] = [];
    for (let i = 0; i < totalCheckins; i += 1) checkers.push(await makeUser(`HSLS Checker ${i}`));
    let next = 0;
    for (const [id, , n] of spots) {
      for (let i = 0; i < n; i += 1) {
        await query(
          `INSERT INTO hot_spot_checkins (spot_id, user_id, is_anonymous) VALUES ($1, $2, TRUE)`,
          [id, checkers[next++]],
        );
      }
    }

    const freeViewer = await makeUser('HSLS Free');
    const premiumViewer = await makeUser('HSLS Premium');
    premiumIds.add(premiumViewer);
    assert.strictEqual(await premiumService.isPremium(freeViewer), false, 'Free viewer is forced non-Premium');

    const base = { lat: LAT, lng: LNG, radiusKm: 10 };
    const ours = <T extends { id: string }>(rows: T[]) => rows.filter((r) => spotIds.includes(r.id));
    const freeOrder = [ID.near6, ID.tieLow5, ID.tieHigh7, ID.far9, ID.few2, ID.empty0];
    const premiumOrder = [ID.far9, ID.tieHigh7, ID.near6, ID.tieLow5, ID.few2, ID.empty0];

    // Free: default sort (route default for the Discover list) and sort=live.
    for (const sortBy of [undefined, 'live'] as const) {
      const rows = ours(await hotSpotsService.listNearby({ userId: freeViewer, ...base, sortBy }));
      assert.deepStrictEqual(rows.map((r) => r.id), freeOrder, `Free sort=${sortBy ?? 'default'}: rounded count, then distance, then id`);
      for (const r of rows) {
        assert.strictEqual(r.live_count_exact, null, `Free sort=${sortBy ?? 'default'}: no live_count_exact`);
        assert.ok(r.live_count === '5+' || (typeof r.live_count === 'number' && r.live_count < 5), 'Free count is rounded');
        assert.strictEqual(r.last_activity_at, '2026-10-08T21:45:00.000Z', 'Free activity time floored to 15 minutes');
      }
    }
    // LIMIT runs after the rounded sort: the top 2 for Free are the nearest 5+ spots, not the busiest.
    const freeTop2 = await hotSpotsService.listNearby({ userId: freeViewer, ...base, sortBy: 'live', limit: 2 });
    assert.deepStrictEqual(freeTop2.map((r) => r.id), [ID.near6, ID.tieLow5], 'Free LIMIT picks rows on the rounded sort');

    // Premium: exact sort, exact counts and time.
    const premiumRows = ours(await hotSpotsService.listNearby({ userId: premiumViewer, ...base, sortBy: 'live' }));
    assert.deepStrictEqual(premiumRows.map((r) => r.id), premiumOrder, 'Premium sort=live: exact count first');
    assert.deepStrictEqual(premiumRows.map((r) => r.live_count_exact), [9, 7, 6, 5, 2, 0], 'Premium exact counts');
    assert.strictEqual(premiumRows[0].last_activity_at, '2026-10-08T21:52:37.123Z', 'Premium activity time exact');

    // Closest and search paths run on real PG for both tiers.
    const byDistance = [ID.empty0, ID.few2, ID.near6, ID.tieLow5, ID.tieHigh7, ID.far9];
    for (const viewer of [freeViewer, premiumViewer]) {
      const closest = ours(await hotSpotsService.listNearby({ userId: viewer, ...base, sortBy: 'closest' }));
      assert.strictEqual(closest.length, 6, 'closest returns all spots');
      // Equal distance falls back to name; names follow the id suffix, so tieLow5 comes first.
      assert.deepStrictEqual(closest.map((r) => r.id), byDistance, 'closest orders by distance, then name');
      const searched = ours(await hotSpotsService.listNearby({ userId: viewer, lat: LAT, lng: LNG, query: 'HSLS' }));
      assert.strictEqual(searched.length, 6, 'search returns all spots');
      const cruising = await hotSpotsService.listNearby({ userId: viewer, ...base, cruisingOnly: true });
      assert.ok(Array.isArray(cruising), 'cruising list runs');
    }

    // Free check-in then refresh (the flow that showed "Check-in failed").
    const afterCheckIn = await hotSpotsService.checkIn(freeViewer, ID.few2, true);
    assert.strictEqual(afterCheckIn?.live_count, 3);
    assert.strictEqual(afterCheckIn?.live_count_exact, null);
    const refreshed = ours(await hotSpotsService.listNearby({ userId: freeViewer, ...base }));
    assert.strictEqual(refreshed.length, 6, 'list refresh after check-in runs');
    assert.strictEqual(refreshed.find((r) => r.id === ID.few2)?.is_checked_in, true);
    const single = await hotSpotsService.getSpot(freeViewer, ID.far9);
    assert.strictEqual(single?.live_count, '5+');
    assert.strictEqual(single?.live_count_exact, null);

    console.log('✓ Free default and sort=live: no error, no exact, rounded then distance then id');
    console.log('✓ Premium exact sort; closest, search, cruising, check-in refresh run on real PG');
    console.log('hot-spot-live-sort-integration: ok');
  } finally {
    await query(`DELETE FROM hot_spots WHERE id = ANY($1::uuid[])`, [spotIds]).catch(() => undefined);
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
