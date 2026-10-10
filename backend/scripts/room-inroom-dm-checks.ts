/**
 * Unit checks for ephemeral in-room 1:1 session store.
 * Run: npx ts-node --transpile-only scripts/room-inroom-dm-checks.ts
 */
import {
  RoomDmSessionStore,
  peerOfSession,
  roomDmSessionKey,
} from '../src/services/room-dm.service';

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string) {
  if (cond) {
    passed += 1;
    console.log(`PASS: ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${label}`);
  }
}

const store = new RoomDmSessionStore();

assert(
  roomDmSessionKey('r1', 'b', 'a') === roomDmSessionKey('r1', 'a', 'b'),
  'session key is order-independent',
);

const s1 = store.open('room-1', 'user-a', 'user-b');
assert(s1.a === 'user-a' && s1.b === 'user-b', 'open stores sorted pair');
assert(store.size() === 1, 'one session after open');
assert(store.get('room-1', 'user-b', 'user-a') === s1, 'get finds same session either order');
assert(peerOfSession(s1, 'user-a') === 'user-b', 'peerOfSession a→b');
assert(peerOfSession(s1, 'user-b') === 'user-a', 'peerOfSession b→a');

store.open('room-1', 'user-a', 'user-b');
assert(store.size() === 1, 're-open is idempotent');

store.open('room-1', 'user-a', 'user-c');
assert(store.size() === 2, 'second peer gets its own session');

const closed = store.close('room-1', 'user-a', 'user-b');
assert(!!closed && closed.b === 'user-b', 'close returns ended session');
assert(store.size() === 1, 'close removes only that pair');
assert(!store.get('room-1', 'user-a', 'user-b'), 'closed pair is gone');

store.open('room-1', 'user-a', 'user-b');
store.open('room-2', 'user-a', 'user-b');
const ended = store.endAllForUserInRoom('room-1', 'user-a');
assert(ended.length === 2, 'leaving group ends both room-1 DMs');
assert(store.size() === 1, 'room-2 session survives');
assert(!!store.get('room-2', 'user-a', 'user-b'), 'other room DM still open');

store.clear();
assert(store.size() === 0, 'clear empties store');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
