/**
 * Location retention purge on real Postgres/PostGIS, with a fake clock.
 * Covers: nothing changes while every flag is off (migration 076 is schema
 * only, write-time rounding off, worker off); with LOCATION_PURGE_ENABLED the
 * home and visit anchor are rounded to about 1 km on write and by the gated
 * backfill, which also fills location_updated_at; 30-day stale live clear; map feed and Community post coordinates
 * removed after expiry plus grace, held while a report is open; readers handle
 * a cleared location; account deletion removes map feed, Community, chat
 * location shares and room points, and works for a room creator. Optional
 * rules, each behind its own flag: chat location share coordinates cleared
 * after 7 days, Hot Spot check-ins deleted 24 h after they end.
 * Never run against prod. Run: DATABASE_URL=... npm run test:location-retention-integration
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import bcryptjs from 'bcryptjs';
import { randomUUID } from 'crypto';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function main() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'location-retention-integration';
  delete process.env.LOCATION_LIVE_STALE_DAYS;
  delete process.env.LOCATION_MAP_FEED_COORDS_GRACE_HOURS;
  delete process.env.LOCATION_COMMUNITY_COORDS_GRACE_HOURS;
  for (const k of [
    'LOCATION_PURGE_ENABLED',
    'LOCATION_CHAT_SHARE_PURGE_ENABLED',
    'LOCATION_CHAT_SHARE_DAYS',
    'CHECKIN_PURGE_ENABLED',
    'CHECKIN_PURGE_HOURS',
  ]) {
    delete process.env[k];
  }
  const { default: pool, query } = await import('../src/db');
  const { userService } = await import('../src/services/user.service');
  const { authService } = await import('../src/services/auth.service');
  const { mapFeedService } = await import('../src/services/map-feed.service');
  const { communityService } = await import('../src/services/community.service');
  const { locationRetentionService, startLocationRetentionWorker } = await import(
    '../src/services/location-retention.service'
  );
  const { locationRetentionConfig, coarsenCoord } = await import('../src/config/locationRetention');
  const { resetLocationJumpGate } = await import('../src/lib/locationJumpGate');
  const { viewerStoredLocation } = await import('../src/lib/viewerOrigin');

  const ids: string[] = [];
  const PASSWORD = 'Retention-test-1';
  const hash = await bcryptjs.hash(PASSWORD, 4);
  async function makeUser(name: string, loc: { lat: number; lng: number } | null, lastSeen?: Date) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, $3, $4, 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [id, `lrp-${id.slice(0, 8)}@test.menrush.local`, hash, name],
    );
    if (loc) {
      await query(
        `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, location_updated_at, is_visible, is_ghost)
         VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, $4::timestamptz, $4::timestamptz, TRUE, FALSE)`,
        [id, loc.lat, loc.lng, (lastSeen ?? new Date()).toISOString()],
      );
    } else {
      await query(`INSERT INTO profiles (user_id, online, last_seen) VALUES ($1, TRUE, NOW())`, [id]);
    }
    return id;
  }
  const profile = async (id: string) =>
    (await query(`SELECT * FROM profiles WHERE user_id = $1`, [id])).rows[0];

  // Isolated spot (Outer Hebrides) so other local rows cannot interfere.
  const LAT = 57.7631;
  const LNG = -7.0154;

  try {
    // ── Config ──────────────────────────────────────────────────────────────
    const cfg = locationRetentionConfig();
    assert.deepStrictEqual(
      [
        cfg.enabled,
        cfg.liveStaleDays,
        cfg.mapFeedCoordsGraceHours,
        cfg.communityCoordsGraceHours,
        cfg.purgeIntervalMinutes,
        cfg.chatSharePurgeEnabled,
        cfg.chatShareDays,
        cfg.checkinPurgeEnabled,
        cfg.checkinPurgeHours,
      ],
      [false, 30, 24, 24, 60, false, 7, false, 24],
      'defaults: off, 30 days, 24 h, 24 h, hourly; chat share rule off (7 days); check-in rule off (24 h)',
    );
    assert.strictEqual(startLocationRetentionWorker(), null, 'worker does not start unless LOCATION_PURGE_ENABLED=true');
    assert.strictEqual(coarsenCoord(51.507412), 51.51);
    assert.strictEqual(coarsenCoord(-0.127758), -0.13);
    console.log('✓ config defaults; worker off by default');

    // ── 0. Every flag off: no data change ────────────────────────────────────
    resetLocationJumpGate();
    const precise = await makeUser('LRP Precise', null);
    await userService.updateLocation(precise, 51.507412, -0.127758);
    let p = await profile(precise);
    assert.deepStrictEqual(
      [Number(p.home_lat), Number(p.home_lng)],
      [51.507412, -0.127758],
      'flag off: home stored as before (not rounded)',
    );
    const offLegacy = await makeUser('LRP Off legacy', { lat: LAT, lng: LNG });
    await query(
      `UPDATE profiles SET home_lat = 51.507412, home_lng = -0.127758, location_updated_at = NULL WHERE user_id = $1`,
      [offLegacy],
    );
    const offResult = await locationRetentionService.runPurge(new Date('2030-01-01T00:00:00Z'));
    assert.ok(Object.values(offResult).every((n) => n === 0), 'flags off: runPurge changes nothing');
    p = await profile(offLegacy);
    assert.deepStrictEqual([Number(p.home_lat), p.location_updated_at, Number(p.lat)], [51.507412, null, LAT], 'flags off: row untouched');
    console.log('✓ every flag off: home not rounded on write, purge does nothing');

    // From here on the main purge is on.
    process.env.LOCATION_PURGE_ENABLED = 'true';

    // ── 1. Home and visit anchor rounded on write ─────────────────────────────
    resetLocationJumpGate();
    const walker = await makeUser('LRP Walker', null);
    await userService.updateLocation(walker, 51.507412, -0.127758); // London
    p = await profile(walker);
    assert.deepStrictEqual([Number(p.home_lat), Number(p.home_lng)], [51.51, -0.13], 'home rounded to 2 dp');
    assert.deepStrictEqual([Number(p.lat), Number(p.lng)], [51.507412, -0.127758], 'live location unchanged (precise, used for the fuzzed pin)');
    assert.ok(p.location_updated_at, 'location_updated_at set on write');
    resetLocationJumpGate(); // allow the long move without waiting
    await userService.updateLocation(walker, 53.480759, -2.242631); // Manchester: a visit
    p = await profile(walker);
    assert.deepStrictEqual([Number(p.visitor_anchor_lat), Number(p.visitor_anchor_lng)], [53.48, -2.24], 'visit anchor rounded');
    assert.ok(p.visitor_expires_at, 'visit still detected at 1 km precision');
    resetLocationJumpGate();
    await userService.updateLocation(walker, 51.5, -0.12); // back home, 1 km from the rounded home
    p = await profile(walker);
    assert.strictEqual(p.visitor_expires_at, null, 'return home still clears the visit');
    console.log('✓ home and visit anchor stored at about 1 km; visitor detection unchanged');

    // ── 2. Migration 076 is schema only; the gated job backfills ─────────────
    const legacy = await makeUser('LRP Legacy', { lat: LAT, lng: LNG });
    const legacySeen = new Date(Date.now() - 3 * DAY);
    await query(
      `UPDATE profiles SET home_lat = 51.507412, home_lng = -0.127758,
              visitor_anchor_lat = 53.480759, visitor_anchor_lng = -2.242631,
              location_updated_at = NULL, last_seen = $2::timestamptz
        WHERE user_id = $1`,
      [legacy, legacySeen],
    );
    const migration = fs.readFileSync(
      path.join(__dirname, '../../database/migrations/076_location_retention.sql'),
      'utf8',
    );
    await query(migration); // idempotent
    p = await profile(legacy);
    assert.deepStrictEqual(
      [Number(p.home_lat), Number(p.visitor_anchor_lat), p.location_updated_at],
      [51.507412, 53.480759, null],
      'migration 076 changes no data (no rounding, no backfill)',
    );
    assert.ok(!/\bUPDATE\b/i.test(migration.replace(/--.*$/gm, '')), 'migration 076 has no UPDATE');
    assert.ok(/SET LOCAL lock_timeout = '5s'/.test(migration), 'migration 076 sets a lock_timeout');
    await locationRetentionService.runPurge(new Date());
    p = await profile(legacy);
    assert.deepStrictEqual([Number(p.home_lat), Number(p.home_lng)], [51.51, -0.13], 'backfill rounds home');
    assert.deepStrictEqual([Number(p.visitor_anchor_lat), Number(p.visitor_anchor_lng)], [53.48, -2.24], 'backfill rounds visit anchor');
    assert.strictEqual(new Date(p.location_updated_at).getTime(), legacySeen.getTime(), 'location_updated_at backfilled from last_seen');
    assert.strictEqual(Number(p.lat), LAT, 'backfill leaves live location alone');
    await locationRetentionService.runPurge(new Date()); // re-runnable
    assert.strictEqual(Number((await profile(legacy)).home_lat), 51.51, 'second run: unchanged');
    console.log('✓ migration 076 schema only; rounding and backfill run in the gated job (re-runnable)');

    // ── 3. Stale live location cleared, fake clock ────────────────────────────
    const NOW = new Date('2027-01-15T12:00:00Z');
    const fresh = await makeUser('LRP Fresh', { lat: LAT, lng: LNG }, new Date(NOW.getTime() - 29 * DAY));
    const stale = await makeUser('LRP Stale', { lat: LAT + 0.01, lng: LNG }, new Date(NOW.getTime() - 31 * DAY));
    await query(
      `UPDATE profiles SET visitor_anchor_lat = 53.48, visitor_anchor_lng = -2.24, visitor_expires_at = $2,
              home_lat = 57.76, home_lng = -7.02 WHERE user_id = $1`,
      [stale, NOW],
    );
    await locationRetentionService.clearStaleLiveLocations(NOW);
    const pf = await profile(fresh);
    const ps = await profile(stale);
    assert.strictEqual(Number(pf.lat), LAT, '29 days: kept');
    assert.ok(ps.lat === null && ps.lng === null && ps.location === null, '31 days: live location cleared');
    assert.ok(ps.visitor_anchor_lat === null && ps.visitor_expires_at === null, '31 days: visit anchor cleared');
    assert.strictEqual(Number(ps.home_lat), 57.76, 'home (already about 1 km) kept for visitor detection');
    process.env.LOCATION_LIVE_STALE_DAYS = '7';
    await locationRetentionService.clearStaleLiveLocations(NOW);
    assert.strictEqual((await profile(fresh)).lat, null, 'LOCATION_LIVE_STALE_DAYS=7 clears the 29-day row');
    delete process.env.LOCATION_LIVE_STALE_DAYS;
    console.log('✓ live location cleared after 30 days without an update (config value)');

    // Readers handle a cleared location.
    assert.strictEqual(await viewerStoredLocation(stale), null);
    const nbStale = await userService.getNearbyUsers(stale, 10);
    assert.deepStrictEqual(nbStale.users, [], 'nearby for a cleared viewer: empty, no error');
    const viewer = await makeUser('LRP Viewer', { lat: LAT, lng: LNG });
    const nbViewer = await userService.getNearbyUsers(viewer, 10);
    assert.ok(!nbViewer.users.some((u: any) => u.id === stale), 'nearby: a cleared member is not listed');
    assert.deepStrictEqual(await mapFeedService.listNearby(stale), [], 'map feed for a cleared viewer: empty');
    await assert.rejects(() => mapFeedService.post(stale, 'hi'), /location_required/, 'map feed post asks for location');
    resetLocationJumpGate();
    await userService.updateLocation(stale, LAT, LNG);
    assert.strictEqual(Number((await profile(stale)).lat), LAT, 'a new fix after a clear is stored (jump gate fine)');
    console.log('✓ nearby, map feed and the jump gate handle a cleared location');

    // ── 4. Map feed and Community post coordinates ────────────────────────────
    const poster = await makeUser('LRP Poster', { lat: LAT, lng: LNG });
    const reported = await makeUser('LRP Reported', { lat: LAT, lng: LNG });
    const reporter = await makeUser('LRP Reporter', { lat: LAT, lng: LNG });
    async function mf(sender: string, createdAt: Date) {
      const id = randomUUID();
      await query(
        `INSERT INTO map_feed_messages (id, sender_id, message, location, lat, lng, created_at)
         VALUES ($1, $2, 'x', ST_MakePoint($4, $3)::geography, $3, $4, $5)`,
        [id, sender, LAT, LNG, createdAt],
      );
      return id;
    }
    async function cp(user: string, createdAt: Date) {
      const r = await query(
        `INSERT INTO community_posts (user_id, body, lat, lng, location, created_at)
         VALUES ($1, 'x', $2, $3, ST_MakePoint($3, $2)::geography, $4) RETURNING id`,
        [user, LAT, LNG, createdAt],
      );
      return r.rows[0].id as string;
    }
    // Map feed: visible 15 min, then 24 h grace.
    const mfOld = await mf(poster, new Date(NOW.getTime() - 15 * 60 * 1000 - 24 * HOUR - 60 * 1000));
    const mfYoung = await mf(poster, new Date(NOW.getTime() - 15 * 60 * 1000 - 23 * HOUR));
    const mfHeld = await mf(reported, new Date(NOW.getTime() - 3 * DAY));
    // Community: visible 24 h, then 24 h grace.
    const cpOld = await cp(poster, new Date(NOW.getTime() - 48 * HOUR - 60 * 1000));
    const cpYoung = await cp(poster, new Date(NOW.getTime() - 47 * HOUR));
    const cpHeld = await cp(reported, new Date(NOW.getTime() - 3 * DAY));
    const rep = await query(
      `INSERT INTO reports (reporter_id, reported_id, reason, status) VALUES ($1, $2, 'spam', 'open') RETURNING id`,
      [reporter, reported],
    );
    await locationRetentionService.runPurge(NOW);
    const mfRow = async (id: string) => (await query(`SELECT * FROM map_feed_messages WHERE id = $1`, [id])).rows[0];
    const cpRow = async (id: string) => (await query(`SELECT * FROM community_posts WHERE id = $1`, [id])).rows[0];
    const stripped = (r: any) => r && r.lat === null && r.lng === null && r.location === null;
    assert.ok(stripped(await mfRow(mfOld)), 'map feed: coordinates gone 24 h after expiry');
    assert.strictEqual((await mfRow(mfOld)).message, 'x', 'map feed: the post itself stays');
    assert.ok(!stripped(await mfRow(mfYoung)), 'map feed: kept inside the grace period');
    assert.ok(!stripped(await mfRow(mfHeld)), 'map feed: held while a report on the author is open');
    assert.ok(stripped(await cpRow(cpOld)), 'community: coordinates gone 24 h after expiry');
    assert.ok(!stripped(await cpRow(cpYoung)), 'community: kept inside the grace period');
    assert.ok(!stripped(await cpRow(cpHeld)), 'community: held while a report on the author is open');
    await query(`UPDATE reports SET status = 'reviewing' WHERE id = $1`, [rep.rows[0].id]);
    await locationRetentionService.runPurge(NOW);
    assert.ok(!stripped(await mfRow(mfHeld)), 'still held while reviewing');
    await query(`UPDATE reports SET status = 'actioned', resolved_at = NOW() WHERE id = $1`, [rep.rows[0].id]);
    await locationRetentionService.runPurge(NOW);
    assert.ok(stripped(await mfRow(mfHeld)) && stripped(await cpRow(cpHeld)), 'released once moderation closes');
    process.env.LOCATION_MAP_FEED_COORDS_GRACE_HOURS = '0';
    process.env.LOCATION_COMMUNITY_COORDS_GRACE_HOURS = '0';
    await locationRetentionService.runPurge(NOW);
    assert.ok(stripped(await mfRow(mfYoung)) && stripped(await cpRow(cpYoung)), 'grace config values apply');
    delete process.env.LOCATION_MAP_FEED_COORDS_GRACE_HOURS;
    delete process.env.LOCATION_COMMUNITY_COORDS_GRACE_HOURS;
    // Live reads still fine next to stripped rows. (The fake 2027 clock also
    // cleared these members' live locations as stale, so give them a fix.)
    for (const u of [poster, viewer]) {
      resetLocationJumpGate();
      await userService.updateLocation(u, LAT, LNG);
    }
    const livePost = await communityService.create(poster, 'still here');
    const listed = await communityService.listNearby({ viewerId: viewer, lat: LAT, lng: LNG, radiusKm: 10 });
    assert.ok(listed.some((x: any) => x.id === livePost.id), 'community list works next to stripped rows');
    await mapFeedService.post(poster, 'live');
    const feed = await mapFeedService.listNearby(viewer);
    assert.ok(feed.some((m: any) => m.message === 'live'), 'map feed list works next to stripped rows');
    console.log('✓ map feed and Community coordinates removed after expiry + grace, held for open reports');

    // ── 4b. Optional rule: chat location share coordinates after 7 days ──────
    const sharer = await makeUser('LRP Sharer', { lat: LAT, lng: LNG });
    const sharee = await makeUser('LRP Sharee', { lat: LAT, lng: LNG });
    const shareReported = await makeUser('LRP Share reported', { lat: LAT, lng: LNG });
    const COORDS = '{"lat":57.7631,"lng":-7.0154}';
    async function share(sender: string, createdAt: Date, withdrawn = false) {
      const id = randomUUID();
      await query(
        `INSERT INTO messages (id, sender_id, receiver_id, message, media_type, created_at, withdrawn_at)
         VALUES ($1, $2, $3, $4, 'location', $5, $6)`,
        [id, sender, sharee, withdrawn ? 'Location withdrawn' : COORDS, createdAt, withdrawn ? createdAt : null],
      );
      return id;
    }
    const msgRow = async (id: string) => (await query(`SELECT message, withdrawn_at FROM messages WHERE id = $1`, [id])).rows[0];
    const shareOld = await share(sharer, new Date(NOW.getTime() - 7 * DAY - 60 * 1000));
    const shareYoung = await share(sharer, new Date(NOW.getTime() - 6 * DAY));
    const shareWithdrawn = await share(sharer, new Date(NOW.getTime() - 9 * DAY), true);
    const shareHeld = await share(shareReported, new Date(NOW.getTime() - 9 * DAY));
    const textId = randomUUID();
    await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [textId, sharer, sharee, COORDS, new Date(NOW.getTime() - 9 * DAY)],
    );
    const shareRep = await query(
      `INSERT INTO reports (reporter_id, reported_id, reason, status) VALUES ($1, $2, 'spam', 'open') RETURNING id`,
      [sharee, shareReported],
    );
    let r0 = await locationRetentionService.runPurge(NOW);
    assert.strictEqual(r0.chatSharesCleared, 0, 'chat share rule off by default');
    assert.strictEqual((await msgRow(shareOld)).message, COORDS, 'off: old share keeps its coordinates');
    process.env.LOCATION_CHAT_SHARE_PURGE_ENABLED = 'true';
    await locationRetentionService.runPurge(NOW);
    const { CLEARED_CHAT_SHARE_PAYLOAD } = await import('../src/services/location-retention.service');
    assert.strictEqual((await msgRow(shareOld)).message, CLEARED_CHAT_SHARE_PAYLOAD, 'on: share older than 7 days cleared');
    assert.ok(!/lat|lng/.test((await msgRow(shareOld)).message), 'cleared share holds no coordinates');
    assert.strictEqual((await msgRow(shareYoung)).message, COORDS, 'on: 6-day-old share kept');
    assert.strictEqual((await msgRow(shareWithdrawn)).message, 'Location withdrawn', 'withdrawn share left as is');
    assert.strictEqual((await msgRow(shareHeld)).message, COORDS, 'held while a report on the sender is open');
    assert.strictEqual((await msgRow(textId)).message, COORDS, 'ordinary text messages never touched');
    await query(`UPDATE reports SET status = 'actioned', resolved_at = NOW() WHERE id = $1`, [shareRep.rows[0].id]);
    await locationRetentionService.runPurge(NOW);
    assert.strictEqual((await msgRow(shareHeld)).message, CLEARED_CHAT_SHARE_PAYLOAD, 'released once moderation closes');
    process.env.LOCATION_CHAT_SHARE_DAYS = '5';
    await locationRetentionService.runPurge(NOW);
    assert.strictEqual((await msgRow(shareYoung)).message, CLEARED_CHAT_SHARE_PAYLOAD, 'LOCATION_CHAT_SHARE_DAYS applies');
    delete process.env.LOCATION_CHAT_SHARE_DAYS;
    delete process.env.LOCATION_CHAT_SHARE_PURGE_ENABLED;
    console.log('✓ optional: chat location share coordinates cleared 7 days after sending (own flag, off by default)');

    // ── 4c. Optional rule: check-ins deleted 24 h after they end ─────────────
    const cat = await query(`SELECT id FROM hot_spot_categories ORDER BY id LIMIT 1`);
    const spot = await query(
      `INSERT INTO hot_spots (category_id, name, latitude, longitude) VALUES ($1, 'LRP spot', $2, $3) RETURNING id`,
      [cat.rows[0].id, LAT, LNG],
    );
    const spotId = spot.rows[0].id as string;
    const checker = await makeUser('LRP Checker', { lat: LAT, lng: LNG });
    async function checkin(inAt: Date, outAt: Date | null) {
      const r = await query(
        `INSERT INTO hot_spot_checkins (spot_id, user_id, checked_in_at, checked_out_at) VALUES ($1, $2, $3, $4) RETURNING id`,
        [spotId, checker, inAt, outAt],
      );
      return r.rows[0].id as string;
    }
    const ciExists = async (id: string) =>
      (await query(`SELECT 1 FROM hot_spot_checkins WHERE id = $1`, [id])).rows.length === 1;
    // Checked out 25 h ago: deleted. Checked out 23 h ago: kept.
    const ciOutOld = await checkin(new Date(NOW.getTime() - 27 * HOUR), new Date(NOW.getTime() - 25 * HOUR));
    const ciOutYoung = await checkin(new Date(NOW.getTime() - 24 * HOUR), new Date(NOW.getTime() - 23 * HOUR));
    // Never checked out: ends at check-in + 4 h (longest TTL).
    const ciTtlOld = await checkin(new Date(NOW.getTime() - 29 * HOUR), null); // ended 25 h ago
    const ciTtlYoung = await checkin(new Date(NOW.getTime() - 26 * HOUR), null); // ended 22 h ago
    const ciActive = await checkin(new Date(NOW.getTime() - 1 * HOUR), null);
    r0 = await locationRetentionService.runPurge(NOW);
    assert.strictEqual(r0.checkinsDeleted, 0, 'check-in rule off by default');
    assert.ok(await ciExists(ciOutOld), 'off: old check-in kept');
    process.env.CHECKIN_PURGE_ENABLED = 'true';
    await locationRetentionService.runPurge(NOW);
    assert.ok(!(await ciExists(ciOutOld)), 'checked out 25 h ago: deleted');
    assert.ok(await ciExists(ciOutYoung), 'checked out 23 h ago: kept');
    assert.ok(!(await ciExists(ciTtlOld)), 'never checked out, TTL ended 25 h ago: deleted');
    assert.ok(await ciExists(ciTtlYoung), 'never checked out, TTL ended 22 h ago: kept');
    assert.ok(await ciExists(ciActive), 'active check-in kept');
    process.env.CHECKIN_PURGE_HOURS = '0';
    await locationRetentionService.runPurge(NOW);
    assert.ok(!(await ciExists(ciOutYoung)) && (await ciExists(ciActive)), 'CHECKIN_PURGE_HOURS applies; active still kept');
    delete process.env.CHECKIN_PURGE_HOURS;
    // Only the optional rules on (main purge off): the worker still starts.
    process.env.LOCATION_PURGE_ENABLED = 'false';
    const { anyLocationPurgeEnabled } = await import('../src/config/locationRetention');
    assert.strictEqual(anyLocationPurgeEnabled(), true, 'worker starts for an optional rule on its own');
    const onlyCheckins = await locationRetentionService.runPurge(NOW);
    assert.strictEqual(onlyCheckins.staleLiveCleared + onlyCheckins.homeRounded + onlyCheckins.mapFeedStripped, 0, 'main purge stays off');
    delete process.env.CHECKIN_PURGE_ENABLED;
    process.env.LOCATION_PURGE_ENABLED = 'true';
    await query(`DELETE FROM hot_spots WHERE id = $1`, [spotId]);
    console.log('✓ optional: check-ins deleted 24 h after they end (own flag, off by default)');

    // ── 5a. Account deletion is one transaction ──────────────────────────────
    {
      const stuck = await makeUser('LRP Stuck', { lat: LAT, lng: LNG });
      const stuckPost = await mf(stuck, new Date());
      await query(
        `INSERT INTO trusted_devices (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
        [stuck, `lrp-${stuck}`],
      );
      // Make the final DELETE FROM users fail for this member only.
      await query(`CREATE OR REPLACE FUNCTION lrp_block_delete() RETURNS trigger AS $$
        BEGIN
          IF OLD.id = '${stuck}'::uuid THEN RAISE EXCEPTION 'lrp: delete blocked'; END IF;
          RETURN OLD;
        END $$ LANGUAGE plpgsql`);
      await query(`CREATE TRIGGER lrp_block_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION lrp_block_delete()`);
      try {
        await assert.rejects(
          () => authService.deleteAccount(stuck, { current_password: PASSWORD, confirmation: 'DELETE' } as any),
          /delete blocked/,
        );
      } finally {
        await query(`DROP TRIGGER IF EXISTS lrp_block_delete ON users`);
        await query(`DROP FUNCTION IF EXISTS lrp_block_delete()`);
      }
      assert.ok(await mfRow(stuckPost), 'failed deletion: map feed post still there (rolled back)');
      assert.strictEqual(Number((await profile(stuck)).lat), LAT, 'failed deletion: profile location untouched');
      const dev = await query(`SELECT revoked_at FROM trusted_devices WHERE user_id = $1`, [stuck]);
      assert.ok(dev.rows.every((r: any) => r.revoked_at === null), 'failed deletion: trusted devices not revoked');
      await authService.deleteAccount(stuck, { current_password: PASSWORD, confirmation: 'DELETE' } as any);
      assert.strictEqual((await query(`SELECT 1 FROM users WHERE id = $1`, [stuck])).rows.length, 0, 'retry succeeds');
      console.log('✓ account deletion is one transaction: a failure rolls every step back');
    }

    // ── 5. Account deletion ───────────────────────────────────────────────────
    const leaver = await makeUser('LRP Leaver', { lat: LAT, lng: LNG });
    const friend = await makeUser('LRP Friend', { lat: LAT, lng: LNG });
    await query(`UPDATE profiles SET home_lat = 57.76, home_lng = -7.02 WHERE user_id = $1`, [leaver]);
    await mf(leaver, new Date());
    await cp(leaver, new Date());
    const shareOut = randomUUID();
    const shareIn = randomUUID();
    await query(
      `INSERT INTO messages (id, sender_id, receiver_id, message, media_type) VALUES
         ($1, $3, $4, '{"lat":57.7631,"lng":-7.0154}', 'location'),
         ($2, $4, $3, '{"lat":57.7632,"lng":-7.0155}', 'location')`,
      [shareOut, shareIn, leaver, friend],
    );
    const roomId = randomUUID();
    await query(
      `INSERT INTO rooms (id, name, created_by, is_location_based, location, lat, lng, is_official)
       VALUES ($1, 'LRP room', $2, TRUE, ST_MakePoint($4, $3)::geography, $3, $4, FALSE)`,
      [roomId, leaver, LAT, LNG],
    );
    await authService.deleteAccount(leaver, { current_password: PASSWORD, confirmation: 'DELETE' } as any);
    const count = async (sql: string) => Number((await query(sql, [leaver])).rows[0].n);
    assert.strictEqual(await count(`SELECT COUNT(*) AS n FROM users WHERE id = $1`), 0, 'user gone');
    assert.strictEqual(await count(`SELECT COUNT(*) AS n FROM profiles WHERE user_id = $1`), 0, 'profile (live, home, anchor) gone');
    assert.strictEqual(await count(`SELECT COUNT(*) AS n FROM map_feed_messages WHERE sender_id = $1`), 0, 'map feed posts gone');
    assert.strictEqual(await count(`SELECT COUNT(*) AS n FROM community_posts WHERE user_id = $1`), 0, 'community posts gone');
    const shares = await query(`SELECT COUNT(*)::int AS n FROM messages WHERE id = ANY($1::uuid[])`, [[shareOut, shareIn]]);
    assert.strictEqual(shares.rows[0].n, 0, 'chat location shares (sent and received) gone');
    const room = (await query(`SELECT created_by, lat, lng, location FROM rooms WHERE id = $1`, [roomId])).rows[0];
    assert.ok(room, 'their room stays for the other members');
    assert.ok(room.created_by === null && room.lat === null && room.location === null, 'room creator and point cleared');
    console.log('✓ account deletion removes map feed, Community, chat location shares and room points (room creators can delete)');
    await query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
  } finally {
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    await pool.end();
  }
  console.log('location-retention-integration: ok');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
