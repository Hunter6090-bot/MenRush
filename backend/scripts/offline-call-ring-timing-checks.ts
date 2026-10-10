/**
 * Guards the offline-call ring timing contract:
 * - Answer/missed ring window must arm on offer delivery, not at call:initiate.
 * - Undelivered-offer hold must no-op once deliveredIncoming is true.
 * - call:answer must clear the ring timer so a late tick cannot write a miss.
 *
 * Run: npx ts-node scripts/offline-call-ring-timing-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const serverSrc = fs.readFileSync(path.join(__dirname, '../src/server.ts'), 'utf8');

assert.match(
  serverSrc,
  /function armRingTimeout\(/,
  'armRingTimeout helper must exist',
);
assert.match(
  serverSrc,
  /function deliverPendingIncoming\([\s\S]*?armRingTimeout\(pending\)/,
  'Ring timeout must arm inside deliverPendingIncoming (offer delivery)',
);

const initiateBlock = serverSrc.match(
  /socket\.on\('call:initiate'[\s\S]*?socket\.on\('call:answer'/,
)?.[0];
assert.ok(initiateBlock, 'call:initiate handler not found');

assert.match(
  initiateBlock,
  /still\.deliveredIncoming/,
  'Offline offer-hold expiry must skip when the offer was already delivered',
);
assert.doesNotMatch(
  initiateBlock,
  /pending\.timeout\s*=\s*setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?recordMissedCall[\s\S]*?\},\s*CALL_RING_WAIT_MS\)/,
  'call:initiate must not arm CALL_RING_WAIT_MS missed-call ring directly',
);

const answerBlock = serverSrc.match(
  /socket\.on\('call:answer'[\s\S]*?socket\.on\('call:reject'/,
)?.[0];
assert.ok(answerBlock, 'call:answer handler not found');
assert.match(
  answerBlock,
  /clearTimeout\(pending\.timeout\)/,
  'call:answer must clear the ring timeout to prevent a false missed call',
);

console.log('✓ ring timeout arms on offer delivery, not initiate');
console.log('✓ undelivered hold ignores deliveredIncoming');
console.log('✓ answer clears ring timeout');
console.log('offline-call-ring-timing-checks: ok');
