/**
 * Room identity leak guards — source checks, no DB.
 * Video rooms must never fall back to users.name / users.photo_url.
 * Run: cd backend && npx ts-node scripts/room-identity-checks.ts
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test('room identity SQL helpers never fall back to the main profile', () => {
  const src = fs.readFileSync(path.join(root, 'src/services/room.service.ts'), 'utf8');
  const nameFn = src.slice(src.indexOf('export function roomTempNameExpr'), src.indexOf('export function roomTempPhotoExpr'));
  const photoFn = src.slice(src.indexOf('export function roomTempPhotoExpr'), src.indexOf('interface CreateRoomData'));
  assert.ok(nameFn.includes('display_name'));
  assert.ok(nameFn.includes('ROOM_ANON_NAME') || nameFn.includes('Member'));
  assert.doesNotMatch(nameFn, /\bu\.name\b/);
  assert.ok(photoFn.includes('photo_url'));
  assert.doesNotMatch(photoFn, /\bu\.photo_url\b/);
});

test('room.service identity queries use room-scoped expressions only', () => {
  const src = fs.readFileSync(path.join(root, 'src/services/room.service.ts'), 'utf8');
  assert.match(src, /roomTempNameExpr/);
  assert.match(src, /roomTempPhotoExpr/);
  // The old COALESCE(..., u.name / u.photo_url) leak must not return.
  assert.doesNotMatch(
    src,
    /THEN ti\.display_name[\s\S]{0,80}ELSE NULL[\s\S]{0,40}END,[\s\S]{0,20}u\.name/,
  );
  assert.doesNotMatch(
    src,
    /THEN ti\.photo_url[\s\S]{0,80}ELSE NULL[\s\S]{0,40}END,[\s\S]{0,20}u\.photo_url/,
  );
});

test('socket presence and typing use room identity; leave fires on disconnecting', () => {
  const src = fs.readFileSync(path.join(root, 'src/server.ts'), 'utf8');
  assert.match(src, /socket\.on\('disconnecting'/);
  assert.match(src, /room:typing[\s\S]*resolveRoomPresence/);
  const typingBlock = src.slice(src.indexOf("socket.on('room:typing'"));
  assert.equal(typingBlock.includes('getDisplayName'), false);
});
