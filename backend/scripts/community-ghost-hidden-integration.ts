/**
 * Integration: Ghost and hidden (is_visible = false) members' Community posts
 * are not shown to others. The author still sees their own posts. Blocks keep
 * working. Covers listNearby, the post-level gate, and comments by Ghost /
 * hidden members (left out of listComments and the comment count).
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
    // Comments on a visible post, made before their authors go Ghost / hidden.
    const ghostComment = await communityService.createComment(ghost, controlPost.id, 'cgh ghost comment');
    const hiddenComment = await communityService.createComment(hidden, controlPost.id, 'cgh hidden comment');
    const viewerComment = await communityService.createComment(viewer, controlPost.id, 'cgh viewer comment');
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

    // Comments by Ghost / hidden members are left out for others.
    const commentIds = async (uid: string, postId: string) =>
      new Set((await communityService.listComments(uid, postId)).map((c) => c.id));
    const viewerComments = await commentIds(viewer, controlPost.id);
    assert.ok(viewerComments.has(viewerComment.id), 'own comment visible');
    assert.ok(!viewerComments.has(ghostComment.id), 'Ghost commenter: comment hidden from others');
    assert.ok(!viewerComments.has(hiddenComment.id), 'hidden commenter: comment hidden from others');
    // Commenters still see their own comments.
    assert.ok((await commentIds(ghost, controlPost.id)).has(ghostComment.id), 'Ghost commenter sees own comment');
    assert.ok((await commentIds(hidden, controlPost.id)).has(hiddenComment.id), 'hidden commenter sees own comment');
    // The count on the post matches what the viewer can open.
    const countFor = async (uid: string, postId: string) =>
      (await communityService.listNearby({ viewerId: uid, lat: LAT, lng: LNG, radiusKm: 5 })).find((p) => p.id === postId)
        ?.comment_count;
    assert.strictEqual(await countFor(viewer, controlPost.id), 1, 'comment count leaves out Ghost / hidden comments');
    assert.strictEqual(await countFor(ghost, controlPost.id), 2, 'Ghost commenter counts own comment');

    // Back to visible: post and comment show again (nothing was deleted).
    await setProfile(ghost, true, false);
    assert.ok((await feedFor(viewer)).has(ghostPost.id), 'post shows again when Ghost is off');
    assert.ok((await commentIds(viewer, controlPost.id)).has(ghostComment.id), 'comment shows again when Ghost is off');
    assert.strictEqual(await countFor(viewer, controlPost.id), 2, 'count includes comment again when Ghost is off');

    // Blocks apply to comments too.
    await query(`INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [ghost, viewer]);
    assert.ok(!(await commentIds(viewer, controlPost.id)).has(ghostComment.id), 'block hides comments');
    assert.strictEqual(await countFor(viewer, controlPost.id), 1, 'comment count leaves out blocked comments');

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
