/**
 * All discovery: UK+Ireland boxes, bound params used in count and list.
 * Runs the real SQL (not a source-string match).
 * Run: npx ts-node scripts/uk-ie-all-scope-checks.ts
 */
import assert from 'assert';
import { isInUkIreland, UK_IRELAND_LOCATION_SQL } from '../src/lib/ukIrelandBounds';
import { buildUkIeNearbyQueries } from '../src/lib/nearbyRosterSql';
import pool, { query } from '../src/db';

assert.equal(isInUkIreland(53.4808, -2.2426), true, 'Manchester must be in All');
assert.equal(isInUkIreland(53.8008, -1.5491), true, 'Leeds must be in All');
assert.equal(isInUkIreland(52.4862, -1.8904), true, 'Birmingham must be in All');
assert.equal(isInUkIreland(51.5074, -0.1278), true, 'London must be in All');
assert.equal(isInUkIreland(53.3498, -6.2603), true, 'Dublin must be in All');
assert.equal(isInUkIreland(54.5973, -5.9301), true, 'Belfast must be in All');
assert.equal(isInUkIreland(50.0647, -5.7161), true, 'Land\'s End must be in All');
assert.equal(isInUkIreland(60.1545, -1.145), true, 'Lerwick must be in All');
assert.equal(isInUkIreland(51.1279, 1.3134), true, 'Dover must be in All');
assert.equal(isInUkIreland(52.4769, 1.7578), true, 'Lowestoft must be in All');
assert.equal(isInUkIreland(49.218, -2.127), true, 'Jersey must be in All');
assert.equal(isInUkIreland(40.7128, -74.006), false, 'New York must not be in All');
assert.equal(isInUkIreland(48.8566, 2.3522), false, 'Paris must not be in All');
assert.equal(isInUkIreland(49.6337, -1.6222), false, 'Cherbourg must not be in All');
assert.equal(isInUkIreland(49.1829, -0.3707), false, 'Caen must not be in All');
assert.equal(isInUkIreland(49.4432, 1.0993), false, 'Rouen must not be in All');
assert.equal(isInUkIreland(49.4944, 0.1079), false, 'Le Havre must not be in All');
assert.equal(isInUkIreland(49.9216, 1.0775), false, 'Dieppe must not be in All');
assert.equal(isInUkIreland(50.7259, 1.6138), false, 'Boulogne must not be in All');

assert.doesNotMatch(UK_IRELAND_LOCATION_SQL, /ST_DWithin/, 'UK+Ireland All must not use a radius');

async function runRealQueries() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required so uk_ie SQL actually executes');
  }

  const { countSql, listSql, values, listValues } = buildUkIeNearbyQueries();
  assert.equal(values.length, 4, 'uk_ie binds [lat, lng, userId, 0]');
  assert.equal(values[3], 0);
  assert.match(countSql, /\$1/);
  assert.match(countSql, /\$2/);
  assert.match(countSql, /\$3/);
  assert.match(countSql, /\$4/);
  assert.match(listSql, /\$4/);

  const countResult = await query(countSql, values);
  assert.ok(countResult.rows[0], 'count query must return a row');
  assert.equal(typeof countResult.rows[0].total, 'number');

  const listResult = await query(listSql, listValues);
  assert.ok(Array.isArray(listResult.rows), 'list query must run');
}

runRealQueries()
  .then(async () => {
    console.log('uk-ie-all-scope-checks: ok');
    await pool.end();
  })
  .catch(async (err) => {
    console.error(err);
    try {
      await pool.end();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
