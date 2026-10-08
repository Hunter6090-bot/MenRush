/**
 * Integration: Ghost and hidden (is_visible = false) members' Community posts
 * are not shown to others. The author still sees their own posts. Blocks keep
 * working. Covers listNearby and the post-level gate (comments).
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush123@localhost:5432/menrush \
 *   npx ts-node scripts/community-ghost-hidden-integration.ts
 */
import assert from 'assert';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('community-ghost-hidden-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}

async function main() {
  const { default: pool, query } = await import('../src/db');
  const { communityService } = await import('../src/services/community.service');

  const ids: string[] = [];
  async function makeUser(name: string, lat: number, lng: number) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status, photo_url)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', '/uploads/test.jpg')`,
      [id, `cgh-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
       VALUES ($1, ST_MakePoint($3, $2)::geography, $2, $3, TRUE, NOW(), TRUE, FALSE)`,
      [id, lat, lng],
    );
    return id;
  }
  const setProfile = (id: string, visible: boolean, ghost: boolean) =>
    query(`UPDATE profiles SET is_visible = $2, is_ghost = $3 WHERE user_id = $1`, [id, visible, ghost]);

  // Isolated spot so other local rows in the radius cannot interfere.
  const LAT = 58.9801;
  const LNG = -3.3054;

  try {
    const viewer = await makeUser('CGH Viewer', LAT, LNG);
    const ghost = await makeUser('CGH Ghost', LAT + 0.001, LNG);
    const hidden = await makeUser('CGH Hidden', LAT - 0.001, LNG);
    const control = await makeUser('CGH Control', LAT, LNG + 0.001);

    // Posts are made while visible, then the authors go Ghost / hidden.
    const ghostPost = await communityService.create(ghost, 'cgh ghost post');
    const hiddenPost = await communityService.create(hidden, 'cgh hidden post');
    const controlPost = await communityService.create(control, 'cgh control post');
    const comment = await communityService.createComment(viewer, ghostPost.id, 'cgh comment');
    await setProfile(ghost, true, true);
    await setProfile(hidden, false, false);

    const feedFor = async (uid: string) =>
      new Set(
        (await communityService.listNearby({ viewerId: uid, lat: LAT, lng: LNG, radiusKm: 5 })).map((p) => p.id),
      );

    const viewerFeed = await feedFor(viewer);
    assert.ok(viewerFeed.has(controlPost.id), 'control post visible');
    assert.ok(!viewerFeed.has(ghostPost.id), 'Ghost author: post hidden from others');
    assert.ok(!viewerFeed.has(hiddenPost.id), 'hidden author: post hidden from others');

    // Authors still see their own posts.
    assert.ok((await feedFor(ghost)).has(ghostPost.id), 'Ghost author sees own post');
    assert.ok((await feedFor(hidden)).has(hiddenPost.id), 'hidden author sees own post');

    // Post-level gate: others cannot open or comment on a Ghost author's post.
    await assert.rejects(() => communityService.listComments(viewer, ghostPost.id), /post_not_found/);
    await assert.rejects(() => communityService.createComment(viewer, ghostPost.id, 'x'), /post_not_found/);
    await assert.rejects(() => communityService.listComments(viewer, hiddenPost.id), /post_not_found/);
    assert.ok((await communityService.listComments(ghost, ghostPost.id)).length >= 1, 'author still opens own post');
    // A commenter can still edit and delete what they wrote.
    await communityService.updateComment(viewer, ghostPost.id, comment.id, 'cgh comment edited');
    await communityService.deleteComment(viewer, ghostPost.id, comment.id);

    // Back to visible: post shows again (nothing was deleted).
    await setProfile(ghost, true, false);
    assert.ok((await feedFor(viewer)).has(ghostPost.id), 'post shows again when Ghost is off');

    // Blocks still apply on top.
    await query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [control, viewer]);
    assert.ok(!(await feedFor(viewer)).has(controlPost.id), 'block still hides posts');

    console.log('community-ghost-hidden-integration: OK');
  } finally {
    await query(`DELETE FROM blocks WHERE blocker_id = ANY($1::uuid[]) OR blocked_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM community_post_comments WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM community_posts WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM profiles WHERE user_id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]).catch(() => undefined);
    await pool.end();
  }
}

main().catch((err) => {
  console.error('community-ghost-hidden-integration: FAILED', err);
  process.exit(1);
});
