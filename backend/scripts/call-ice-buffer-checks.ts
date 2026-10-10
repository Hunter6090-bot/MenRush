/**
 * #73 — caller ICE sent before the pending call exists must reach the callee.
 * Run: npm run test:call-ice-buffer
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EarlyCallIceBuffer } from '../src/services/call-ice-buffer';

const buffer = new EarlyCallIceBuffer();
const t0 = 1_000_000;

buffer.push('caller', 'callee', { candidate: 'a' }, t0);
buffer.push('caller', 'callee', { candidate: 'b' }, t0 + 10);
buffer.push('other', 'callee', { candidate: 'x' }, t0 + 20);

assert.deepEqual(
  buffer.take('caller', 'callee', t0 + 1500),
  [{ candidate: 'a' }, { candidate: 'b' }],
  'candidates sent during the offline grace wait are kept, in order',
);
assert.deepEqual(buffer.take('caller', 'callee', t0 + 1600), [], 'take drains the pair');
assert.deepEqual(buffer.take('callee', 'caller', t0 + 1600), [], 'direction matters');
assert.deepEqual(buffer.take('other', 'callee', t0 + 1600), [{ candidate: 'x' }], 'pairs are isolated');

buffer.push('caller', 'callee', { candidate: 'stale' }, t0);
assert.deepEqual(buffer.take('caller', 'callee', t0 + 61_000), [], 'abandoned calls expire');

buffer.push('caller', 'callee', { candidate: 'gone' }, t0);
buffer.clear('caller', 'callee');
assert.deepEqual(buffer.take('caller', 'callee', t0 + 1), [], 'clear drops the pair');

for (let i = 0; i < 500; i++) buffer.push('flood', 'callee', { candidate: String(i) }, t0);
assert.equal(buffer.take('flood', 'callee', t0).length, 128, 'buffer is capped per call');

// The socket handlers must actually use the buffer (server.ts has no harness).
const server = readFileSync(join(__dirname, '../src/server.ts'), 'utf8');
assert.match(server, /earlyCallIce\.push\(/, 'call:ice-candidate buffers when the callee is offline');
const takeAt = server.indexOf('earlyCallIce.take(');
const replaceAt = server.indexOf('clearPendingCall(authorized.actorId, authorized.targetId);', takeAt);
assert.ok(takeAt > 0 && replaceAt > takeAt, 'call:initiate takes early ICE before replacing the pending call');
assert.match(server, /ice: earlyIce,/, 'call:initiate seeds the pending call with early ICE');

console.log('call-ice-buffer checks passed');
