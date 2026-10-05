/**
 * Nearby live presence is last_seen within 1 hour — not the 20-minute socket flag.
 * Run: npx ts-node --transpile-only scripts/presence-window-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { PRESENCE_LIVE_SQL, PRESENCE_WINDOW_SQL } from '../src/lib/presence';
import { nearbyRosterSelectSql, nearbyRosterListSql } from '../src/lib/nearbyRosterSql';

assert.strictEqual(PRESENCE_WINDOW_SQL, "INTERVAL '1 hour'");
assert.match(PRESENCE_LIVE_SQL, /last_seen > NOW\(\) - INTERVAL '1 hour'/);
assert.doesNotMatch(PRESENCE_LIVE_SQL, /p\.online = TRUE/);

const selectSql = nearbyRosterSelectSql();
assert.match(selectSql, /last_seen > NOW\(\) - INTERVAL '1 hour'\) AS online/);
assert.doesNotMatch(selectSql, /INTERVAL '20 minutes'/);

const listSql = nearbyRosterListSql('WHERE 1=1', 5, 6);
assert.match(listSql, /INTERVAL '1 hour'/);
assert.doesNotMatch(listSql, /INTERVAL '20 minutes'/);

const service = fs.readFileSync(
  path.join(__dirname, '../src/services/user.service.ts'),
  'utf8',
);
assert.match(service, /PRESENCE_WINDOW_SQL/);
assert.match(service, /PRESENCE_LIVE_SQL/);
assert.doesNotMatch(service, /INTERVAL '20 minutes'/);

console.log('presence-window-checks: ok');
