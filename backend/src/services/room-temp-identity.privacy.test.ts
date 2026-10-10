/**
 * Room display-identity unit tests (no DB).
 * Profile path allowed when no temp. Temp name-only never leaks profile photo.
 * Leave drops the person from roster with no ghost.
 */
import assert from 'assert';
import {
  ROOM_ANON_DISPLAY_NAME,
  dropLeaverFromRoster,
  sanitizeRoomPresence,
} from './room-temp-identity';

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

test('active temp identity keeps temp name and photo', () => {
  const out = sanitizeRoomPresence({
    tempName: 'Pig Quiet',
    tempPhoto: '/uploads/room-temp/pig.png',
    tempActive: true,
    profileName: 'Al Real',
    profilePhoto: '/uploads/profiles/real.jpg',
  });
  assert.equal(out.name, 'Pig Quiet');
  assert.equal(out.photo_url, '/uploads/room-temp/pig.png');
  assert.equal(out.using_temp_identity, true);
});

test('temp name without photo does NOT fall back to profile photo', () => {
  const out = sanitizeRoomPresence({
    tempName: 'Pig Quiet',
    tempPhoto: null,
    tempActive: true,
    profileName: 'Al Real',
    profilePhoto: '/uploads/profiles/real.jpg',
  });
  assert.equal(out.name, 'Pig Quiet');
  assert.equal(out.photo_url, null);
  assert.equal(out.using_temp_identity, true);
});

test('blank temp photo is treated as no photo — letter avatar path', () => {
  const out = sanitizeRoomPresence({
    tempName: 'Pig Quiet',
    tempPhoto: '   ',
    tempActive: true,
    profileName: 'Al Real',
    profilePhoto: '/uploads/profiles/real.jpg',
  });
  assert.equal(out.name, 'Pig Quiet');
  assert.equal(out.photo_url, null);
  assert.equal(out.using_temp_identity, true);
});

test('no temp uses profile name and photo', () => {
  const out = sanitizeRoomPresence({
    tempName: null,
    tempPhoto: null,
    tempActive: false,
    profileName: 'Al Real',
    profilePhoto: '/uploads/profiles/real.jpg',
  });
  assert.equal(out.name, 'Al Real');
  assert.equal(out.photo_url, '/uploads/profiles/real.jpg');
  assert.equal(out.using_temp_identity, false);
});

test('join with profile still works when profile photo is missing', () => {
  const out = sanitizeRoomPresence({
    profileName: 'Name Only',
    profilePhoto: null,
  });
  assert.equal(out.name, 'Name Only');
  assert.equal(out.photo_url, null);
  assert.equal(out.using_temp_identity, false);
});

test('blank profile name falls back to Member placeholder', () => {
  const out = sanitizeRoomPresence({
    profileName: '   ',
    profilePhoto: null,
  });
  assert.equal(out.name, ROOM_ANON_DISPLAY_NAME);
  assert.equal(out.photo_url, null);
  assert.equal(out.using_temp_identity, false);
});

test('blank temp name is treated as inactive — profile used', () => {
  const out = sanitizeRoomPresence({
    tempName: '   ',
    tempPhoto: '/uploads/room-temp/x.png',
    tempActive: true,
    profileName: 'Al Real',
    profilePhoto: '/uploads/profiles/real.jpg',
  });
  assert.equal(out.name, 'Al Real');
  assert.equal(out.photo_url, '/uploads/profiles/real.jpg');
  assert.equal(out.using_temp_identity, false);
});

test('leave-no-trace: leaver removed from presence roster', () => {
  const before = [
    { user_id: 'a', name: 'Anon Bear', photo_url: '/t/a.jpg' },
    { user_id: 'b', name: 'Quiet Fox', photo_url: '/t/b.jpg' },
    { user_id: 'c', name: 'Night Owl', photo_url: '/t/c.jpg' },
  ];
  const after = dropLeaverFromRoster(before, 'b');
  assert.equal(after.length, 2);
  assert.deepEqual(
    after.map((p) => p.user_id),
    ['a', 'c'],
  );
  assert.ok(!after.some((p) => p.user_id === 'b'));
});

test('leave-no-trace: leaver removed from members roster (id field)', () => {
  const before = [
    { id: 'a', name: 'Anon Bear' },
    { id: 'b', name: 'Quiet Fox' },
  ];
  const after = dropLeaverFromRoster(before, 'a');
  assert.equal(after.length, 1);
  assert.equal(after[0].id, 'b');
});

test('leave-no-trace: unknown leaver is a no-op', () => {
  const before = [{ user_id: 'a', name: 'Anon Bear' }];
  const after = dropLeaverFromRoster(before, 'z');
  assert.equal(after.length, 1);
  assert.equal(after[0].user_id, 'a');
});
