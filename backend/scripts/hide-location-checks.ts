/**
 * Pure checks for "Hide my location from" (no DB).
 *   npx ts-node scripts/hide-location-checks.ts
 */
import assert from 'assert';
import { locationHiddenFromViewerSql, notLocationHiddenFromViewerSql } from '../src/lib/locationHiddenSql';
import { nearbyRosterWhereSql } from '../src/lib/nearbyRosterSql';
import { LocationHideError, LOCATION_HIDE_MAX } from '../src/services/location-hide.service';

const frag = locationHiddenFromViewerSql('u.id', '$3');
assert.ok(frag.includes('lh.owner_id = u.id'));
assert.ok(frag.includes('lh.hidden_user_id = $3'));
assert.ok(notLocationHiddenFromViewerSql('u.id', '$3').startsWith('NOT EXISTS'));

// Every Nearby roster scope (roster, count and map pins share this WHERE) filters the list.
for (const scope of ['radius', 'uk_ie_all'] as const) {
  for (const e2e of [true, false]) {
    const where = nearbyRosterWhereSql(scope as any, e2e);
    assert.ok(
      where.includes('location_hidden_from') && where.includes('lh.hidden_user_id = $3'),
      `nearby WHERE (${scope}, e2e=${e2e}) filters the hide list`,
    );
  }
}

// Errors only ever go to the owner who called the endpoint.
const err = new LocationHideError('premium_required', 402);
assert.ok(err instanceof Error);
assert.strictEqual(err.code, 'premium_required');
assert.strictEqual(err.status, 402);
assert.ok(LOCATION_HIDE_MAX >= 100);

console.log('hide-location-checks: ok');
