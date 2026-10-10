/**
 * Integration: members delete their own map feed and Community posts (any age)
 * over HTTP against real Postgres/PostGIS. The coordinates go with the row.
 * Needs a migrated DATABASE_URL (schema.sql + migrations). Skips without one.
 *   DATABASE_URL=postgresql://menrush:menrush@localhost:5432/menrush_ci \
 *   npx ts-node scripts/delete-own-posts-integration.ts
 */
import assert from 'assert';
import http from 'http';
import { randomUUID } from 'crypto';

if (!process.env.DATABASE_URL) {
  console.log('delete-own-posts-integration: SKIPPED (no DATABASE_URL)');
  process.exit(0);
}
process.env.JWT_SECRET ||= 'delete-own-posts-integration-secret';

async function main() {
  const { default: express } = await import('express');
  const { default: pool, query } = await import('../src/db');
  const { authService } = await import('../src/services/auth.service');
  const { default: mapFeedRoutes } = await import('../src/routes/map-feed');
  const { default: communityRoutes } = await import('../src/routes/community');

  // Fake socket.io: records every room emit so fan-out can be asserted.
  const emits: Array<{ room: string; event: string; payload: { id?: string } }> = [];
  const fakeIo = {
    to: (room: string) => ({
      emit: (event: string, payload: { id?: string }) => {
        emits.push({ room, event, payload });
      },
    }),
  };
  const deletedFor = (room: string) =>
    emits.filter((e) => e.room === room && e.event === 'map:feed:deleted').map((e) => e.payload.id);

  const app = express();
  app.set('io', fakeIo);
  app.use(express.json());
  app.use('/api/map-feed', mapFeedRoutes);
  app.use('/api/community', communityRoutes);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const ids: string[] = [];
  async function makeUser(name: string) {
    const id = randomUUID();
    ids.push(id);
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_status,
                          verification_provider, photo_url)
       VALUES ($1, $2, 'x', $3, 30, TRUE, 'verified', 'veriff', '/uploads/test.jpg')`,
      [id, `dop-${id.slice(0, 8)}@test.menrush.local`, name],
    );
    await query(
      `INSERT INTO profiles (user_id, location, lat, lng, online, last_seen, is_visible, is_ghost)
       VALUES ($1, ST_MakePoint(-0.1278, 51.5074)::geography, 51.5074, -0.1278, TRUE, NOW(), TRUE, FALSE)`,
      [id],
    );
    return { id, token: authService.issueAccessToken(id) };
  }
  async function call(method: string, path: string, token?: string) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, cache: res.headers.get('cache-control'), body: (await res.json().catch(() => null)) as { deleted?: number; count?: number } | null };
  }
  async function mapPost(owner: string, ageHours = 0) {
    const id = randomUUID();
    await query(
      `INSERT INTO map_feed_messages (id, sender_id, message, location, lat, lng, created_at)
       VALUES ($1, $2, 'hello', ST_MakePoint(-0.1278, 51.5074)::geography, 51.5074, -0.1278,
               NOW() - make_interval(hours => $3::int))`,
      [id, owner, ageHours],
    );
    return id;
  }
  async function communityPost(owner: string, ageHours = 0) {
    const res = await query(
      `INSERT INTO community_posts (user_id, body, lat, lng, location, created_at)
       VALUES ($1, 'hi', 51.5074, -0.1278, ST_MakePoint(-0.1278, 51.5074)::geography,
               NOW() - make_interval(hours => $2::int))
       RETURNING id`,
      [owner, ageHours],
    );
    return res.rows[0].id as string;
  }
  const mapCoords = async (id: string) =>
    (await query(`SELECT lat, lng, location FROM map_feed_messages WHERE id = $1`, [id])).rows;
  const communityCoords = async (id: string) =>
    (await query(`SELECT lat, lng, location FROM community_posts WHERE id = $1`, [id])).rows;

  try {
    const owner = await makeUser('DOP Owner');
    const other = await makeUser('DOP Other');

    // ── 401 still carries private, no-store (privateNoStore before auth) ──
    const anon = await call('DELETE', `/api/map-feed/${randomUUID()}`);
    assert.equal(anon.status, 401);
    assert.equal(anon.cache, 'private, no-store', 'map-feed 401 has Cache-Control');
    const anonC = await call('DELETE', `/api/community/posts/${randomUUID()}`);
    assert.equal(anonC.status, 401);
    assert.equal(anonC.cache, 'private, no-store', 'community 401 has Cache-Control');

    // ── Map feed: old post (well past the 15 min feed window) ──
    const m1 = await mapPost(owner.id, 72);
    let r = await call('DELETE', `/api/map-feed/${m1}`, other.token);
    assert.equal(r.status, 404, 'non-owner cannot delete a map post');
    assert.equal((await mapCoords(m1)).length, 1, 'map post untouched by non-owner');
    r = await call('DELETE', `/api/map-feed/${m1}`, owner.token);
    assert.equal(r.status, 200, 'owner deletes own 3-day-old map post');
    assert.equal(r.cache, 'private, no-store');
    assert.equal((await mapCoords(m1)).length, 0, 'map post row and coordinates gone');
    assert.deepEqual(deletedFor(`user:${other.id}`), [m1], 'single delete: nearby member told to drop it');
    assert.deepEqual(deletedFor(`user:${owner.id}`), [m1], 'single delete: author told too');
    assert.ok(
      emits.every((e) => Object.keys(e.payload).join() === 'id'),
      'only the id goes out (no coordinates or sender)',
    );
    r = await call('DELETE', `/api/map-feed/${m1}`, owner.token);
    assert.equal(r.status, 404, 'second delete is 404');
    r = await call('DELETE', `/api/map-feed/not-a-uuid`, owner.token);
    assert.equal(r.status, 400);

    // ── Community: old post (past the 24h feed window), with a comment ──
    const c1 = await communityPost(owner.id, 48);
    await query(`INSERT INTO community_post_comments (post_id, user_id, body) VALUES ($1, $2, 'c')`, [c1, other.id]);
    r = await call('DELETE', `/api/community/posts/${c1}`, other.token);
    assert.ok(r.status === 403 || r.status === 404, `non-owner gets 403/404, got ${r.status}`);
    assert.equal((await communityCoords(c1)).length, 1, 'community post untouched by non-owner');
    r = await call('DELETE', `/api/community/posts/${c1}`, owner.token);
    assert.equal(r.status, 200, 'owner deletes own 2-day-old community post');
    assert.equal((await communityCoords(c1)).length, 0, 'community post row and coordinates gone');
    const orphan = await query(`SELECT 1 FROM community_post_comments WHERE post_id = $1`, [c1]);
    assert.equal(orphan.rows.length, 0, 'comments go with the post');

    // ── Delete all mine: only the caller's posts, any age ──
    const mine = [await mapPost(owner.id), await mapPost(owner.id, 500)];
    const theirs = await mapPost(other.id);
    const cMine = [await communityPost(owner.id), await communityPost(owner.id, 500)];
    const cTheirs = await communityPost(other.id);
    // Counts for the Settings confirm: only the caller's posts, any age.
    r = await call('GET', `/api/map-feed/mine/count`, owner.token);
    assert.equal(r.status, 200);
    assert.equal((r.body as { count?: number } | null)?.count, 2, 'map count = own posts only');
    r = await call('GET', `/api/community/posts/mine/count`, owner.token);
    assert.equal((r.body as { count?: number } | null)?.count, 2, 'community count = own posts only');
    assert.equal(r.cache, 'private, no-store');

    emits.length = 0;
    r = await call('DELETE', `/api/map-feed/mine`, owner.token);
    assert.equal(r.status, 200);
    assert.equal(r.body?.deleted, 2);
    // Bulk delete emits map:feed:deleted for EACH removed post, like a single delete.
    assert.deepEqual(
      [...deletedFor(`user:${other.id}`)].sort(),
      [...mine].sort(),
      'bulk delete: nearby member told to drop every removed post',
    );
    assert.deepEqual([...deletedFor(`user:${owner.id}`)].sort(), [...mine].sort(), 'bulk delete: author told too');
    assert.ok(!emits.some((e) => e.payload.id === theirs), "other member's post not announced");
    r = await call('DELETE', `/api/community/posts/mine`, owner.token);
    assert.equal(r.status, 200);
    assert.equal(r.body?.deleted, 2);
    for (const id of mine) assert.equal((await mapCoords(id)).length, 0);
    for (const id of cMine) assert.equal((await communityCoords(id)).length, 0);
    assert.equal((await mapCoords(theirs)).length, 1, "other member's map post kept");
    assert.equal((await communityCoords(cTheirs)).length, 1, "other member's community post kept");

    console.log('delete-own-posts-integration: OK');
  } finally {
    await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [ids]);
    server.close();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
