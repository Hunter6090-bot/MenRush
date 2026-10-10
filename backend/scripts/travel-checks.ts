/**
 * Travel: pure checks (no database). Dates, coarse centre, trip status, and the
 * SQL that keeps a member in one place and visitors at the city centre only.
 *   npx ts-node scripts/travel-checks.ts
 */
import assert from 'assert';
import {
  TRAVEL_MAX_LEAD_DAYS,
  TRAVEL_MAX_TRIP_DAYS,
  TravelError,
  coarseCityCentre,
  isTripLive,
  shortCityName,
  tripStatus,
  ukToday,
  validateTripDates,
  visitingLabel,
} from '../src/lib/travel';
import {
  nearbyRosterWhereSql,
  nearbyVisitorsListSql,
} from '../src/lib/nearbyRosterSql';
import { travelVisitorRow } from '../src/services/user.service';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

const now = new Date('2026-10-10T09:30:00Z'); // 10:30 in London
const addDays = (iso: string, d: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
const today = ukToday(now);

check('UK today', () => assert.strictEqual(today, '2026-10-10'));
check('UK today just after midnight BST is the new day', () =>
  assert.strictEqual(ukToday(new Date('2026-10-10T23:30:00Z')), '2026-10-11'));

check('trip can start today and last up to the max', () => {
  const r = validateTripDates(today, addDays(today, TRAVEL_MAX_TRIP_DAYS - 1), now);
  assert.strictEqual(r.days, TRAVEL_MAX_TRIP_DAYS);
});
check(`trip can start up to ${TRAVEL_MAX_LEAD_DAYS} days ahead`, () => {
  validateTripDates(addDays(today, TRAVEL_MAX_LEAD_DAYS), addDays(today, TRAVEL_MAX_LEAD_DAYS), now);
});
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof TravelError);
    return (e as TravelError).code;
  }
  return 'none';
};
check('start too far ahead is refused', () =>
  assert.strictEqual(code(() => validateTripDates(addDays(today, TRAVEL_MAX_LEAD_DAYS + 1), addDays(today, 9), now)), 'starts_too_late'));
check('trip longer than the max is refused', () =>
  assert.strictEqual(code(() => validateTripDates(today, addDays(today, TRAVEL_MAX_TRIP_DAYS), now)), 'trip_too_long'));
check('start in the past is refused', () =>
  assert.strictEqual(code(() => validateTripDates(addDays(today, -1), today, now)), 'starts_in_past'));
check('end before start is refused', () =>
  assert.strictEqual(code(() => validateTripDates(addDays(today, 2), addDays(today, 1), now)), 'invalid_dates'));
check('bad date strings are refused', () => {
  assert.strictEqual(code(() => validateTripDates('2026-02-31', '2026-03-01', now)), 'invalid_dates');
  assert.strictEqual(code(() => validateTripDates(undefined, today, now)), 'invalid_dates');
  assert.strictEqual(code(() => validateTripDates('10/10/2026', today, now)), 'invalid_dates');
});

check('coarse centre is the bbox middle at 2 decimal places', () => {
  const c = coarseCityCentre({ south: 53.3401, north: 53.5445, west: -2.3199, east: -2.1468 });
  assert.deepStrictEqual(c, { lat: 53.44, lng: -2.23 });
  assert.ok(String(c.lat).split('.')[1]!.length <= 2);
});
check('short city name and visiting label', () => {
  assert.strictEqual(shortCityName('Manchester, Greater Manchester, England, United Kingdom'), 'Manchester');
  assert.strictEqual(visitingLabel('Manchester'), 'Visiting Manchester');
});

check('trip status: planned, live, over, ended', () => {
  const t = { starts_at: '2026-10-11T00:00:00Z', ends_at: '2026-10-13T00:00:00Z' };
  assert.strictEqual(tripStatus(t, Date.parse('2026-10-10T12:00:00Z')), 'planned');
  assert.strictEqual(tripStatus(t, Date.parse('2026-10-12T12:00:00Z')), 'live');
  assert.strictEqual(tripStatus(t, Date.parse('2026-10-13T00:00:00Z')), 'over');
  assert.strictEqual(tripStatus({ ...t, ended_at: '2026-10-12T01:00:00Z' }, Date.parse('2026-10-12T12:00:00Z')), 'over');
  assert.strictEqual(isTripLive(t, Date.parse('2026-10-10T12:00:00Z')), false);
});

check('home roster leaves out members on a live trip (one place at a time)', () => {
  for (const scope of ['radius', 'uk_ie'] as const) {
    const sql = nearbyRosterWhereSql(scope, false);
    assert.match(sql, /NOT EXISTS \(\s*SELECT 1 FROM travel_trips ltt/);
    assert.match(sql, /ltt\.starts_at <= NOW\(\)/);
    assert.match(sql, /ltt\.ends_at > NOW\(\)/);
  }
});
check('visitor roster measures to the trip centre, never p.location, and keeps blocks + hide list', () => {
  const sql = nearbyRosterWhereSql('radius', false, 'visitors');
  assert.match(sql, /tt\.centre_lng, tt\.centre_lat/);
  assert.doesNotMatch(sql, /ST_DWithin\(p\.location/);
  assert.match(sql, /FROM blocks b/);
  assert.match(sql, /location_hidden_from/);
  assert.match(sql, /p\.is_ghost = false/);
  const list = nearbyVisitorsListSql(sql, 5);
  assert.match(list, /tt\.city_name AS visit_city/);
  assert.match(list, /JOIN travel_trips tt/);
});

check('visitor row: coarse centre, "Visiting" label, no GPS and no distance number', () => {
  const row = travelVisitorRow({
    id: 'u1',
    name: 'T',
    photo_url: '/uploads/x.jpg',
    map_photo_url: null,
    real_lat: 51.50741,
    real_lng: -0.12781,
    map_pin_fuzz_m: 400,
    show_distance: true,
    is_visitor: true,
    visitor_expires_at: null,
    created_at: new Date('2026-09-01T00:00:00Z'),
    visit_city: 'Manchester',
    visit_lat: 53.44,
    visit_lng: -2.23,
    visit_starts_at: new Date('2026-10-10T00:00:00Z'),
    visit_ends_at: new Date('2026-10-12T23:00:00Z'),
  });
  assert.strictEqual(row.lat, 53.44);
  assert.strictEqual(row.lng, -2.23);
  assert.strictEqual(row.distance_label, 'Visiting Manchester');
  assert.ok(!('distance_km' in row));
  for (const k of ['real_lat', 'real_lng', 'map_pin_fuzz_m', 'show_distance', 'visit_lat', 'visit_lng']) {
    assert.ok(!(k in row), `no ${k}`);
  }
  assert.strictEqual(row.visiting.city, 'Manchester');
});

console.log(`travel-checks: ${passed} passed`);
