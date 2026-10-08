/**
 * Hot-spot live counts: Free viewers never receive the exact number (no DB required).
 * Free: 0 to 4 exact, then '5+', and live_count_exact is null.
 * Premium: exact live_count and live_count_exact.
 * Covers the shared serializer plus list, single and check-in responses.
 * Live sort: Free sorts on the rounded bucket, then distance, then id; Premium on exact.
 * Run: npm run test:hot-spot-free-counts
 */
import assert from 'assert';
import * as db from '../src/db';
import { premiumService } from '../src/services/premium.service';
import {
  formatLiveCount,
  hotSpotsService,
  mapSpotRow,
} from '../src/services/hot-spots.service';

const EXACTS = [0, 1, 4, 5, 6, 12];
const FREE_EXPECTED: Array<number | string> = [0, 1, 4, '5+', '5+', '5+'];

function fakeRow(exact: number, i: number): Record<string, unknown> {
  return {
    id: `spot-${i}`,
    name: `Spot ${i}`,
    city: null,
    description: null,
    latitude: 51.5,
    longitude: -0.1,
    category_id: 1,
    category_slug: 'saunas',
    category_name: 'Saunas',
    category_icon: 'S',
    distance_km: 1,
    live_count_exact: exact,
    is_checked_in: false,
    my_checkin_anonymous: null,
    rating_avg: null,
    review_count: 0,
  };
}

let spotRows: Record<string, unknown>[] = [];
let lastSpotSql = '';
// Stub DB: spot selects return fake rows; check-in lookups return a visible spot; writes no-op.
(db as unknown as { query: unknown }).query = async (text: string) => {
  if (text.includes('AS live_count_exact')) {
    lastSpotSql = text;
    return { rows: spotRows, rowCount: spotRows.length };
  }
  if (text.includes('c.slug AS category_slug')) {
    return { rows: [{ id: 'spot-0', category_slug: 'saunas' }], rowCount: 1 };
  }
  return { rows: [], rowCount: 0 };
};

let premium = false;
(premiumService as unknown as { isPremium: unknown }).isPremium = async () => premium;

function assertFree(spot: { live_count: unknown; live_count_exact: unknown; has_active_checkins: boolean }, exact: number, expected: number | string, where: string) {
  assert.strictEqual(spot.live_count_exact, null, `${where}: Free must not receive live_count_exact (exact ${exact})`);
  assert.strictEqual(spot.live_count, expected, `${where}: Free live_count for exact ${exact}`);
  assert.strictEqual(spot.has_active_checkins, exact > 0, `${where}: has_active_checkins for exact ${exact}`);
  const json = JSON.stringify(spot);
  if (exact >= 5) {
    assert.ok(!json.includes(`"live_count":${exact}`), `${where}: exact ${exact} leaked in live_count`);
    assert.ok(!json.includes(`"live_count_exact":${exact}`), `${where}: exact ${exact} leaked in live_count_exact`);
  }
}

function assertPremium(spot: { live_count: unknown; live_count_exact: unknown }, exact: number, where: string) {
  assert.strictEqual(spot.live_count, exact, `${where}: Premium live_count must be exact`);
  assert.strictEqual(spot.live_count_exact, exact, `${where}: Premium live_count_exact must be exact`);
}

async function main() {
  // formatLiveCount
  EXACTS.forEach((exact, i) => {
    assert.strictEqual(formatLiveCount(exact, false), FREE_EXPECTED[i]);
    assert.strictEqual(formatLiveCount(exact, true), exact);
  });
  console.log('✓ formatLiveCount: Free 0 to 4 exact then 5+, Premium exact');

  // Serializer
  EXACTS.forEach((exact, i) => {
    assertFree(mapSpotRow(fakeRow(exact, i), false, 'u1'), exact, FREE_EXPECTED[i], 'mapSpotRow');
    assertPremium(mapSpotRow(fakeRow(exact, i), true, 'u1'), exact, 'mapSpotRow');
  });
  console.log('✓ mapSpotRow: live_count_exact null for Free, exact for Premium');

  // List (Discover map, Hot Spots page, cruising search)
  spotRows = EXACTS.map(fakeRow);
  premium = false;
  // Live sort reorders rows, so match each spot back to its fake row by id.
  const rowIndex = (id: string) => Number(id.replace('spot-', ''));
  let list = await hotSpotsService.listNearby({ userId: 'u1', lat: 51.5, lng: -0.1 });
  assert.strictEqual(list.length, EXACTS.length);
  list.forEach((s) => assertFree(s, EXACTS[rowIndex(s.id)], FREE_EXPECTED[rowIndex(s.id)], 'listNearby'));
  premium = true;
  list = await hotSpotsService.listNearby({ userId: 'u1', lat: 51.5, lng: -0.1, cruisingOnly: true });
  assert.strictEqual(list.length, EXACTS.length);
  list.forEach((s) => assertPremium(s, EXACTS[rowIndex(s.id)], 'listNearby'));
  console.log('✓ listNearby: Free rounded with no exact, Premium exact');

  // Single spot (sheet) and check-in response (also used by event check-in, reviews)
  for (const [i, exact] of EXACTS.entries()) {
    spotRows = [fakeRow(exact, i)];
    premium = false;
    assertFree((await hotSpotsService.getSpot('u1', `spot-${i}`))!, exact, FREE_EXPECTED[i], 'getSpot');
    assertFree((await hotSpotsService.checkIn('u1', `spot-${i}`, true))!, exact, FREE_EXPECTED[i], 'checkIn');
    premium = true;
    assertPremium((await hotSpotsService.getSpot('u1', `spot-${i}`))!, exact, 'getSpot');
    assertPremium((await hotSpotsService.checkIn('u1', `spot-${i}`, false))!, exact, 'checkIn');
  }
  console.log('✓ getSpot and checkIn: Free rounded with no exact, Premium exact');

  // Live sort: two 5+ spots with different exact counts.
  // far9 has more people but is further away; near6 is closer.
  const sortRow = (id: string, exact: number, km: number | null) => ({ ...fakeRow(exact, 0), id, name: id, distance_km: km });
  const far9 = sortRow('spot-far9', 9, 3);
  const near6 = sortRow('spot-near6', 6, 1);
  const tieB = sortRow('spot-tie-b', 7, 2);
  const tieA = sortRow('spot-tie-a', 5, 2);
  const few = sortRow('spot-few', 2, 0.5);
  const noDist = sortRow('spot-nodist', 8, null);
  const ids = (spots: { id: string }[]) => spots.map((s) => s.id);
  const freeSorted = ['spot-near6', 'spot-tie-a', 'spot-tie-b', 'spot-far9', 'spot-nodist', 'spot-few'];

  spotRows = [few, far9, noDist, tieB, near6, tieA];
  premium = false;
  list = await hotSpotsService.listNearby({ userId: 'u1', lat: 51.5, lng: -0.1, sortBy: 'live' });
  assert.deepStrictEqual(ids(list), freeSorted, 'Free live sort: 5+ bucket ties sort by distance, then id');
  list.forEach((s) => assert.strictEqual(s.live_count_exact, null, 'Free live sort must not carry live_count_exact'));
  assert.ok(lastSpotSql.includes('ORDER BY LEAST(live_count_exact, 5) DESC, distance_km ASC NULLS LAST, hs.id ASC'), 'Free SQL sorts on the rounded bucket');
  assert.ok(!lastSpotSql.includes('ORDER BY live_count_exact DESC'), 'Free SQL must not sort on the exact count');
  assert.ok(lastSpotSql.indexOf('ORDER BY') < lastSpotSql.lastIndexOf('LIMIT'), 'ORDER BY runs before LIMIT so the page is picked on the rounded sort');

  // Same spots with exact counts above 4 shuffled: Free order must not change.
  spotRows = [
    { ...few },
    { ...far9, live_count_exact: 5 },
    { ...noDist, live_count_exact: 30 },
    { ...tieB, live_count_exact: 5 },
    { ...near6, live_count_exact: 40 },
    { ...tieA, live_count_exact: 11 },
  ];
  list = await hotSpotsService.listNearby({ userId: 'u1', lat: 51.5, lng: -0.1, sortBy: 'live' });
  assert.deepStrictEqual(ids(list), freeSorted, 'Free live sort must not change when exact counts above 4 change');

  spotRows = [few, far9, noDist, tieB, near6, tieA];
  premium = true;
  list = await hotSpotsService.listNearby({ userId: 'u1', lat: 51.5, lng: -0.1, sortBy: 'live' });
  assert.deepStrictEqual(
    ids(list),
    ['spot-far9', 'spot-nodist', 'spot-tie-b', 'spot-near6', 'spot-tie-a', 'spot-few'],
    'Premium live sort: exact count first',
  );
  assert.ok(lastSpotSql.includes('ORDER BY live_count_exact DESC, distance_km ASC NULLS LAST, hs.name ASC'), 'Premium SQL keeps the exact sort');

  // Closest sort is unchanged (distance only) for both.
  spotRows = [near6, far9];
  for (const p of [false, true]) {
    premium = p;
    list = await hotSpotsService.listNearby({ userId: 'u1', lat: 51.5, lng: -0.1, sortBy: 'closest' });
    assert.deepStrictEqual(ids(list), ['spot-near6', 'spot-far9'], 'closest keeps SQL order');
    assert.ok(lastSpotSql.includes('ORDER BY distance_km ASC NULLS LAST, hs.name ASC'), 'closest SQL unchanged');
  }
  console.log('✓ live sort: Free 5+ ties by distance then id, Premium by exact count');

  console.log('hot-spot-free-counts-checks: ok');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
