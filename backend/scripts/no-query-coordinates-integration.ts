/**
 * Integration (real PG): the reads work with no coordinates in the URL.
 * The app sends its fix in the body of POST /api/users/location (jump gate
 * applies), then nearby, profile/:id, hot-spots, events/nearby, rooms, map feed
 * and community all read around the STORED location. Any lat/lng in a query
 * string is rejected with 400 coordinates_in_url.
 * Distances still go to the member's fuzzed pin (coarse miles).
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npx ts-node scripts/no-query-coordinates-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';
import express from 'express';
import { AddressInfo } from 'net';

if (!process.env.DATABASE_URL) {
  console.log('no-query-coordinates-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

async function main() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'no-query-coordinates-integration';
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { accessControl } = await import('../src/security/access');
  const { noQueryCoordinates } = await import('../src/middleware/noQueryCoordinates');
  const { resetLocationJumpGate } = await import('../src/lib/locationJumpGate');

  // Token = the user id (auth is not under test here).
  (authService as unknown as { verifyToken: unknown }).verifyToken = (t: string) => ({ userId: t });
  (accessControl as unknown as { requireVerified: unknown }).requireVerified = async () => undefined;
  resetLocationJumpGate();

  const ids: string[] = [];
  async function makeUser(name: string, loc: { lat: number; lng: number } | null) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [id, `nqc-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    if (loc) {
      await query(
        `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
         VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), TRUE, FALSE)`,
        [id, loc.lat, loc.lng],
      );
    } else {
      await query(`INSERT INTO profiles (user_id, online, last_seen) VALUES ($1, TRUE, NOW())`, [id]);
    }
    return id;
  }

  // Isolated spot (Shetland) so other local rows cannot interfere.
  const LAT = 60.1529;
  const LNG = -1.1493;

  const app = express();
  app.use(express.json());
  app.use('/api', noQueryCoordinates);
  app.use('/api/users', (await import('../src/routes/users')).default);
  app.use('/api/hot-spots', (await import('../src/routes/hot-spots')).default);
  app.use('/api/events', (await import('../src/routes/events')).default);
  app.use('/api/rooms', (await import('../src/routes/rooms')).default);
  app.use('/api/map-feed', (await import('../src/routes/map-feed')).default);
  app.use('/api/community', (await import('../src/routes/community')).default);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (uid: string, method: string, p: string, body?: unknown) => {
    const res = await fetch(base + p, {
      method,
      headers: { Authorization: `Bearer ${uid}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
    return { status: res.status, json, text };
  };

  try {
    const viewer = await makeUser('NQC Viewer', null);
    const member = await makeUser('NQC Member', { lat: LAT + 0.03, lng: LNG }); // ~3.3 km north
    const noLoc = await makeUser('NQC No Location', null);

    // 1. Fix goes in the POST body; stored as the viewer's location.
    const post = await call(viewer, 'POST', '/api/users/location', { lat: LAT, lng: LNG });
    assert.strictEqual(post.status, 200, `POST /users/location: ${post.text}`);
    const stored = await query(`SELECT lat, lng FROM profiles WHERE user_id = $1`, [viewer]);
    assert.deepStrictEqual([Number(stored.rows[0].lat), Number(stored.rows[0].lng)], [LAT, LNG]);
    console.log('✓ POST /api/users/location stores the fix from the body');

    // 2. Jump gate still applies: a teleport right after is ignored.
    const jump = await call(viewer, 'POST', '/api/users/location', { lat: 51.5, lng: -0.12 });
    assert.strictEqual(jump.status, 200);
    const afterJump = await query(`SELECT lat FROM profiles WHERE user_id = $1`, [viewer]);
    assert.strictEqual(Number(afterJump.rows[0].lat), LAT, 'jump gate keeps the stored location');
    console.log('✓ jump gate still ignores an implausible jump');

    // 3. Nearby with no query coordinates: member found, coarse miles to the fuzzed pin.
    const nearby = await call(viewer, 'GET', '/api/users/nearby?radius=10&limit=200');
    assert.strictEqual(nearby.status, 200, `nearby: ${nearby.text}`);
    const row = nearby.json.users.find((x: any) => x.id === member);
    assert.ok(row, 'nearby: member around the stored location is listed');
    assert.match(String(row.distance_label), /^(<1 mi|\d+ mi)$/, 'nearby: coarse miles only');
    assert.notStrictEqual(Number(row.lat), LAT + 0.03, 'nearby: pin is fuzzed, not raw');
    assert.ok(!('real_lat' in row), 'nearby: no raw coordinates');
    console.log(`✓ nearby works with no query coordinates (${row.distance_label})`);

    // 4. Profile with no query coordinates: same coarse distance.
    const profile = await call(viewer, 'GET', `/api/users/profile/${member}`);
    assert.strictEqual(profile.status, 200, `profile: ${profile.text}`);
    assert.strictEqual(profile.json.distance_label, row.distance_label, 'profile: same coarse distance as nearby');
    assert.ok(!('member_lat' in profile.json) && !('lat' in profile.json), 'profile: no coordinates');
    console.log('✓ profile/:id works with no query coordinates');

    // 5. Other reads: 200 around the stored location.
    for (const p of [
      '/api/hot-spots?radiusKm=80',
      '/api/events/nearby?radius=50',
      '/api/rooms?nearby=1&radius=10',
      '/api/map-feed?limit=50',
      '/api/community/posts?radiusKm=10',
    ]) {
      const r = await call(viewer, 'GET', p);
      assert.strictEqual(r.status, 200, `${p}: ${r.text}`);
      if (p.startsWith('/api/hot-spots')) {
        assert.ok(Array.isArray(r.json.spots), 'hot-spots: spots array');
        assert.notStrictEqual(r.json.location_required, true, 'hot-spots: stored location used');
      }
    }
    console.log('✓ hot-spots, events, rooms, map feed and community work with no query coordinates');

    // 6. No stored location: empty results, not errors.
    const hs = await call(noLoc, 'GET', '/api/hot-spots');
    assert.strictEqual(hs.status, 200);
    assert.deepStrictEqual(hs.json.spots, []);
    assert.strictEqual(hs.json.location_required, true);
    const ev = await call(noLoc, 'GET', '/api/events/nearby');
    assert.deepStrictEqual(ev.json, []);
    const nb = await call(noLoc, 'GET', '/api/users/nearby');
    assert.strictEqual(nb.status, 200);
    assert.deepStrictEqual(nb.json.users, []);
    console.log('✓ no stored location: empty results, no error');

    // 7. Coordinates in the URL (old cached tab): ignored. 200, the stored
    //    location is used for results and distance, and it never moves.
    delete process.env.STRICT_NO_URL_COORDINATES;
    const URL_PT = 'lat=51.5&lng=-0.12'; // London, ~1000 km from the stored point
    for (const p of [
      `/api/users/nearby?radius=10&limit=200&${URL_PT}`,
      `/api/users/profile/${member}?${URL_PT}`,
      `/api/hot-spots?radiusKm=80&${URL_PT}`,
      `/api/events/nearby?radius=50&${URL_PT}`,
      `/api/rooms?nearby=1&radius=10&${URL_PT}`,
      `/api/map-feed?limit=50&${URL_PT}`,
      `/api/community/posts?radiusKm=10&${URL_PT}`,
    ]) {
      const r = await call(viewer, 'GET', p);
      assert.strictEqual(r.status, 200, `${p}: ${r.text}`);
    }
    const nearbyUrl = await call(viewer, 'GET', `/api/users/nearby?radius=10&limit=200&${URL_PT}`);
    const rowUrl = nearbyUrl.json.users.find((x: any) => x.id === member);
    assert.ok(rowUrl, 'nearby with URL coordinates: still the members around the STORED location');
    assert.strictEqual(rowUrl.distance_label, row.distance_label, 'nearby: distance from the stored location, not the URL');
    const profileUrl = await call(viewer, 'GET', `/api/users/profile/${member}?${URL_PT}`);
    assert.strictEqual(profileUrl.json.distance_label, row.distance_label, 'profile: distance from the stored location, not the URL');
    const hsUrl = await call(noLoc, 'GET', `/api/hot-spots?${URL_PT}`);
    assert.strictEqual(hsUrl.status, 200);
    assert.strictEqual(hsUrl.json.location_required, true, 'hot-spots: a URL point never stands in for a stored one');
    const nbUrl = await call(noLoc, 'GET', `/api/users/nearby?${URL_PT}`);
    assert.deepStrictEqual(nbUrl.json.users, [], 'nearby: a URL point never stands in for a stored one');
    const evUrl = await call(noLoc, 'GET', `/api/events/nearby?${URL_PT}`);
    assert.deepStrictEqual(evUrl.json, [], 'events: a URL point never stands in for a stored one');
    const unmoved = await query(`SELECT lat, lng FROM profiles WHERE user_id = $1`, [viewer]);
    assert.deepStrictEqual([Number(unmoved.rows[0].lat), Number(unmoved.rows[0].lng)], [LAT, LNG], 'viewer: URL coordinates never move the stored location');
    const noLocRow = await query(`SELECT lat, lng, location FROM profiles WHERE user_id = $1`, [noLoc]);
    assert.ok(noLocRow.rows[0].lat == null && noLocRow.rows[0].location == null, 'no-location member: URL coordinates are never stored');
    console.log('✓ URL coordinates are ignored: 200, stored location used for distance, never stored');

    // 8. Strict flag (for the later PR): 400 coordinates_in_url.
    process.env.STRICT_NO_URL_COORDINATES = 'true';
    try {
      const r = await call(viewer, 'GET', `/api/users/nearby?${URL_PT}`);
      assert.strictEqual(r.status, 400);
      assert.strictEqual(r.json.code, 'coordinates_in_url');
    } finally {
      delete process.env.STRICT_NO_URL_COORDINATES;
    }
    console.log('✓ STRICT_NO_URL_COORDINATES=true rejects with 400 coordinates_in_url');
  } finally {
    server.close();
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    await pool.end();
  }
  console.log('no-query-coordinates-integration: ok');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
