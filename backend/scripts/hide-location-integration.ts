/**
 * Integration: "Hide my location from" against Postgres/PostGIS.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush123@localhost:5432/menrush \
 *   npx ts-node scripts/hide-location-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('hide-location-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { userService } = await import('../src/services/user.service');
  const { communityService } = await import('../src/services/community.service');
  const { messageService } = await import('../src/services/message.service');
  const { roomService } = await import('../src/services/room.service');
  const { locationHideService, LocationHideError } = await import('../src/services/location-hide.service');
  const { SecurityError } = await import('../src/security/access');

  const ids: string[] = [];
  async function makeUser(name: string, lat: number, lng: number, premium = false) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status,
                          verification_provider, photo_url, is_premium, premium_tier)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', 'veriff', '/uploads/test.jpg', $4, $5)`,
      [id, `hl-${id.slice(0, 8)}@test.menrush.local`, name, premium, premium ? 'premium' : 'free'],
    );
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
       VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), TRUE, FALSE)`,
      [id, lat, lng],
    );
    return id;
  }
  async function mutualMatch(a: string, b: string) {
    await query(`INSERT INTO likes (liker_id, liked_id) VALUES ($1, $2), ($2, $1) ON CONFLICT DO NOTHING`, [a, b]);
  }

  const prevBeta = process.env.BETA_PREMIUM_FREE;
  try {
    const owner = await makeUser('HL Owner', 51.5074, -0.1278, true);
    const stalker = await makeUser('HL Hidden', 51.51, -0.13);
    const other = await makeUser('HL Other', 51.509, -0.129);
    const freeOwner = await makeUser('HL Free', 51.508, -0.128);

    // ── API: Premium to add, removing always allowed ─────────────────────────
    process.env.BETA_PREMIUM_FREE = 'false';
    await assert.rejects(
      () => locationHideService.add(freeOwner, stalker),
      (e: unknown) => e instanceof LocationHideError && (e as any).code === 'premium_required' && (e as any).status === 402,
    );
    await assert.rejects(
      () => locationHideService.add(owner, owner),
      (e: unknown) => e instanceof LocationHideError && (e as any).code === 'invalid_target',
    );
    await assert.rejects(
      () => locationHideService.add(owner, randomUUID()),
      (e: unknown) => e instanceof LocationHideError && (e as any).code === 'user_not_found',
    );

    // Baseline before hiding: stalker sees owner everywhere.
    const nearby = async (viewer: string) =>
      userService.getNearbyUsers(viewer, 20, { discoveryScope: 'radius' }, undefined, { limit: 200 });
    let res = await nearby(stalker);
    assert.ok(res.users.some((u: any) => u.id === owner), 'baseline: owner in roster');
    const baselineTotal = res.total;
    const baselineProfile: any = await userService.getPublicProfile(stalker, owner);
    assert.ok(baselineProfile.distance_km != null, 'baseline: profile has distance');

    await locationHideService.add(owner, stalker);
    await locationHideService.add(owner, stalker); // idempotent
    let list = await locationHideService.list(owner);
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].id, stalker);
    assert.strictEqual(list[0].name, 'HL Hidden');
    assert.ok(!('email' in list[0]));

    // ── Nearby + map pins: owner is gone for the hidden viewer only ─────────
    res = await nearby(stalker);
    assert.ok(!res.users.some((u: any) => u.id === owner), 'hidden viewer: owner not in roster/map');
    assert.strictEqual(res.total, baselineTotal - 1, 'count matches the list (no off-by-one hint)');
    const otherView = await nearby(other);
    const ownerForOther: any = otherView.users.find((u: any) => u.id === owner);
    assert.ok(ownerForOther && Number.isFinite(ownerForOther.lat), 'other viewers still see owner + pin');
    // Owner still sees the stalker (hiding is one-way).
    assert.ok((await nearby(owner)).users.some((u: any) => u.id === stalker));

    // ── Direct profile: stripped, same shape as any no-distance profile ─────
    const hiddenProfile: any = await userService.getPublicProfile(stalker, owner);
    assert.strictEqual(hiddenProfile.distance_km, null);
    assert.strictEqual(hiddenProfile.distance_label, null);
    assert.deepStrictEqual(
      Object.keys(hiddenProfile).sort(),
      Object.keys(baselineProfile).sort(),
      'no extra or missing keys: nothing tells the viewer they are hidden',
    );
    for (const k of Object.keys(hiddenProfile)) {
      assert.ok(!/hidden|hide|restrict/i.test(k), `no tell-tale key: ${k}`);
    }
    // Same shape as a ghost owner's profile seen by a match.
    const otherProfile: any = await userService.getPublicProfile(other, owner);
    assert.ok(otherProfile.distance_km != null, 'other viewer still gets distance');

    // ── Community: owner's posts are not in the hidden viewer's feed ────────
    await communityService.create(owner, 'hl owner post');
    const stalkerFeed = await communityService.listNearby({ viewerId: stalker, lat: 51.51, lng: -0.13, radiusKm: 10 });
    assert.ok(!stalkerFeed.some((p) => p.user_id === owner));
    const otherFeed = await communityService.listNearby({ viewerId: other, lat: 51.509, lng: -0.129, radiusKm: 10 });
    assert.ok(otherFeed.some((p) => p.user_id === owner));

    // ── Map feed + nearby rooms helpers ─────────────────────────────────────
    assert.deepStrictEqual(
      [...(await locationHideService.ownersHidingFrom(stalker, [owner, other]))],
      [owner],
    );
    assert.deepStrictEqual(
      [...(await locationHideService.viewersHiddenBy(owner, [stalker, other]))],
      [stalker],
    );
    process.env.BETA_PREMIUM_FREE = 'true';
    const room = await roomService.createRoom(owner, {
      name: 'HL owner spot',
      is_location_based: true,
      lat: 51.5075,
      lng: -0.1279,
    });
    const stalkerRooms = await roomService.getRooms(stalker, { lat: 51.51, lng: -0.13, radius: 10 });
    assert.ok(!stalkerRooms.nearby_rooms.some((r: any) => r.id === room.id), 'creator room hidden');
    const otherRooms = await roomService.getRooms(other, { lat: 51.509, lng: -0.129, radius: 10 });
    assert.ok(otherRooms.nearby_rooms.some((r: any) => r.id === room.id));
    await query(`DELETE FROM rooms WHERE id = $1`, [room.id]);

    // ── Chat is NOT blocked ─────────────────────────────────────────────────
    await mutualMatch(owner, stalker);
    const m1: any = await messageService.sendMessage(stalker, owner, 'hello from hidden viewer');
    const m2: any = await messageService.sendMessage(owner, stalker, 'hello back');
    assert.ok(m1?.id && m2?.id, 'chat still works both ways');

    // ── Blocks still take precedence ────────────────────────────────────────
    await query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [owner, stalker]);
    await assert.rejects(
      () => userService.getPublicProfile(stalker, owner),
      (e: unknown) => e instanceof SecurityError && (e as any).code === 'interaction_blocked',
      'block wins over hide: profile is blocked, not just stripped',
    );
    await assert.rejects(() => messageService.sendMessage(stalker, owner, 'x'));
    assert.ok(!(await nearby(stalker)).users.some((u: any) => u.id === owner));
    await query(`DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`, [owner, stalker]);

    // ── Remove: always allowed, even without Premium ───────────────────────
    process.env.BETA_PREMIUM_FREE = 'false';
    await query(`UPDATE users SET is_premium = FALSE, premium_tier = 'free' WHERE id = $1`, [owner]);
    await locationHideService.remove(owner, stalker);
    list = await locationHideService.list(owner);
    assert.strictEqual(list.length, 0);
    assert.ok((await nearby(stalker)).users.some((u: any) => u.id === owner), 'visible again after removal');

    // ── Cascade on user delete ──────────────────────────────────────────────
    process.env.BETA_PREMIUM_FREE = 'true';
    await locationHideService.add(owner, other);
    await query(`DELETE FROM likes WHERE liker_id = ANY($1::uuid[]) OR liked_id = ANY($1::uuid[])`, [ids]);
    await query(`DELETE FROM messages WHERE sender_id = ANY($1::uuid[]) OR receiver_id = ANY($1::uuid[])`, [ids]);
    await query(`DELETE FROM community_posts WHERE user_id = ANY($1::uuid[])`, [ids]);
    await query(`DELETE FROM profiles WHERE user_id = $1`, [other]);
    await query(`DELETE FROM users WHERE id = $1`, [other]);
    const left = await query(`SELECT COUNT(*)::int AS n FROM location_hidden_from WHERE hidden_user_id = $1`, [other]);
    assert.strictEqual(left.rows[0].n, 0, 'rows cascade when a user is deleted');

    console.log('hide-location-integration: ok');
  } finally {
    if (prevBeta === undefined) delete process.env.BETA_PREMIUM_FREE;
    else process.env.BETA_PREMIUM_FREE = prevBeta;
    await query(`DELETE FROM blocks WHERE blocker_id = ANY($1::uuid[]) OR blocked_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM likes WHERE liker_id = ANY($1::uuid[]) OR liked_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM messages WHERE sender_id = ANY($1::uuid[]) OR receiver_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM community_posts WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM room_members WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM rooms WHERE created_by = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM location_hidden_from WHERE owner_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
