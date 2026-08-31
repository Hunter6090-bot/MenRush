/**
 * Chat video open hot path — getMedia must not re-await assertInteraction.
 * Run: npx ts-node scripts/chat-video-open-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const service = fs.readFileSync(
  path.join(__dirname, '../src/services/message.service.ts'),
  'utf8',
);
const routes = fs.readFileSync(path.join(__dirname, '../src/routes/messages.ts'), 'utf8');

const start = service.indexOf('async getMedia(');
assert.ok(start >= 0, 'getMedia missing');
const slice = service.slice(start, start + 1800);
assert.doesNotMatch(
  slice,
  /await accessControl\.assertInteraction/,
  'getMedia must not await assertInteraction (iPhone ~12s video open)',
);
assert.match(slice, /NOT EXISTS \([\s\S]*blocks/);

assert.match(routes, /Accept-Ranges/);
assert.match(routes, /acceptRanges:\s*true/);

console.log('chat-video-open-checks: ok');
