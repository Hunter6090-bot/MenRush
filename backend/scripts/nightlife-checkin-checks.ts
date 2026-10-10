/**
 * Nightlife check-in TTL + shape smoke checks (no DB required).
 * Run: npx ts-node scripts/nightlife-checkin-checks.ts
 */
import assert from 'assert';
import {
  ACTIVE_CHECKIN_TTL_HOURS,
} from '../src/services/hot-spots.service';

assert.strictEqual(
  ACTIVE_CHECKIN_TTL_HOURS,
  4,
  'Venue check-in TTL must stay at 4 hours (documented product choice)',
);

console.log('✓ ACTIVE_CHECKIN_TTL_HOURS === 4');
console.log('nightlife-checkin-checks: ok');
