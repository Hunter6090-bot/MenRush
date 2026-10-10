/**
 * UK / Ireland place picker — no network.
 * Run: npx ts-node src/lib/ukIePlace.test.ts
 */
import assert from 'assert';
import {
  isUkIeSettlement,
  pickUkIeSettlement,
  placeContainsPoint,
  PLACE_LOOKUP_FAILED_MESSAGE,
  PlaceLookupError,
  type NominatimHit,
  type UkIePlace,
} from './ukIePlace';

function hit(overrides: NominatimHit): NominatimHit {
  return {
    class: 'place',
    type: 'city',
    addresstype: 'city',
    importance: 0.8,
    boundingbox: ['51.28', '51.70', '-0.51', '0.33'],
    ...overrides,
    address: { country_code: 'gb', city: 'London', ...overrides.address },
  };
}

const londonUk = hit({
  name: 'London',
  display_name: 'London, Greater London, England, United Kingdom',
});

const londonOntario = hit({
  name: 'London',
  display_name: 'London, Ontario, Canada',
  address: { country_code: 'ca', city: 'London' },
  boundingbox: ['42.8', '43.1', '-81.4', '-81.1'],
});

const newYorkUs = hit({
  name: 'New York',
  type: 'city',
  address: { country_code: 'us', city: 'New York' },
  boundingbox: ['40.4', '40.9', '-74.3', '-73.7'],
});

const dublinIe = hit({
  name: 'Dublin',
  type: 'city',
  address: { country_code: 'ie', city: 'Dublin' },
  boundingbox: ['53.2', '53.4', '-6.4', '-6.1'],
});

const brightonTown = hit({
  name: 'Brighton',
  type: 'city',
  addresstype: 'city',
  address: { country_code: 'gb', city: 'Brighton' },
  boundingbox: ['50.8', '50.9', '-0.2', '-0.05'],
  importance: 0.6,
});

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test('rejects US and Canadian cities even if they share a name', () => {
  assert.equal(isUkIeSettlement(londonOntario), false);
  assert.equal(isUkIeSettlement(newYorkUs), false);
  assert.equal(pickUkIeSettlement([londonOntario, newYorkUs], 'London'), null);
});

test('picks UK London over a US/Canada London in a mixed list', () => {
  const place = pickUkIeSettlement([londonOntario, londonUk], 'London');
  assert.ok(place);
  assert.equal(place!.countryCode, 'gb');
  assert.equal(place!.displayName, 'London');
});

test('accepts Ireland (Dublin)', () => {
  const place = pickUkIeSettlement([dublinIe], 'Dublin');
  assert.ok(place);
  assert.equal(place!.countryCode, 'ie');
  assert.equal(place!.south < place!.north, true);
});

test('rejects non-settlement POIs', () => {
  const pub = hit({
    class: 'amenity',
    type: 'pub',
    addresstype: 'amenity',
    name: 'London',
    address: { country_code: 'gb' },
  });
  assert.equal(isUkIeSettlement(pub), false);
});

test('rejects hamlet, village, suburb, neighbourhood, city_district', () => {
  for (const kind of ['hamlet', 'village', 'suburb', 'neighbourhood', 'neighborhood', 'city_district']) {
    const small = hit({
      name: 'Tinyplace',
      type: kind,
      addresstype: kind,
      address: { country_code: 'gb', village: 'Tinyplace', city: undefined, town: undefined },
      boundingbox: ['51.50', '51.501', '-0.12', '-0.119'],
    });
    assert.equal(isUkIeSettlement(small), false, kind);
  }
  assert.equal(
    pickUkIeSettlement(
      [
        hit({
          name: 'Tinyplace',
          type: 'hamlet',
          addresstype: 'hamlet',
          address: { country_code: 'gb', hamlet: 'Tinyplace', city: undefined },
        }),
      ],
      'Tinyplace',
    ),
    null,
  );
});

test('prefers exact town name over a weaker hit', () => {
  const place = pickUkIeSettlement([londonUk, brightonTown], 'Brighton');
  assert.ok(place);
  assert.equal(place!.displayName, 'Brighton');
});

test('returns null when Nominatim has no UK/IE settlement', () => {
  assert.equal(pickUkIeSettlement([], 'Miami'), null);
});

test('placeContainsPoint uses bbox when no geojson', () => {
  const place: UkIePlace = {
    displayName: 'Brighton',
    countryCode: 'gb',
    south: 50.8,
    north: 50.9,
    west: -0.2,
    east: -0.05,
    geojson: null,
  };
  assert.equal(placeContainsPoint(place, 50.85, -0.12), true);
  assert.equal(placeContainsPoint(place, 51.5, -0.12), false);
});

test('PlaceLookupError carries human copy, not a raw code', () => {
  const err = new PlaceLookupError();
  assert.equal(err.message, PLACE_LOOKUP_FAILED_MESSAGE);
  assert.equal(/^[a-z0-9_]+$/i.test(err.message), false);
  assert.match(err.message, /town or city/i);
});

if (!process.exitCode) console.log('ukIePlace tests: ok');
