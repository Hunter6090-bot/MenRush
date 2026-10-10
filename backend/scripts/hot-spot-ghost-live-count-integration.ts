/**
 * Integration (real Postgres + PostGIS): Ghost and hidden check-ins do not add
 * to any spot's or event's live count, for Free or Premium viewers.
 * - A Ghost (or hidden) member can still check in for themselves (is_checked_in),
 *   but the count, Premium exact or Free rounded, is unchanged, and the spot's
 *   last_activity_at is not freshened.
 * - A normal check-in adds 1. Free still shows 0 to 4 exact, then '5+', and the
 *   Free live sort uses the counted number.
 * - The rule is read at query time: leaving Ghost while still checked in counts
 *   them again; going back into Ghost drops them out again.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npm run test:hot-spot-ghost-live-count
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('hot-spot-ghost-live-count-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

// Isolated spot so other local rows cannot interfere.
const LAT = 59.3601;
const LNG = -2.4312;
const KM_LAT = 1 / 111.2;
const SPOT = {
  near: '00000000-0000-4000-8000-0000000b0001', // 4 normal check-ins, nearer
  busy: '00000000-0000-4000-8000-0000000b0002', // 5 normal check-ins, further
};
const ACTIVITY = '2026-10-08T21:52:37.123Z';

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { premiumService } = await import('../src/services/premium.service');
  const { hotSpotsService } = await import('../src/services/hot-spots.service');

  const premiumIds = new Set<string>();
  // Force the viewer tier: the free-Premium env flag (default on) would make everyone Premium.
  (premiumService as unknown as { isPremium: unknown }).isPremium = async (uid: string) => premiumIds.has(uid);

  const userIds: string[] = [];
  const spotIds: string[] = Object.values(SPOT);
  async function makeUser(name: string, profile?: { ghost?: boolean; visible?: boolean }) {
    const id = randomUUID();
    userIds.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [id, `hsgl-${id.slice(0, 8)}@test.menrush.local`, name],
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
  const setGhost = (uid: string, ghost: boolean) =>
    query(`UPDATE profiles SET is_ghost = $2 WHERE user_id = $1`, [uid, ghost]);

  try {
    await query(`DELETE FROM hot_spots WHERE id = ANY($1::uuid[])`, [spotIds]);
    const cat = await query(
      `SELECT id FROM hot_spot_categories WHERE is_commercial = TRUE ORDER BY (slug = 'saunas') DESC, id LIMIT 1`,
    );
    const categoryId = cat.rows[0]?.id;
    assert.ok(categoryId, 'a commercial hot-spot category exists');
    for (const [id, km] of [[SPOT.near, 0.5], [SPOT.busy, 2]] as const) {
      await query(
        `INSERT INTO hot_spots (id, category_id, name, city, latitude, longitude, is_user_generated, is_active, last_activity_at)
         VALUES ($1, $2, $3, 'Test', $4, $5, FALSE, TRUE, $6)`,
        [id, categoryId, `HSGL ${id.slice(-4)}`, LAT + km * KM_LAT, LNG, ACTIVITY],
      );
    }
    // Baseline: near has 4 normal check-ins (one with no profile row, which still counts), busy has 5.
    for (const [spot, n] of [[SPOT.near, 4], [SPOT.busy, 5]] as const) {
      for (let i = 0; i < n; i += 1) {
        const uid = await makeUser(`HSGL Normal ${spot.slice(-1)}${i}`, i === 0 ? undefined : {});
        await query(`INSERT INTO hot_spot_checkins (spot_id, user_id, is_anonymous) VALUES ($1, $2, TRUE)`, [spot, uid]);
      }
    }

    const free = await makeUser('HSGL Free viewer', {});
    const premium = await makeUser('HSGL Premium viewer', {});
    premiumIds.add(premium);
    const ghost = await makeUser('HSGL Ghost', { ghost: true });
    const hidden = await makeUser('HSGL Hidden', { visible: false });
    const premiumGhost = await makeUser('HSGL Premium Ghost', { ghost: true });
    premiumIds.add(premiumGhost);
    const newcomer = await makeUser('HSGL Newcomer', {});

    const counts = async (spot: string) => {
      const f = await hotSpotsService.getSpot(free, spot);
      const p = await hotSpotsService.getSpot(premium, spot);
      return { free: f?.live_count, premium: p?.live_count_exact, active: p?.has_active_checkins };
    };
    const activity = async (spot: string) =>
      (await query(`SELECT last_activity_at FROM hot_spots WHERE id = $1`, [spot])).rows[0].last_activity_at.toISOString();

    assert.deepStrictEqual(await counts(SPOT.near), { free: 4, premium: 4, active: true }, 'baseline 4');

    // ── Ghost and hidden check-ins: count unchanged for Free and Premium.
    const ghostView = await hotSpotsService.checkIn(ghost, SPOT.near, false);
    assert.strictEqual(ghostView?.is_checked_in, true, 'Ghost can still check in for themselves');
    assert.strictEqual(ghostView?.live_count, 4, 'Ghost is not counted, not even in their own view');
    await hotSpotsService.checkIn(hidden, SPOT.near, false);
    const pgView = await hotSpotsService.checkIn(premiumGhost, SPOT.near, true);
    assert.strictEqual(pgView?.live_count_exact, 4, 'Premium Ghost not counted either');
    assert.deepStrictEqual(await counts(SPOT.near), { free: 4, premium: 4, active: true }, 'Ghost and hidden check-ins leave the count at 4');
    assert.strictEqual(await activity(SPOT.near), ACTIVITY, 'Ghost / hidden check-in does not freshen last_activity_at');
    assert.deepStrictEqual(
      (await hotSpotsService.getMyCheckIn(ghost))?.spot_id,
      SPOT.near,
      'Ghost still sees their own check-in',
    );

    // Free '5+' rule and Free live sort use the counted number: near stays 4, busy (5) leads.
    const freeList = (await hotSpotsService.listNearby({ userId: free, lat: LAT, lng: LNG, radiusKm: 10, sortBy: 'live' }))
      .filter((r) => spotIds.includes(r.id));
    assert.deepStrictEqual(freeList.map((r) => [r.id, r.live_count]), [[SPOT.busy, '5+'], [SPOT.near, 4]], 'Free sort: counted 5+ first, then 4');
    const premiumList = (await hotSpotsService.listNearby({ userId: premium, lat: LAT, lng: LNG, radiusKm: 10, sortBy: 'live' }))
      .filter((r) => spotIds.includes(r.id));
    assert.deepStrictEqual(premiumList.map((r) => r.live_count_exact), [5, 4], 'Premium list exact counts skip Ghost');

    // ── A normal check-in adds 1 (and Free flips to '5+').
    await hotSpotsService.checkIn(newcomer, SPOT.near, true);
    assert.deepStrictEqual(await counts(SPOT.near), { free: '5+', premium: 5, active: true }, 'normal check-in adds 1');
    assert.notStrictEqual(await activity(SPOT.near), ACTIVITY, 'normal check-in freshens last_activity_at');

    // ── Leaving Ghost while still checked in counts them again; back into Ghost drops them.
    await setGhost(ghost, false);
    assert.deepStrictEqual(await counts(SPOT.near), { free: '5+', premium: 6, active: true }, 'left Ghost: counted again');
    await setGhost(ghost, true);
    assert.strictEqual((await counts(SPOT.near)).premium, 5, 'back in Ghost: not counted');
    await query(`UPDATE profiles SET is_visible = TRUE WHERE user_id = $1`, [hidden]);
    assert.strictEqual((await counts(SPOT.near)).premium, 6, 'no longer hidden: counted');

    // ── Events share the spot count: a Ghost event check-in shows 0, a normal one 1.
    const event = { id: randomUUID(), name: 'HSGL Night', venue_name: 'HSGL Event Venue', lat: LAT + 5 * KM_LAT, lng: LNG };
    const evGhost = await hotSpotsService.checkInAtEvent(premiumGhost, event, false);
    assert.ok(evGhost?.id, 'event spot created');
    spotIds.push(evGhost!.id);
    assert.strictEqual(evGhost?.is_checked_in, true);
    assert.strictEqual((await counts(evGhost!.id)).premium, 0, 'Ghost event check-in: 0 for Premium');
    assert.strictEqual((await counts(evGhost!.id)).free, 0, 'Ghost event check-in: 0 for Free');
    assert.strictEqual((await counts(evGhost!.id)).active, false, 'no visible activity at the event');
    await hotSpotsService.checkInAtEvent(newcomer, event, true);
    assert.deepStrictEqual(await counts(evGhost!.id), { free: 1, premium: 1, active: true }, 'normal event check-in adds 1');

    console.log('hot-spot-ghost-live-count-integration: ok');
  } finally {
    await query(`DELETE FROM hot_spot_checkins WHERE spot_id = ANY($1::uuid[])`, [spotIds]).catch(() => undefined);
    await query(`DELETE FROM hot_spots WHERE id = ANY($1::uuid[])`, [spotIds]).catch(() => undefined);
    await query(`DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [userIds]).catch(() => undefined);
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('hot-spot-ghost-live-count-integration: FAILED', err);
  process.exit(1);
});
