/**
 * Community posts 24h expiry checks.
 * Verifies that:
 * 1. listNearby excludes posts older than 24h
 * 2. assertPostVisible excludes posts older than 24h, causing listComments / createComment to throw post_not_found
 * 3. Fresh posts within 24h are returned and accessible
 *
 * Can run offline via mocked db queries or against real DB.
 * Run: npx ts-node scripts/community-expiry-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

// 1. Static source assertions
function staticChecks() {
  const serviceSrc = fs.readFileSync(path.join(root, 'src/services/community.service.ts'), 'utf8');

  // assertPostVisible must contain 24 hours filter
  const assertFnMatch = serviceSrc.match(/async function assertPostVisible[\s\S]*?^}/m);
  assert.ok(assertFnMatch, 'assertPostVisible function must exist');
  assert.match(
    assertFnMatch[0],
    /cp\.created_at\s*>\s*NOW\(\)\s*-\s*INTERVAL\s*'24 hours'/,
    'assertPostVisible must enforce 24 hour expiry',
  );

  // listNearby query must contain 24 hours filter
  const listNearbyMatch = serviceSrc.match(/async listNearby[\s\S]*?^ {2}},/m);
  assert.ok(listNearbyMatch, 'listNearby method must exist');
  assert.match(
    listNearbyMatch[0],
    /cp\.created_at\s*>\s*NOW\(\)\s*-\s*INTERVAL\s*'24 hours'/,
    'listNearby must enforce 24 hour expiry',
  );

  console.log('PASS static code assertions for 24h community expiry');
}

// 2. Behavioral unit tests with query mocking
async function unitChecks() {
  const db = require('../src/db');
  const calls: { sql: string; params: any[] }[] = [];
  let nextRows: any[][] = [];

  const originalQuery = db.query;
  db.query = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    const rows = nextRows.shift() ?? [];
    return { rows, rowCount: rows.length };
  };

  try {
    const { communityService } = await import('../src/services/community.service');

    // Test listNearby SQL verification
    calls.length = 0;
    nextRows = [[]]; // empty result
    const posts = await communityService.listNearby({
      viewerId: 'viewer-1',
      lat: 51.5074,
      lng: -0.1278,
      radiusKm: 10,
    });
    assert.equal(posts.length, 0);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /cp\.created_at > NOW\(\) - INTERVAL '24 hours'/);

    // Test assertPostVisible in listComments:
    // If post is expired or not found, query returns 0 rows -> throws 'post_not_found'
    calls.length = 0;
    nextRows = [[]]; // post query returns no rows (expired or does not exist)
    await assert.rejects(
      async () => {
        await communityService.listComments('viewer-1', 'post-expired-id');
      },
      (err: any) => err.message === 'post_not_found',
      'listComments must throw post_not_found for expired post',
    );
    assert.match(calls[0].sql, /cp\.created_at > NOW\(\) - INTERVAL '24 hours'/);

    // Test assertPostVisible in createComment:
    calls.length = 0;
    nextRows = [[]]; // post query returns no rows (expired)
    await assert.rejects(
      async () => {
        await communityService.createComment('viewer-1', 'post-expired-id', 'Test reply');
      },
      (err: any) => err.message === 'post_not_found',
      'createComment must throw post_not_found for expired post',
    );
    assert.match(calls[0].sql, /cp\.created_at > NOW\(\) - INTERVAL '24 hours'/);

    // Test assertPostVisible when post is fresh (< 24h):
    calls.length = 0;
    nextRows = [
      [{ id: 'post-fresh-id', user_id: 'author-1' }], // assertPostVisible succeeds
      [], // comments query
    ];
    const comments = await communityService.listComments('viewer-1', 'post-fresh-id');
    assert.deepEqual(comments, []);
    assert.equal(calls.length, 2);

    console.log('PASS unit behavioural checks with query mocking');
  } finally {
    db.query = originalQuery;
  }
}

async function main() {
  staticChecks();
  await unitChecks();
  console.log('community-expiry-checks: ALL PASSED');
}

main().catch((err) => {
  console.error('FAIL community-expiry-checks:', err);
  process.exit(1);
});
