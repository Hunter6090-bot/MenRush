/**
 * HTTP Integration Test for Community Mention Suggestions
 *
 * Verifies GET /api/community/mention-suggestions?q=:
 * 1. Returns public Hot Spots matching q
 * 2. Returns mutual matches matching q
 * 3. Does NOT return unmatched nearby users or random strangers
 * 4. Honors query param filtering and limits
 */
import assert from 'assert';
import http from 'http';
import express from 'express';
import { randomUUID } from 'crypto';
import communityRoutes from '../src/routes/community';
import pool, { query } from '../src/db';
import { authService } from '../src/services/auth.service';

async function run() {
  console.log('--- Starting Community Mention Suggestions HTTP Tests ---');

  const app = express();
  app.use(express.json());
  app.use('/api/community', communityRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server listening on port ${port}`);

  const userIdsToCleanup: string[] = [];
  const spotIdsToCleanup: string[] = [];

  try {
    // 1. Create 3 test users:
    // - User A (viewer)
    // - User B (mutual match with User A)
    // - User C (stranger / nearby non-match)
    const viewerId = randomUUID();
    const matchId = randomUUID();
    const strangerId = randomUUID();
    userIdsToCleanup.push(viewerId, matchId, strangerId);

    const viewerToken = authService.generateToken(viewerId);

    // Insert users
    await query(
      `INSERT INTO users (id, email, password_hash, name, age, is_verified, verification_provider)
       VALUES
       ($1, $2, 'hash', 'Viewer Guy', 28, TRUE, 'veriff'),
       ($3, $4, 'hash', 'Matched Buddy', 30, TRUE, 'veriff'),
       ($5, $6, 'hash', 'Nearby Stranger', 29, TRUE, 'veriff')`,
      [
        viewerId,
        `viewer-${Date.now()}@example.com`,
        matchId,
        `match-${Date.now()}@example.com`,
        strangerId,
        `stranger-${Date.now()}@example.com`,
      ],
    );

    // Insert profiles with location
    await query(
      `INSERT INTO profiles (user_id, lat, lng, location)
       VALUES
       ($1, 51.5074, -0.1278, ST_SetSRID(ST_MakePoint(-0.1278, 51.5074), 4326)::geography),
       ($2, 51.5080, -0.1280, ST_SetSRID(ST_MakePoint(-0.1280, 51.5080), 4326)::geography),
       ($3, 51.5076, -0.1279, ST_SetSRID(ST_MakePoint(-0.1279, 51.5076), 4326)::geography)`,
      [viewerId, matchId, strangerId],
    );

    // Mutual likes between viewer and match
    await query(
      `INSERT INTO likes (liker_id, liked_id)
       VALUES ($1, $2), ($2, $1)`,
      [viewerId, matchId],
    );

    // Stranger liked viewer, but viewer did NOT like stranger (one-way, NOT mutual match)
    await query(
      `INSERT INTO likes (liker_id, liked_id)
       VALUES ($1, $2)`,
      [strangerId, viewerId],
    );

    // 2. Insert test commercial hot spot
    const spotId = randomUUID();
    spotIdsToCleanup.push(spotId);
    // Find or pick category
    const catRes = await query(`SELECT id FROM hot_spot_categories WHERE is_commercial = TRUE LIMIT 1`);
    assert.ok(catRes.rows.length > 0, 'commercial category must exist');
    const categoryId = catRes.rows[0].id;

    await query(
      `INSERT INTO hot_spots (id, name, city, latitude, longitude, category_id, is_active, source, is_user_generated)
       VALUES ($1, 'Neon Lounge Commercial', 'London', 51.5100, -0.1300, $2, TRUE, 'ops-curated', FALSE)`,
      [spotId, categoryId],
    );

    // 3. Test: GET /api/community/mention-suggestions with empty query
    const resAll = await fetch(`${baseUrl}/api/community/mention-suggestions`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(resAll.status, 200, 'mention-suggestions must return 200');
    const dataAll = (await resAll.json()) as { suggestions: Array<{ id: string; name: string; type: string }> };

    assert.ok(Array.isArray(dataAll.suggestions), 'suggestions must be an array');
    const returnedIds = dataAll.suggestions.map((s) => s.id);

    // Must include match and hot spot
    assert.ok(returnedIds.includes(matchId), 'suggestions must include mutual match');
    assert.ok(returnedIds.includes(spotId), 'suggestions must include hot spot');

    // MUST NOT include stranger / one-way like
    assert.ok(!returnedIds.includes(strangerId), 'suggestions must NEVER include un-matched stranger');

    // 4. Test: GET /api/community/mention-suggestions?q=Buddy (filtering by match name)
    const resMatch = await fetch(`${baseUrl}/api/community/mention-suggestions?q=Buddy`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(resMatch.status, 200);
    const dataMatch = (await resMatch.json()) as { suggestions: Array<{ id: string; name: string; type: string }> };
    assert.ok(dataMatch.suggestions.some((s) => s.id === matchId && s.type === 'match'));
    assert.ok(!dataMatch.suggestions.some((s) => s.id === strangerId));

    // 5. Test: GET /api/community/mention-suggestions?q=Neon (filtering by hot spot name)
    const resSpot = await fetch(`${baseUrl}/api/community/mention-suggestions?q=Neon`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    assert.equal(resSpot.status, 200);
    const dataSpot = (await resSpot.json()) as { suggestions: Array<{ id: string; name: string; type: string }> };
    assert.ok(dataSpot.suggestions.some((s) => s.id === spotId && s.type === 'hot_spot'));
    assert.ok(!dataSpot.suggestions.some((s) => s.id === strangerId));

    // 6. Test: Unauthenticated request must be blocked (401)
    const resUnauth = await fetch(`${baseUrl}/api/community/mention-suggestions`);
    assert.equal(resUnauth.status, 401, 'unauthenticated mention request must be 401');

    console.log('✅ ALL Community Mention Suggestions HTTP Tests Passed!');
  } finally {
    // Cleanup
    if (spotIdsToCleanup.length > 0) {
      await query(`DELETE FROM hot_spots WHERE id = ANY($1)`, [spotIdsToCleanup]);
    }
    if (userIdsToCleanup.length > 0) {
      await query(`DELETE FROM likes WHERE liker_id = ANY($1) OR liked_id = ANY($1)`, [userIdsToCleanup]);
      await query(`DELETE FROM profiles WHERE user_id = ANY($1)`, [userIdsToCleanup]);
      await query(`DELETE FROM users WHERE id = ANY($1)`, [userIdsToCleanup]);
    }
    server.close();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
