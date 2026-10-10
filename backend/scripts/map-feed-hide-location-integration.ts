/**
 * Integration: the live map feed respects "Hide my location from".
 * A member who hides their location from the viewer: none of their posts or
 * pins come back in the viewer's feed, and new posts are not pushed to the
 * viewer. Everyone else still sees them. The filter runs in SQL before LIMIT,
 * so hidden posts never use up the page.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npx ts-node scripts/map-feed-hide-location-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('map-feed-hide-location-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { mapFeedService, MAP_FEED_LIMIT } = await import('../src/services/map-feed.service');

  const ids: string[] = [];
  async function makeUser(name: string, lat: number, lng: number) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [id, `mfh-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
       VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), TRUE, FALSE)`,
      [id, lat, lng],
    );
    return id;
  }
  const hide = (owner: string, viewer: string) =>
    query(`INSERT INTO location_hidden_from (owner_id, hidden_user_id) VALUES ($1, $2)`, [owner, viewer]);
  const unhide = (owner: string, viewer: string) =>
    query(`DELETE FROM location_hidden_from WHERE owner_id = $1 AND hidden_user_id = $2`, [owner, viewer]);
  /** Post, then pin created_at so order is deterministic (minutesAgo within the 15 min window). */
  async function postAt(sender: string, text: string, minutesAgo: number) {
    const saved = await mapFeedService.post(sender, text);
    await query(
      `UPDATE map_feed_messages SET created_at = NOW() - ($2::int * INTERVAL '1 minute') WHERE id = $1`,
      [saved.id, minutesAgo],
    );
    return saved;
  }

  // Isolated spot so other local rows in the 5 km radius cannot interfere.
  const LAT = 57.4812;
  const LNG = -7.3627;

  try {
    const viewer = await makeUser('MFH Viewer', LAT, LNG);
    const owner = await makeUser('MFH Owner (hides from viewer)', LAT + 0.001, LNG);
    const other = await makeUser('MFH Other viewer', LAT - 0.001, LNG);
    const control = await makeUser('MFH Control poster', LAT, LNG + 0.001);

    await hide(owner, viewer);

    const ownerPost = await postAt(owner, 'owner post', 1);
    await postAt(control, 'control post', 2);

    const senders = async (uid: string, limit?: number) =>
      (await mapFeedService.listNearby(uid, { radiusKm: 5, limit })).map((m) => m.sender_id);

    // ── Hidden from the viewer: not returned. Hidden from someone else: returned.
    const viewerFeed = await senders(viewer);
    assert.ok(!viewerFeed.includes(owner), 'owner hides from viewer: owner post and pin not returned');
    assert.ok(viewerFeed.includes(control), 'viewer still sees other posts');

    const otherFeed = await senders(other);
    assert.ok(otherFeed.includes(owner), 'owner does not hide from other: post returned');

    assert.ok((await senders(owner)).includes(owner), 'owner still sees own post');
    // The list is one-way: the viewer's own posts still reach the owner.
    await postAt(viewer, 'viewer post', 3);
    assert.ok((await senders(owner)).includes(viewer), 'hiding is one-way: owner still sees viewer posts');

    // ── Fan-out for a new post skips the hidden viewer, reaches everyone else.
    const fan = new Set(
      await mapFeedService.nearbyUserIds(Number(ownerPost.lat), Number(ownerPost.lng), 5, owner),
    );
    assert.ok(!fan.has(viewer), 'owner post not pushed to the hidden viewer');
    assert.ok(fan.has(other) && fan.has(control) && fan.has(owner), 'owner post pushed to everyone else');
    const fanControl = new Set(await mapFeedService.nearbyUserIds(LAT, LNG, 5, control));
    assert.ok(fanControl.has(viewer), 'other posters still reach the viewer');

    // ── Paging: hidden posts are filtered before LIMIT, so they never use up the page.
    // Owner posts the newest 3; control has 2 older posts (control post above + one more).
    for (const m of [0, 0, 0]) await postAt(owner, 'owner newer', m);
    await postAt(control, 'control older', 4);
    const page = await senders(viewer, 2);
    assert.strictEqual(page.length, 2, 'page of 2 is full even though the 3 newest posts are hidden');
    assert.ok(!page.includes(owner), 'no hidden posts on the page');

    const page3 = await mapFeedService.listNearby(viewer, { radiusKm: 5, limit: 3 });
    assert.deepStrictEqual(
      page3.map((m) => m.sender_id),
      [control, viewer, control],
      'page of 3 is the 3 newest visible posts, newest first',
    );
    // A filter after LIMIT would have returned an empty first page here.
    const unfiltered = await query(
      `SELECT sender_id FROM map_feed_messages WHERE sender_id = ANY($1::uuid[]) ORDER BY created_at DESC, id DESC LIMIT 2`,
      [ids],
    );
    assert.ok(
      unfiltered.rows.every((r: { sender_id: string }) => r.sender_id === owner),
      'sanity: the 2 newest raw posts are the hidden owner',
    );
    assert.strictEqual((await senders(viewer, 0)).length, 3, 'limit 0 falls back to the default page (all 3 visible posts)');
    assert.ok((await senders(viewer, 10_000)).length <= MAP_FEED_LIMIT, 'limit is capped');

    // ── Removing the viewer from the list brings the posts back (read-time check).
    await unhide(owner, viewer);
    const after = await senders(viewer);
    assert.strictEqual(after.filter((s) => s === owner).length, 4, 'all 4 owner posts visible again');
    const fanAfter = new Set(
      await mapFeedService.nearbyUserIds(Number(ownerPost.lat), Number(ownerPost.lng), 5, owner),
    );
    assert.ok(fanAfter.has(viewer), 'unhidden: owner posts pushed to viewer again');

    console.log('map-feed-hide-location-integration: OK');
  } finally {
    if (ids.length) {
      await query(`DELETE FROM map_feed_messages WHERE sender_id = ANY($1::uuid[])`, [ids]);
      await query(
        `DELETE FROM location_hidden_from WHERE owner_id = ANY($1::uuid[]) OR hidden_user_id = ANY($1::uuid[])`,
        [ids],
      );
      await query(`DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error('map-feed-hide-location-integration: FAILED', err);
  process.exit(1);
});
