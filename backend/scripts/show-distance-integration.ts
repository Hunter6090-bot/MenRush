/**
 * Integration: Show distance toggle + fuzzed coarse distance against Postgres/PostGIS.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush123@localhost:5432/menrush \
 *   npx ts-node scripts/show-distance-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('show-distance-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}


async function main() {
  const { default: pool, query } = await import('../src/db');
  const { userService, ShowDistancePremiumError } = await import('../src/services/user.service');
  const { communityService } = await import('../src/services/community.service');
  const { mapFeedService } = await import('../src/services/map-feed.service');

  const ids: string[] = [];
  async function makeUser(name: string, lat: number, lng: number, opts: { premium?: boolean; fuzz?: number } = {}) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status,
                          verification_provider, photo_url, is_premium, premium_tier)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', 'veriff', '/uploads/test.jpg', $4, $5)`,
      [id, `sd-${id.slice(0, 8)}@test.menrush.local`, name, Boolean(opts.premium), opts.premium ? 'premium' : 'free'],
    );
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost, map_pin_fuzz_m)
       VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), TRUE, FALSE, $4)`,
      [id, lat, lng, opts.fuzz ?? 800],
    );
    return id;
  }

  const prevBeta = process.env.BETA_PREMIUM_FREE;
  try {
    // Viewer in central London; member ~5 km N (about 3 mi); free member; premium member.
    const viewer = await makeUser('SD Viewer', 51.5074, -0.1278);
    const member = await makeUser('SD Member', 51.55, -0.1, { fuzz: 800 });
    const free = await makeUser('SD Free', 51.51, -0.12);
    const paid = await makeUser('SD Paid', 51.511, -0.121, { premium: true });

    const nearby = async () =>
      (await userService.getNearbyUsers(viewer, 20, { discoveryScope: 'radius' }, undefined, { limit: 200 })).users;
    const find = (list: any[], id: string) => list.find((u) => u.id === id);

    // Default ON: coarse miles, to the fuzzed pin; no exact distance or settings leak.
    let row = find(await nearby(), member);
    assert.ok(row, 'member is in Nearby');
    assert.match(row.distance_label, /^\d+ mi$/, 'whole miles at ~3 mi');
    assert.ok(!('distance_m' in row), 'exact ST_Distance is not in the payload');
    assert.ok(!('show_distance' in row) && !('map_pin_fuzz_m' in row) && !('real_lat' in row));
    const { memberDistanceFields } = await import('../src/lib/memberDistance');
    assert.deepStrictEqual(
      { distance_km: row.distance_km, distance_label: row.distance_label },
      memberDistanceFields({
        memberId: member,
        viewerLat: 51.5074,
        viewerLng: -0.1278,
        memberLat: 51.55,
        memberLng: -0.1,
        fuzzMaxM: 800,
        showDistance: true,
      }),
    );
    const first = row.distance_label;
    console.log(`  member roster distance: ${first} (km bucket ${row.distance_km})`);
    row = find(await nearby(), member);
    assert.strictEqual(row.distance_label, first, 'no jitter between requests');

    let profile: any = await userService.getPublicProfile(viewer, member);
    assert.strictEqual(profile.distance_label, first, 'profile matches roster');

    // Turn OFF (beta: everyone Premium) -> no distance field anywhere.
    process.env.BETA_PREMIUM_FREE = 'true';
    const saved: any = await userService.updateProfile(member, { show_distance: false });
    assert.strictEqual(saved.show_distance, false);
    const own: any = await userService.getOwnProfile(member);
    assert.strictEqual(own.show_distance, false, '/users/me reports the setting to its owner');

    row = find(await nearby(), member);
    assert.ok(row, 'still in Nearby (only distance hidden)');
    assert.ok(!('distance_km' in row) && !('distance_label' in row), 'roster: no distance keys');
    assert.ok(Number.isFinite(row.lat) && Number.isFinite(row.lng), 'fuzzed pin stays (Discretion unchanged)');
    profile = await userService.getPublicProfile(viewer, member);
    assert.ok(!('distance_km' in profile) && !('distance_label' in profile), 'profile: no distance keys');

    // Same shape as a no-distance profile for other reasons (viewer has no location).
    const noLocViewer = randomUUID();
    ids.push(noLocViewer);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, 'x', 'SD NoLoc', 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [noLocViewer, `sd-${noLocViewer.slice(0, 8)}@test.menrush.local`],
    );
    const onProfile: any = await userService.getPublicProfile(noLocViewer, free);
    assert.deepStrictEqual(
      Object.keys(onProfile).sort(),
      Object.keys(profile).sort(),
      'show-distance-off profile has the same keys as any other no-distance profile',
    );

    // Community: author with distance off -> post has no distance.
    await communityService.create(member, 'sd test post');
    await communityService.create(free, 'sd free post');
    const posts = await communityService.listNearby({ viewerId: viewer, lat: 51.5074, lng: -0.1278, radiusKm: 20 });
    const memberPost: any = posts.find((p) => p.user_id === member);
    const freePost: any = posts.find((p) => p.user_id === free);
    assert.ok(memberPost && freePost);
    assert.ok(!('distance_km' in memberPost) && !('distance_label' in memberPost), 'community: no distance keys');
    assert.match(freePost.distance_label, /^(<1 mi|\d+ mi)$/);
    assert.ok(!('distance_m' in freePost) && !('post_lat' in freePost) && !('author_fuzz_m' in freePost));

    // Map feed carries the fuzzed pin, not raw GPS.
    const feedMsg = await mapFeedService.post(free, 'sd feed');
    assert.ok(!(feedMsg.lat === 51.51 && feedMsg.lng === -0.12), 'feed post payload is not raw GPS');
    const feed = await mapFeedService.listNearby(viewer, { lat: 51.5074, lng: -0.1278, radiusKm: 10 });
    const listed = feed.find((m) => m.id === feedMsg.id)!;
    assert.deepStrictEqual({ lat: listed.lat, lng: listed.lng }, { lat: feedMsg.lat, lng: feedMsg.lng });
    assert.ok(!('sender_fuzz_m' in listed));

    // Turning back ON restores distance.
    await userService.updateProfile(member, { show_distance: true });
    row = find(await nearby(), member);
    assert.strictEqual(row.distance_label, first);

    // Premium gating with beta Premium ended.
    process.env.BETA_PREMIUM_FREE = 'false';
    await assert.rejects(
      () => userService.updateProfile(free, { show_distance: false }),
      (err: unknown) => err instanceof ShowDistancePremiumError && (err as any).feature === 'show_distance',
      'free member cannot turn distance off',
    );
    const stillOn: any = await userService.getOwnProfile(free);
    assert.strictEqual(stillOn.show_distance, true, 'rejected change is not saved');
    const paidSaved: any = await userService.updateProfile(paid, { show_distance: false });
    assert.strictEqual(paidSaved.show_distance, false, 'Premium member can turn it off');
    // Lapsed: already off, saving other fields (with show_distance:false) still works.
    await query(`UPDATE users SET is_premium = FALSE, premium_tier = 'free' WHERE id = $1`, [paid]);
    const lapsedSave: any = await userService.updateProfile(paid, { bio: 'still saves', show_distance: false });
    assert.strictEqual(lapsedSave.bio, 'still saves');
    // Turning ON is always allowed.
    const backOn: any = await userService.updateProfile(paid, { show_distance: true });
    assert.strictEqual(backOn.show_distance, true);

    console.log('show-distance-integration: ok');
  } finally {
    if (prevBeta === undefined) delete process.env.BETA_PREMIUM_FREE;
    else process.env.BETA_PREMIUM_FREE = prevBeta;
    await query(`DELETE FROM map_feed_messages WHERE sender_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM community_posts WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
