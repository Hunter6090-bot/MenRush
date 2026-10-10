/**
 * Regression: radius filters measure to the public (Discretion-fuzzed) pin,
 * never raw GPS. Based on QC's qcscratch/radius-oracle.ts.
 *
 * The attack: walk your own origin (or shrink the radius) in 10 m steps and
 * note where a member drops out. On raw GPS that gives his real distance to
 * about 10 m whatever his Discretion. Here we prove every answer from Nearby,
 * the live map feed and Community is a function of the pin alone, so the walk
 * learns the pin (already public on the map) and nothing closer than the fuzz.
 *
 * Also: SQL pin == JS pin (privateMapPointAround), map feed min radius 0.8 km,
 * map feed ignores client lat/lng, and implausible location jumps are ignored.
 *
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Unit parts always run.
 *   DATABASE_URL=postgresql://menrush:menrush123@localhost:5432/menrush \
 *   npx ts-node scripts/radius-oracle-checks.ts
 */
import assert from 'assert';
import { createHash, randomUUID } from 'crypto';
import { privateMapPointAround, fuzzRangeMeters } from '../src/lib/mapPinFuzz';
import { clampRadiusKm } from '../src/lib/mapPinSql';
import {
  acceptLocationFix,
  distanceMeters,
  isPlausibleMove,
  JUMP_GRACE_M,
  MAX_PLAUSIBLE_SPEED_MPS,
  resetLocationJumpGate,
} from '../src/lib/locationJumpGate';

const M_PER_DEG_LAT = 111195;

/**
 * Deterministic UUID from a fixed seed. The map pin is a pure function of
 * `map:${id}` (privateMapPointAround), so a seeded id gives a seeded pin with
 * no change to production randomness.
 */
function seededUuid(seed: string): ReturnType<typeof randomUUID> {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Seeded PRNG (mulberry32) for test inputs only. Production fuzz is untouched. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Where the Nearby walk (origin moved north from the real point in 10 m steps,
 * radius R) would drop a member whose pin is `pin`, decided by the pin alone.
 * Same grid as the DB walk below.
 */
function predictedDropOutM(
  realLat: number,
  realLng: number,
  pin: { lat: number; lng: number },
  R: number,
): number {
  let lastIn = -1;
  for (let d = 0; d <= 1800; d += 10) {
    if (distanceMeters(realLat + d / M_PER_DEG_LAT, realLng, pin.lat, pin.lng) <= R) lastIn = d;
  }
  return lastIn + 10;
}

function unitChecks() {
  // Radius clamp matches Nearby / Community.
  assert.strictEqual(clampRadiusKm(0.01, 5), 0.8);
  assert.strictEqual(clampRadiusKm(undefined, 5), 5);
  assert.strictEqual(clampRadiusKm(NaN, 5), 5);
  assert.strictEqual(clampRadiusKm(9999, 5), 161);

  // Jump gate.
  const t0 = 1_000_000;
  const prev = { lat: 51.5, lng: -0.12, atMs: t0 };
  assert.ok(isPlausibleMove(prev, 51.5 + 10 / M_PER_DEG_LAT, -0.12, t0), '10 m step: ok');
  assert.ok(!isPlausibleMove(prev, 51.5 + 5000 / M_PER_DEG_LAT, -0.12, t0 + 1000), '5 km in 1 s: jump');
  assert.ok(isPlausibleMove(prev, 51.5 + 5000 / M_PER_DEG_LAT, -0.12, t0 + 60_000), '5 km in 60 s: ok');
  assert.ok(isPlausibleMove(prev, 55.95, -3.19, t0 + 2 * 3600_000), 'London to Edinburgh in 2 h: ok');
  resetLocationJumpGate();
  assert.ok(acceptLocationFix('u1', 51.5, -0.12, t0), 'first fix accepted');
  assert.ok(!acceptLocationFix('u1', 51.6, -0.12, t0 + 2000), '11 km in 2 s ignored');
  assert.ok(acceptLocationFix('u1', 51.5 + 100 / M_PER_DEG_LAT, -0.12, t0 + 3000), 'small move accepted');
  const far = 51.5 + 11_000 / M_PER_DEG_LAT;
  const waitMs = ((11_000 - JUMP_GRACE_M) / MAX_PLAUSIBLE_SPEED_MPS) * 1000 + 1000;
  assert.ok(acceptLocationFix('u1', far, -0.12, t0 + 3000 + waitMs), 'same move later accepted');
  resetLocationJumpGate();
  console.log('radius-oracle unit: OK');
}

unitChecks();

if (!process.env.DATABASE_URL) {
  console.log('radius-oracle-checks: SKIPPED integration (no DATABASE_URL)');
  process.exit(0);
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { userService } = await import('../src/services/user.service');
  const { mapFeedService } = await import('../src/services/map-feed.service');
  const { communityService } = await import('../src/services/community.service');
  const { publicPinSql } = await import('../src/lib/mapPinSql');

  const ids: string[] = [];
  async function mk(name: string, lat: number, lng: number, fuzz: number, id: string) {
    ids.push(id);
    // Seeded ids repeat across runs: clear rows left by an earlier run that
    // crashed before cleanup.
    await query(`DELETE FROM map_feed_messages WHERE sender_id = $1`, [id]);
    await query(`DELETE FROM community_posts WHERE user_id = $1`, [id]).catch(() => undefined);
    await query(`DELETE FROM profiles WHERE user_id = $1`, [id]);
    await query(`DELETE FROM users WHERE id = $1`, [id]);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status,
                          verification_provider, photo_url)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', 'veriff', '/uploads/t.jpg')`,
      [id, `ro-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost, map_pin_fuzz_m)
       VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), TRUE, FALSE, $4)`,
      [id, lat, lng, fuzz],
    );
    return id;
  }
  /** Stored location set directly (not through the gate) for test setup. */
  async function place(id: string, lat: number, lng: number) {
    await query(
      `UPDATE profiles SET location = ST_MakePoint($3, $2)::geography, lat = $2, lng = $3 WHERE user_id = $1`,
      [id, lat, lng],
    );
  }

  try {
    // ── 1. SQL pin matches the JS pin the map shows ─────────────────────────
    const pinSql = publicPinSql('$1::float8', '$2::float8', '$3::uuid', '$4::int');
    // Seeded inputs: the same 300 points and ids on every run.
    const rand = seededRandom(0x5eed);
    for (let i = 0; i < 300; i++) {
      const id = seededUuid(`radius-oracle:sql-pin:${i}`);
      const lat = 49.9 + rand() * 11;
      const lng = -8 + rand() * 9;
      const fuzz = [80, 120, 320, 333, 500, 799, 800][i % 7];
      const r = await query(`SELECT ${pinSql.lat} AS lat, ${pinSql.lng} AS lng`, [lat, lng, id, fuzz]);
      const js = privateMapPointAround(lat, lng, `map:${id}`, fuzz);
      const gap = distanceMeters(js.lat, js.lng, Number(r.rows[0].lat), Number(r.rows[0].lng));
      assert.ok(gap < 0.5, `SQL pin within 0.5 m of JS pin (gap ${gap.toFixed(3)} m)`);
    }
    const defaultRow = await query(`SELECT ${pinSql.lat} AS lat, ${pinSql.lng} AS lng`, [51.5, -0.12, seededUuid('radius-oracle:null-fuzz'), null]);
    assert.ok(Number.isFinite(Number(defaultRow.rows[0].lat)), 'NULL fuzz falls back to default');

    // Isolated area so other local rows cannot interfere.
    const realLat = 57.8;
    const realLng = -5.6;
    const R = 800; // the smallest radius anyone can ask for (0.8 km)

    // Pick the member deterministically: walk a fixed seed sequence and take the
    // first id whose pin, by geometry alone, drops out of the walk at least
    // 150 m away from R. A random id sometimes gave a pin whose drop-out landed
    // within 100 m of R by chance (pin well off to the east or west), which made
    // the 'does not reveal' check flaky. With a seeded id the pin, the predicted
    // drop-out and the assertion are the same on every run. A raw-GPS filter
    // would still drop out at about R and fail the check.
    let seedIndex = 0;
    let memberId = seededUuid(`radius-oracle:dropout:${seedIndex}`);
    let pin = privateMapPointAround(realLat, realLng, `map:${memberId}`, 800);
    while (
      Math.abs(pin.lat - realLat) * M_PER_DEG_LAT < 300 ||
      Math.abs(predictedDropOutM(realLat, realLng, pin, R) - R) < 150
    ) {
      seedIndex += 1;
      assert.ok(seedIndex < 1000, 'a seeded member with a clear drop-out exists');
      memberId = seededUuid(`radius-oracle:dropout:${seedIndex}`);
      pin = privateMapPointAround(realLat, realLng, `map:${memberId}`, 800);
    }
    const predictedDropM = predictedDropOutM(realLat, realLng, pin, R);
    const member = await mk('RO Target', realLat, realLng, 800, memberId);
    const offsetM = distanceMeters(realLat, realLng, pin.lat, pin.lng);
    const { min: fmin, max: fmax } = fuzzRangeMeters(800);
    assert.ok(offsetM >= fmin - 2 && offsetM <= fmax + 2, 'pin offset inside the Discretion band');

    const viewer = await mk('RO Viewer', realLat + 0.1, realLng, 320, seededUuid('radius-oracle:viewer'));

    // ── 2. Nearby: QC's walk, origin moved 10 m at a time through the API ───
    resetLocationJumpGate();
    await place(viewer, realLat, realLng);
    let lastInReal = -1;
    const probes: Array<{ d: number; seen: boolean; toPin: number }> = [];
    for (let d = 0; d <= 1800; d += 10) {
      const lat = realLat + d / M_PER_DEG_LAT;
      const res = await userService.getNearbyUsers(
        viewer, R / 1000, { discoveryScope: 'radius' }, { lat, lng: realLng }, { limit: 200 },
      );
      const seen = res.users.some((u: any) => u.id === member);
      const toPin = distanceMeters(lat, realLng, pin.lat, pin.lng);
      probes.push({ d, seen, toPin });
      if (seen) lastInReal = d;
      // Every answer is decided by the pin (skip a 5 m band for sphere vs spheroid).
      if (Math.abs(toPin - R) > 5) {
        assert.strictEqual(seen, toPin <= R, `Nearby at ${d} m: decided by pin (toPin ${toPin.toFixed(0)} m)`);
      }
    }
    // The walk's drop-out point says nothing closer than the fuzz about the real point.
    const dropRealM = lastInReal + 10;
    console.log(
      `Nearby: drops out with origin ${dropRealM} m from REAL point; pin is ${offsetM.toFixed(0)} m from real; ` +
        `a raw-GPS filter would drop out at ${R} m.`,
    );
    // Seeded pin: the DB walk can only differ from the pin-only prediction inside
    // the 5 m sphere/spheroid band, so by at most one 10 m step.
    assert.ok(
      Math.abs(dropRealM - predictedDropM) <= 10,
      `drop-out matches the pin-only prediction (db ${dropRealM} m, predicted ${predictedDropM} m, seed ${seedIndex})`,
    );
    assert.ok(Math.abs(dropRealM - R) > 100, 'drop-out does not reveal the real distance');
    assert.ok(Math.abs(dropRealM - R) <= fmax + 20, 'drop-out error is bounded by the fuzz (pin, not noise)');

    // Shrinking the radius at a fixed origin: same story. Put the origin 1200 m
    // from the real point on the side away from the pin, so both distances are
    // above the 0.8 km minimum and far apart: a raw-GPS filter would show him at
    // about 1200 m, the pin filter only much later.
    const shrinkLat = realLat + ((pin.lat > realLat ? -1 : 1) * 1200) / M_PER_DEG_LAT;
    await place(viewer, shrinkLat, realLng);
    resetLocationJumpGate();
    const toPinFixed = distanceMeters(shrinkLat, realLng, pin.lat, pin.lng);
    const toRealFixed = distanceMeters(shrinkLat, realLng, realLat, realLng);
    assert.ok(toRealFixed > 800 + 20 && toPinFixed > 800 + 20, 'shrink origin: both distances above the minimum radius');
    assert.ok(toPinFixed <= 2400 - 20, 'shrink origin: the pin is reached inside the walk');
    assert.ok(Math.abs(toPinFixed - toRealFixed) > 150, 'shrink origin: pin and real distances clearly apart');
    // Pin-only prediction: the first radius on the 10 m grid that reaches the pin.
    const predictedAppearM = Math.max(800, Math.ceil(toPinFixed / 10) * 10);
    let firstSeenM = -1;
    for (let rM = 800; rM <= 2400; rM += 10) {
      const res = await userService.getNearbyUsers(viewer, rM / 1000, { discoveryScope: 'radius' }, undefined, { limit: 200 });
      const seen = res.users.some((u: any) => u.id === member);
      if (seen && firstSeenM < 0) firstSeenM = rM;
      if (Math.abs(toPinFixed - rM) > 5) assert.strictEqual(seen, toPinFixed <= rM, `radius ${rM} m decided by pin`);
    }
    assert.ok(
      Math.abs(firstSeenM - predictedAppearM) <= 10,
      `shrinking radius: member appears at the pin-predicted radius (db ${firstSeenM} m, predicted ${predictedAppearM} m)`,
    );
    console.log(
      `Shrinking radius: member appears at ${firstSeenM} m (pin-predicted ${predictedAppearM} m); ` +
        `real distance ${toRealFixed.toFixed(0)} m.`,
    );
    // Seeded pin: the appear radius is far from his real distance, so the walk
    // learns the pin, not the real point.
    assert.ok(
      Math.abs(firstSeenM - toRealFixed) > 100,
      `shrinking radius does not reveal the real distance (appears ${firstSeenM} m, real ${toRealFixed.toFixed(0)} m)`,
    );

    // Each member's own Discretion sets the bound (80 m member: tight but still the pin).
    const lowId = seededUuid('radius-oracle:low-discretion');
    let lowPin = privateMapPointAround(realLat, realLng + 0.05, `map:${lowId}`, 80);
    const low = await mk('RO Low Discretion', realLat, realLng + 0.05, 80, lowId);
    await place(viewer, realLat + 700 / M_PER_DEG_LAT, realLng + 0.05);
    const lowRes = await userService.getNearbyUsers(viewer, 0.8, { discoveryScope: 'radius' }, undefined, { limit: 200 });
    const lowToPin = distanceMeters(realLat + 700 / M_PER_DEG_LAT, realLng + 0.05, lowPin.lat, lowPin.lng);
    if (Math.abs(lowToPin - 800) > 5) {
      assert.strictEqual(lowRes.users.some((u: any) => u.id === low), lowToPin <= 800, 'low-Discretion member decided by his pin');
    }
    const lowRow = lowRes.users.find((u: any) => u.id === low);
    if (lowRow) {
      assert.ok(Math.abs(lowRow.lat - lowPin.lat) < 1e-6 && Math.abs(lowRow.lng - lowPin.lng) < 1e-6, 'filtered pin == shown pin');
    }

    // ── 3. Implausible jump through the API is ignored ──────────────────────
    resetLocationJumpGate();
    await place(viewer, realLat, realLng);
    await userService.updateLocation(viewer, realLat, realLng);
    await userService.updateLocation(viewer, realLat + 0.2, realLng); // ~22 km instantly
    let stored = (await query(`SELECT lat FROM profiles WHERE user_id = $1`, [viewer])).rows[0];
    assert.ok(Math.abs(Number(stored.lat) - realLat) < 1e-7, 'teleport ignored: stored location kept');
    await userService.updateLocation(viewer, realLat + 20 / M_PER_DEG_LAT, realLng);
    stored = (await query(`SELECT lat FROM profiles WHERE user_id = $1`, [viewer])).rows[0];
    assert.ok(Math.abs(Number(stored.lat) - (realLat + 20 / M_PER_DEG_LAT)) < 1e-7, 'small move stored');

    // ── 4. Live map feed: pin filter, pin coords, min radius, client coords ignored ─
    const post = await mapFeedService.post(member, 'ro feed post');
    assert.ok(
      Math.abs(Number(post.lat) - pin.lat) < 1e-6 && Math.abs(Number(post.lng) - pin.lng) < 1e-6,
      'POST reply / socket payload carries the pin, not raw GPS',
    );
    for (let d = 0; d <= 1800; d += 20) {
      const lat = realLat + d / M_PER_DEG_LAT;
      await place(viewer, lat, realLng);
      // Client coords far away and a tiny radius: both must be ignored / clamped.
      const msgs = await mapFeedService.listNearby(viewer, { lat: realLat, lng: realLng, radiusKm: 0.01 });
      const m = msgs.find((x) => x.sender_id === member);
      const toPin = distanceMeters(lat, realLng, pin.lat, pin.lng);
      if (Math.abs(toPin - R) > 5) {
        assert.strictEqual(!!m, toPin <= R, `map feed at ${d} m: decided by pin, radius clamped to 0.8 km`);
      }
      if (m) {
        assert.ok(Math.abs(Number(m.lat) - pin.lat) < 1e-6 && Math.abs(Number(m.lng) - pin.lng) < 1e-6, 'feed shows the pin');
        assert.ok(distanceMeters(Number(m.lat), Number(m.lng), realLat, realLng) >= fmin - 2, 'feed never shows raw GPS');
      }
    }

    // ── 5. Community: radius measured to the author pin ─────────────────────
    await communityService.create(member, 'ro community post');
    for (let d = 0; d <= 1800; d += 20) {
      const lat = realLat + d / M_PER_DEG_LAT;
      const posts = await communityService.listNearby({ viewerId: viewer, lat, lng: realLng, radiusKm: 0.8 });
      const seen = posts.some((p) => p.user_id === member);
      const toPin = distanceMeters(lat, realLng, pin.lat, pin.lng);
      if (Math.abs(toPin - R) > 5) assert.strictEqual(seen, toPin <= R, `community at ${d} m: decided by pin`);
    }

    console.log('radius-oracle-checks: OK');
  } finally {
    resetLocationJumpGate();
    if (ids.length) {
      await query(`DELETE FROM map_feed_messages WHERE sender_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM community_posts WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
      await query(`DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error('radius-oracle-checks: FAILED', err);
  process.exit(1);
});
