/**
 * Room temp-identity privacy unit tests (no DB).
 * Guarantees canonical profile fields never leak into room presence payloads.
 */
import assert from 'assert';
import {
  ROOM_ANON_DISPLAY_NAME,
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

test('active temp with null photo does NOT fall back to profile photo', () => {
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

test('inactive / missing temp never returns profile name or photo', () => {
  const out = sanitizeRoomPresence({
    tempName: null,
    tempPhoto: null,
    tempActive: false,
    profileName: 'Al Real',
    profilePhoto: '/uploads/profiles/real.jpg',
  });
  assert.equal(out.name, ROOM_ANON_DISPLAY_NAME);
  assert.equal(out.photo_url, null);
  assert.equal(out.using_temp_identity, false);
});

test('profile fields are ignored even when only those are supplied', () => {
  const out = sanitizeRoomPresence({
    profileName: 'Should Never Appear',
    profilePhoto: '/uploads/profiles/leak.jpg',
  });
  assert.equal(out.name, ROOM_ANON_DISPLAY_NAME);
  assert.equal(out.photo_url, null);
  assert.notEqual(out.name, 'Should Never Appear');
});

test('blank temp name is treated as inactive', () => {
  const out = sanitizeRoomPresence({
    tempName: '   ',
    tempPhoto: '/uploads/room-temp/x.png',
    tempActive: true,
    profileName: 'Al Real',
    profilePhoto: '/uploads/profiles/real.jpg',
  });
  assert.equal(out.name, ROOM_ANON_DISPLAY_NAME);
  assert.equal(out.photo_url, null);
  assert.equal(out.using_temp_identity, false);
});
