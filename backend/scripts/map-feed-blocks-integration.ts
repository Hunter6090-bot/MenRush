/**
 * Integration: the live map feed leaves out blocked people in both directions,
 * and ghost / hidden members' posts (and their pins) are not shown to others.
 * Covers the GET list (mapFeedService.listNearby) and the socket fan-out
 * targets for a new post (mapFeedService.nearbyUserIds with the sender id).
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush123@localhost:5432/menrush \
 *   npx ts-node scripts/map-feed-blocks-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('map-feed-blocks-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { mapFeedService } = await import('../src/services/map-feed.service');

  const ids: string[] = [];
  async function makeUser(
    name: string,
    lat: number,
    lng: number,
    opts: { visible?: boolean; ghost?: boolean } = {},
  ) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [id, `mfb-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
       VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), $4, $5)`,
      [id, lat, lng, opts.visible ?? true, opts.ghost ?? false],
    );
    return id;
  }
  const block = (blocker: string, blocked: string) =>
    query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [blocker, blocked]);

  // Isolated spot so other local rows in the 5 km radius cannot interfere.
  const LAT = 58.9701;
  const LNG = -3.2954;
  const near = { lat: LAT, lng: LNG, radiusKm: 5 };

  try {
    const viewer = await makeUser('MFB Viewer', LAT, LNG);
    const blockedByViewer = await makeUser('MFB Blocked By Viewer', LAT + 0.001, LNG);
    const blockerOfViewer = await makeUser('MFB Blocked Viewer', LAT - 0.001, LNG);
    const control = await makeUser('MFB Control', LAT, LNG + 0.001);

    await block(viewer, blockedByViewer); // A blocked B
    await block(blockerOfViewer, viewer); // B blocked A

    const postA = await mapFeedService.post(viewer, 'viewer post');
    const postB1 = await mapFeedService.post(blockedByViewer, 'blocked-by-viewer post');
    const postB2 = await mapFeedService.post(blockerOfViewer, 'blocker-of-viewer post');
    const postC = await mapFeedService.post(control, 'control post');

    const senders = async (uid: string) =>
      new Set((await mapFeedService.listNearby(uid, near)).map((m) => m.sender_id));

    // ── GET list ────────────────────────────────────────────────────────────
    const viewerFeed = await senders(viewer);
    assert.ok(!viewerFeed.has(blockedByViewer), 'A blocked B: B posts hidden from A');
    assert.ok(!viewerFeed.has(blockerOfViewer), 'B blocked A: B posts hidden from A');
    assert.ok(viewerFeed.has(control), 'unblocked control still appears for A');
    assert.ok(viewerFeed.has(viewer), 'A still sees own post');

    const b1Feed = await senders(blockedByViewer);
    assert.ok(!b1Feed.has(viewer), 'A blocked B: A posts hidden from B');
    assert.ok(b1Feed.has(control), 'control still appears for B');

    const b2Feed = await senders(blockerOfViewer);
    assert.ok(!b2Feed.has(viewer), 'B blocked A: A posts hidden from B');
    assert.ok(b2Feed.has(control), 'control still appears for B');

    const controlFeed = await senders(control);
    for (const uid of [viewer, blockedByViewer, blockerOfViewer]) {
      assert.ok(controlFeed.has(uid), 'blocks between others do not affect the control');
    }

    // Fallback path (no coords passed: uses the caller's stored location).
    const viewerFeedStored = new Set(
      (await mapFeedService.listNearby(viewer)).map((m) => m.sender_id),
    );
    assert.ok(!viewerFeedStored.has(blockedByViewer) && !viewerFeedStored.has(blockerOfViewer));
    assert.ok(viewerFeedStored.has(control));

    // ── Socket fan-out targets for a new post ───────────────────────────────
    const fanA = new Set(await mapFeedService.nearbyUserIds(Number(postA.lat), Number(postA.lng), 5, viewer));
    assert.ok(!fanA.has(blockedByViewer), 'A blocked B: A post not pushed to B');
    assert.ok(!fanA.has(blockerOfViewer), 'B blocked A: A post not pushed to B');
    assert.ok(fanA.has(control), 'A post still pushed to control');
    assert.ok(fanA.has(viewer), 'poster still gets own post');

    const fanB1 = new Set(await mapFeedService.nearbyUserIds(Number(postB1.lat), Number(postB1.lng), 5, blockedByViewer));
    assert.ok(!fanB1.has(viewer), 'A blocked B: B post not pushed to A');
    assert.ok(fanB1.has(control));

    const fanB2 = new Set(await mapFeedService.nearbyUserIds(Number(postB2.lat), Number(postB2.lng), 5, blockerOfViewer));
    assert.ok(!fanB2.has(viewer), 'B blocked A: B post not pushed to A');
    assert.ok(fanB2.has(control));

    const fanC = new Set(await mapFeedService.nearbyUserIds(Number(postC.lat), Number(postC.lng), 5, control));
    for (const uid of [viewer, blockedByViewer, blockerOfViewer, control]) {
      assert.ok(fanC.has(uid), 'control post reaches everyone nearby');
    }

    // ── Ghost / hidden members ──────────────────────────────────────────────
    const ghost = await makeUser('MFB Ghost', LAT + 0.002, LNG, { ghost: true });
    const hidden = await makeUser('MFB Hidden', LAT - 0.002, LNG, { visible: false });
    const postG = await mapFeedService.post(ghost, 'ghost post');
    const postH = await mapFeedService.post(hidden, 'hidden post');

    for (const uid of [viewer, control]) {
      const feed = await senders(uid);
      assert.ok(!feed.has(ghost), 'ghost post (and pin) hidden from others');
      assert.ok(!feed.has(hidden), 'hidden member post (and pin) hidden from others');
      assert.ok(feed.has(control), 'control still appears next to ghost / hidden');
    }
    assert.ok((await senders(ghost)).has(ghost), 'ghost still sees own post');
    assert.ok((await senders(hidden)).has(hidden), 'hidden member still sees own post');
    assert.ok((await senders(ghost)).has(control), 'ghost can still read the feed');

    const fanG = await mapFeedService.nearbyUserIds(Number(postG.lat), Number(postG.lng), 5, ghost);
    assert.deepStrictEqual(fanG, [ghost], 'ghost post is pushed to the ghost only');
    const fanH = await mapFeedService.nearbyUserIds(Number(postH.lat), Number(postH.lng), 5, hidden);
    assert.deepStrictEqual(fanH, [hidden], 'hidden member post is pushed to them only');
    // Ghost / hidden members still receive other people's posts.
    const fanC2 = await mapFeedService.nearbyUserIds(LAT, LNG, 5, control);
    assert.ok(fanC2.includes(ghost) && fanC2.includes(hidden), 'ghost / hidden still get pushes');

    // Read-time check: turning Ghost off brings the posts back.
    await query(`UPDATE profiles SET is_ghost = FALSE WHERE user_id = $1`, [ghost]);
    assert.ok((await senders(viewer)).has(ghost), 'ghost off: post visible again');
    await query(`UPDATE profiles SET is_ghost = TRUE WHERE user_id = $1`, [ghost]);
    assert.ok(!(await senders(viewer)).has(ghost), 'ghost on again: hidden again');

    // Without a sender id the helper keeps its old behaviour (no block filter).
    const fanAll = new Set(await mapFeedService.nearbyUserIds(LAT, LNG, 5));
    for (const uid of ids) assert.ok(fanAll.has(uid));

    console.log('map-feed-blocks-integration: OK');
  } finally {
    if (ids.length) {
      await query(`DELETE FROM map_feed_messages WHERE sender_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM blocks WHERE blocker_id = ANY($1::uuid[]) OR blocked_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [ids]);
      await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error('map-feed-blocks-integration: FAILED', err);
  process.exit(1);
});
