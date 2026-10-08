/**
 * Hot-spot live counts: Free viewers never receive the exact number (no DB required).
 * Free: 0 to 4 exact, then '5+', and live_count_exact is null.
 * Premium: exact live_count and live_count_exact.
 * Covers the shared serializer plus list, single and check-in responses.
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
// Stub DB: spot selects return fake rows; check-in lookups return a visible spot; writes no-op.
(db as unknown as { query: unknown }).query = async (text: string) => {
  if (text.includes('AS live_count_exact')) return { rows: spotRows, rowCount: spotRows.length };
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
  let list = await hotSpotsService.listNearby({ userId: 'u1', lat: 51.5, lng: -0.1 });
  list.forEach((s, i) => assertFree(s, EXACTS[i], FREE_EXPECTED[i], 'listNearby'));
  premium = true;
  list = await hotSpotsService.listNearby({ userId: 'u1', lat: 51.5, lng: -0.1, cruisingOnly: true });
  list.forEach((s, i) => assertPremium(s, EXACTS[i], 'listNearby'));
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

  console.log('hot-spot-free-counts-checks: ok');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
