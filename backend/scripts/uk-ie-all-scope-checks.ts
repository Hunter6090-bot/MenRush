/**
 * All discovery is UK+Ireland boxes, not a nearby radius.
 * Run: npx ts-node scripts/uk-ie-all-scope-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { isInUkIreland, UK_IRELAND_LOCATION_SQL } from '../src/lib/ukIrelandBounds';

assert.equal(isInUkIreland(53.4808, -2.2426), true, 'Manchester must be in All');
assert.equal(isInUkIreland(53.8008, -1.5491), true, 'Leeds must be in All');
assert.equal(isInUkIreland(52.4862, -1.8904), true, 'Birmingham must be in All');
assert.equal(isInUkIreland(51.5074, -0.1278), true, 'London must be in All');
assert.equal(isInUkIreland(53.3498, -6.2603), true, 'Dublin must be in All');
assert.equal(isInUkIreland(54.5973, -5.9301), true, 'Belfast must be in All');
assert.equal(isInUkIreland(40.7128, -74.006), false, 'New York must not be in All');
assert.equal(isInUkIreland(48.8566, 2.3522), false, 'Paris must not be in All');

const serviceSrc = fs.readFileSync(
  path.join(__dirname, '../src/services/user.service.ts'),
  'utf8',
);
const routesSrc = fs.readFileSync(path.join(__dirname, '../src/routes/users.ts'), 'utf8');

assert.match(serviceSrc, /UK_IRELAND_LOCATION_SQL/);
assert.match(serviceSrc, /discoveryScope === 'uk_ie'/);
assert.match(serviceSrc, /ST_DWithin\(p\.location, ST_MakePoint\(\$2, \$1\)::geography, \$4\)/);
assert.doesNotMatch(
  UK_IRELAND_LOCATION_SQL,
  /ST_DWithin/,
  'UK+Ireland All must not use a radius',
);

assert.match(routesSrc, /scope === 'uk_ie'/);
assert.match(routesSrc, /Math\.min\(Math\.max\(requestedRadius,\s*0\.8\),\s*161\)/);

console.log('uk-ie-all-scope-checks: ok');
