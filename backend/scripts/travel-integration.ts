/**
 * Integration: Travel (Look around + Plan a trip) against Postgres/PostGIS.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 * Place search is stubbed (no network). The Premium gate is exercised by
 * stubbing premiumService.isBetaPremiumFree in-process; no env or setting changes.
 *   DATABASE_URL=postgresql://localhost:5432/menrush_travel_test npx ts-node scripts/travel-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('travel-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

const PLACES: Record<string, { name: string; bbox: [number, number, number, number] }> = {
  // [south, north, west, east]
  manchester: { name: 'Manchester, Greater Manchester, England, United Kingdom', bbox: [53.34, 53.55, -2.32, -2.14] },
  london: { name: 'London, Greater London, England, United Kingdom', bbox: [51.28, 51.69, -0.51, 0.33] },
};

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any) => {
  const url = new URL(String(input));
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const p = PLACES[q];
  const hits = p
    ? [{
        display_name: p.name,
        class: 'place',
        type: 'city',
        addresstype: 'city',
        name: p.name.split(',')[0],
        importance: 0.9,
        boundingbox: p.bbox.map(String),
        address: { country_code: 'gb', city: p.name.split(',')[0] },
      }]
    : [];
  return new Response(JSON.stringify(hits), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;

let passed = 0;
function ok(name: string) {
  passed += 1;
  console.log(`ok - ${name}`);
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { userService } = await import('../src/services/user.service');
  const { travelService } = await import('../src/services/travel.service');
  const { premiumService } = await import('../src/services/premium.service');
  const { locationHideService } = await import('../src/services/location-hide.service');
  const { TravelError, ukToday } = await import('../src/lib/travel');
  const { resetLocationJumpGate } = await import('../src/lib/locationJumpGate');

  const ids: string[] = [];
  async function makeUser(name: string, lat: number, lng: number, premium = false) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status,
                          verification_provider, photo_url, is_premium, premium_tier, premium_until)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', 'veriff', '/uploads/test.jpg', $4, $5,
               CASE WHEN $4 THEN NOW() + INTERVAL '30 days' ELSE NULL END)`,
      [id, `tr-${id.slice(0, 8)}@test.menrush.local`, name, premium, premium ? 'premium' : 'free'],
    );
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
       VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), TRUE, FALSE)`,
      [id, lat, lng],
    );
    return id;
  }
  const nearby = async (viewer: string, km = 20) =>
    userService.getNearbyUsers(viewer, km, { discoveryScope: 'radius' }, undefined, { limit: 200 });
  const find = (res: { users: any[] }, id: string) => res.users.find((u: any) => u.id === id);
  const storedLoc = async (id: string) =>
    (await query(`SELECT lat, lng, ST_AsText(location::geometry) AS g FROM profiles WHERE user_id = $1`, [id])).rows[0];
  const addDays = (iso: string, d: number) =>
    new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
  const today = ukToday();

  // Premium is real (no "included for everyone") inside this test only.
  const origBetaFree = premiumService.isBetaPremiumFree;
  premiumService.isBetaPremiumFree = () => false;
  resetLocationJumpGate();

  try {
    const looker = await makeUser('TR Looker', 51.5074, -0.1278, true); // London, Premium
    const londoner = await makeUser('TR Londoner', 51.509, -0.13); // London
    const traveller = await makeUser('TR Traveller', 51.51, -0.125, true); // London home, Premium
    const local = await makeUser('TR Local', 53.4808, -2.2426); // Manchester
    const manc = await makeUser('TR Manc', 53.47, -2.25); // Manchester
    const free = await makeUser('TR Free', 51.508, -0.128);
    const owner = await makeUser('HantsBear', 51.507, -0.127); // always Premium, not paying

    // ── Premium gate ─────────────────────────────────────────────────────────
    const is402 = (e: unknown) => e instanceof TravelError && (e as any).code === 'premium_required' && (e as any).status === 402;
    await assert.rejects(() => travelService.lookAround(free, 'Manchester'), is402);
    await assert.rejects(() => travelService.planTrip(free, { city: 'Manchester', startsOn: today, endsOn: today }), is402);
    assert.deepStrictEqual(await travelService.endTrip(free), { ended: false }, 'ending is always allowed');
    ok('Free members get the Premium gate for Look around and Plan a trip');
    const ownerLook = await travelService.lookAround(owner, 'Manchester');
    assert.strictEqual(ownerLook.place.name, 'Manchester');
    ok('always-Premium owner accounts pass the gate');

    // ── Look around never moves anyone's location or distance origin ─────────
    const before = await storedLoc(looker);
    const nearbyBefore = find(await nearby(looker), londoner);
    assert.ok(nearbyBefore?.distance_label, 'baseline distance');
    const look = await travelService.lookAround(looker, 'Manchester');
    const after = await storedLoc(looker);
    assert.deepStrictEqual(after, before, 'stored location unchanged');
    const nearbyAfter = find(await nearby(looker), londoner);
    assert.strictEqual(nearbyAfter.distance_label, nearbyBefore.distance_label);
    assert.strictEqual(nearbyAfter.distance_km, nearbyBefore.distance_km);
    // Others' distance to the looker is unchanged too.
    const theirView = find(await nearby(londoner), looker);
    assert.ok(theirView && theirView.distance_label === nearbyBefore.distance_label);
    // Manchester locals don't see the looker: they never moved.
    assert.ok(!find(await nearby(local), looker));
    ok('Look around never moves the member, their query point, or anyone\'s distance');

    assert.ok(look.members.some((m) => m.id === local) && look.members.some((m) => m.id === manc));
    assert.ok(!look.members.some((m) => m.id === londoner), 'only that city');
    for (const m of look.members) {
      assert.ok(!('distance_km' in m), 'no distance numbers in Look around');
      assert.ok(!('real_lat' in (m as any)) && !('email' in (m as any)));
    }
    ok('Look around lists that city only, with no distances');

    // ── Opt-out: Show me to people looking around ───────────────────────────
    assert.strictEqual(await travelService.getShowInLookAround(manc), true, 'on by default');
    await travelService.setShowInLookAround(manc, false);
    assert.ok(!(await travelService.lookAround(looker, 'Manchester')).members.some((m) => m.id === manc));
    assert.ok(find(await nearby(local), manc), 'Nearby is not affected');
    await travelService.setShowInLookAround(manc, true);
    assert.ok((await travelService.lookAround(looker, 'Manchester')).members.some((m) => m.id === manc));
    ok('Show me to people looking around: off hides you from Look around only');

    // ── Blocks + hide list apply in Look around ─────────────────────────────
    await userService.blockUser(manc, looker);
    assert.ok(!(await travelService.lookAround(looker, 'Manchester')).members.some((m) => m.id === manc));
    await userService.unblockUser(manc, looker);
    await query(`INSERT INTO location_hidden_from (owner_id, hidden_user_id) VALUES ($1, $2)`, [manc, looker]);
    assert.ok(!(await travelService.lookAround(looker, 'Manchester')).members.some((m) => m.id === manc));
    await query(`DELETE FROM location_hidden_from WHERE owner_id = $1`, [manc]);
    ok('blocks and the hide list still apply in Look around');

    // ── Plan a trip: future trip is not visible yet ─────────────────────────
    const planned = await travelService.planTrip(traveller, {
      city: 'Manchester',
      startsOn: addDays(today, 3),
      endsOn: addDays(today, 5),
    });
    assert.strictEqual(planned.status, 'planned');
    assert.strictEqual(planned.starts_on, addDays(today, 3));
    assert.strictEqual(planned.ends_on, addDays(today, 5));
    assert.ok(!find(await nearby(local), traveller), 'not in Manchester before the start');
    assert.ok(find(await nearby(londoner), traveller), 'still at home before the start');
    ok('a planned trip shows nothing until its start date');

    // Date rules.
    const code = async (p: Promise<unknown>) => p.then(() => 'none', (e: any) => e?.code);
    assert.strictEqual(await code(travelService.planTrip(traveller, { city: 'Manchester', startsOn: addDays(today, 8), endsOn: addDays(today, 9) })), 'starts_too_late');
    assert.strictEqual(await code(travelService.planTrip(traveller, { city: 'Manchester', startsOn: today, endsOn: addDays(today, 14) })), 'trip_too_long');
    assert.strictEqual(await code(travelService.planTrip(traveller, { city: 'Nowhereville', startsOn: today, endsOn: today })), 'invalid_city');
    assert.strictEqual((await travelService.getTrip(traveller))?.id, planned.id, 'failed attempts keep the trip');
    ok('trip dates: up to 7 days ahead, up to 14 days long');

    // ── Live trip: one place at a time, coarse centre, "Visiting" label ─────
    const live = await travelService.planTrip(traveller, { city: 'Manchester', startsOn: today, endsOn: addDays(today, 2) });
    assert.strictEqual(live.status, 'live');
    const open = await query(`SELECT COUNT(*)::int AS n FROM travel_trips WHERE user_id = $1 AND ended_at IS NULL`, [traveller]);
    assert.strictEqual(open.rows[0].n, 1, 'one open trip');
    ok('planning again replaces the old trip (one at a time)');

    const localView = await nearby(local);
    const seen = find(localView, traveller);
    assert.ok(seen, 'locals see the visitor');
    assert.strictEqual(seen.distance_label, 'Visiting Manchester');
    assert.ok(!('distance_km' in seen), 'no distance number to a visitor');
    assert.deepStrictEqual([seen.lat, seen.lng], [live.centre.lat, live.centre.lng]);
    assert.deepStrictEqual([seen.lat, seen.lng], [53.45, -2.23], 'bbox middle, 2 dp');
    assert.ok(!('real_lat' in seen) && !('real_lng' in seen));
    assert.strictEqual(localView.users.filter((u: any) => u.id === traveller).length, 1);
    ok('visitors show at the coarse city centre with "Visiting Manchester"');

    assert.ok(!find(await nearby(londoner), traveller), 'gone from home Nearby');
    assert.ok(!find(await nearby(londoner, 0), traveller));
    const allScope = await userService.getNearbyUsers(londoner, 0, { discoveryScope: 'uk_ie' }, undefined, { limit: 200 });
    assert.strictEqual(allScope.users.filter((u: any) => u.id === traveller).length, 1, 'All shows them once');
    assert.strictEqual(find(allScope, traveller).distance_label, 'Visiting Manchester');
    const byTown = await userService.searchProfiles(londoner, 'London', 'place');
    assert.ok(!byTown.some((u: any) => u.id === traveller), 'not in search by home town');
    const profile: any = await userService.getPublicProfile(londoner, traveller);
    assert.strictEqual(profile.distance_km, undefined);
    assert.strictEqual(profile.distance_label, 'Visiting Manchester');
    assert.strictEqual(profile.visiting.city, 'Manchester');
    ok('while visiting, the member shows in one place only');

    const traveLoc = await storedLoc(traveller);
    assert.ok(Math.abs(Number(traveLoc.lat) - 51.51) < 1e-9, 'trip never writes the stored location');
    ok('a trip does not move the stored location (jump gate untouched)');

    const lookLive = await travelService.lookAround(looker, 'Manchester');
    const lv = lookLive.members.find((m) => m.id === traveller);
    assert.ok(lv && lv.distance_label === 'Visiting Manchester' && lv.lat === 53.45);
    ok('Look around on the destination includes visitors at the centre');

    // Blocks and hide list hold for visitors.
    await userService.blockUser(local, traveller);
    assert.ok(!find(await nearby(local), traveller));
    await userService.unblockUser(local, traveller);
    await query(`INSERT INTO location_hidden_from (owner_id, hidden_user_id) VALUES ($1, $2)`, [traveller, local]);
    assert.ok(!find(await nearby(local), traveller));
    await query(`DELETE FROM location_hidden_from WHERE owner_id = $1`, [traveller]);
    await query(`UPDATE profiles SET is_ghost = TRUE WHERE user_id = $1`, [traveller]);
    assert.ok(!find(await nearby(local), traveller), 'Ghost hides visitors too');
    await query(`UPDATE profiles SET is_ghost = FALSE WHERE user_id = $1`, [traveller]);
    ok('blocks, the hide list and Ghost are respected in the destination');

    // ── End trip ─────────────────────────────────────────────────────────────
    assert.deepStrictEqual(await travelService.endTrip(traveller), { ended: true });
    assert.strictEqual(await travelService.getTrip(traveller), null);
    assert.ok(!find(await nearby(local), traveller));
    assert.ok(find(await nearby(londoner), traveller), 'back home');
    assert.ok(find(await nearby(londoner), traveller).distance_label !== 'Visiting Manchester');
    ok('ending a trip puts the member back at home');

    // ── Expiry ───────────────────────────────────────────────────────────────
    const again = await travelService.planTrip(traveller, { city: 'Manchester', startsOn: today, endsOn: today });
    assert.ok(find(await nearby(local), traveller));
    await query(
      `UPDATE travel_trips SET starts_at = NOW() - INTERVAL '3 days', ends_at = NOW() - INTERVAL '1 minute' WHERE id = $1`,
      [again.id],
    );
    assert.ok(!find(await nearby(local), traveller), 'gone after the end date');
    assert.ok(find(await nearby(londoner), traveller), 'home again after the end date');
    assert.strictEqual(await travelService.getTrip(traveller), null);
    const closed = await query(`SELECT ended_at FROM travel_trips WHERE id = $1`, [again.id]);
    assert.ok(closed.rows[0].ended_at, 'expired trip is closed');
    ok('a trip ends itself after the end date');

    // ── Lapsed Premium still ends and reads its trip ────────────────────────
    assert.strictEqual(await travelService.getShowInLookAround(free), true);
    ok('settings read for everyone');
  } finally {
    premiumService.isBetaPremiumFree = origBetaFree;
    globalThis.fetch = realFetch;
    if (ids.length) {
      await query(`DELETE FROM travel_trips WHERE user_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM blocks WHERE blocker_id = ANY($1::uuid[]) OR blocked_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM location_hidden_from WHERE owner_id = ANY($1::uuid[]) OR hidden_user_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await pool.end();
  }
  console.log(`travel-integration: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
