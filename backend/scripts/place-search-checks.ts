/**
 * Profile search by UK/IE town or city — source locks (no DB).
 * Run: npx ts-node scripts/place-search-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const serviceSrc = fs.readFileSync(
  path.join(__dirname, '../src/services/user.service.ts'),
  'utf8',
);
const routesSrc = fs.readFileSync(
  path.join(__dirname, '../src/routes/users.ts'),
  'utf8',
);
const placeLibSrc = fs.readFileSync(
  path.join(__dirname, '../src/lib/ukIePlace.ts'),
  'utf8',
);
const nearbyStart = serviceSrc.indexOf('async getNearbyUsers');
const searchStart = serviceSrc.indexOf('async searchProfiles');
assert.ok(nearbyStart >= 0 && searchStart >= 0, 'expected nearby + search in user.service');
const nearbyFn = serviceSrc.slice(nearbyStart, searchStart);

assert.match(routesSrc, /req\.query\.by === 'place'/);
assert.match(routesSrc, /PLACE_LOOKUP_FAILED_MESSAGE/);
assert.match(routesSrc, /Search failed\. Please try again\./);
const searchRouteSrc = routesSrc.slice(
  routesSrc.indexOf("router.get('/search'"),
  routesSrc.indexOf("router.get('/nearby'"),
);
assert.doesNotMatch(
  searchRouteSrc,
  /error\.message/,
  'search route must not leak raw error.message',
);

assert.match(serviceSrc, /lookupUkIePlace/);
assert.match(serviceSrc, /by === 'place'/);
assert.match(serviceSrc, /u\.name ILIKE \$2/);
assert.match(serviceSrc, /p\.lat IS NOT NULL/);
assert.match(serviceSrc, /p\.lng IS NOT NULL/);
assert.match(serviceSrc, /p\.location IS NOT NULL/);
assert.match(serviceSrc, /privateMapPointAround/);
assert.match(serviceSrc, /placeContainsPoint/);
assert.match(serviceSrc, /map_pin_fuzz_m/);

assert.doesNotMatch(
  serviceSrc,
  /SET\s+city\s*=/i,
  'must not invent or write a city column on profiles',
);

// Place search must not use the viewer's pin as an ST_DWithin origin.
const searchFn = serviceSrc.slice(searchStart, serviceSrc.indexOf('async getMatches'));
assert.doesNotMatch(
  searchFn,
  /ST_DWithin\(\s*p\.location[^,]*,\s*ST_SetSRID\(\s*ST_MakePoint/,
  'place/name search must not be a radius around the searcher',
);
assert.match(searchFn, /p\.is_visible = true/);
assert.match(searchFn, /COALESCE\(p\.is_ghost, FALSE\) = false/);
// Final match is discretionary pin, not exact stored pin vs place polygon.
assert.doesNotMatch(
  searchFn,
  /ST_Intersects\(\s*p\.location/,
  'must not ST_Intersects the exact stored pin against place geometry',
);

// Town/city only — no small-place types that reveal a precise pin.
assert.match(placeLibSrc, /SETTLEMENT_TYPES = new Set\(\['city', 'town', 'municipality'\]\)/);
for (const banned of [
  'hamlet',
  'village',
  'suburb',
  'neighbourhood',
  'neighborhood',
  'city_district',
]) {
  assert.doesNotMatch(
    placeLibSrc,
    new RegExp(`SETTLEMENT_TYPES[\\s\\S]{0,200}'${banned}'`),
    `must not accept ${banned} as a searchable place`,
  );
}
assert.match(placeLibSrc, /PLACE_LOOKUP_FAILED_MESSAGE/);
assert.match(placeLibSrc, /Couldn't look up that place/);

// Nearby / ghost / fuzz behaviour stays in getNearbyUsers, not rewritten here.
assert.match(nearbyFn, /ST_DWithin\(p\.location/);
assert.match(nearbyFn, /p\.is_ghost = false/);
assert.match(nearbyFn, /map_pin_fuzz_m/);
assert.match(nearbyFn, /privateMapPointAround/);

console.log('place-search-checks: ok');
