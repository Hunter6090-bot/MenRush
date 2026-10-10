/**
 * Chat attach from My Photos — media lock + discretion policy checks (no DB).
 * Attach copies into message storage; never mutates album_photos / visibility / grants.
 * Revoke stays viewers-only. DISCREET_MEDIA_BLUR stays default-off.
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { isDiscreetMediaBlurEnabled } from '../src/services/discreet-media';

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

test('DISCREET_MEDIA_BLUR stays default-off', () => {
  const prev = process.env.DISCREET_MEDIA_BLUR;
  delete process.env.DISCREET_MEDIA_BLUR;
  assert.equal(isDiscreetMediaBlurEnabled(), false);
  if (prev === undefined) delete process.env.DISCREET_MEDIA_BLUR;
  else process.env.DISCREET_MEDIA_BLUR = prev;
});

test('from-album route copies bytes and never deletes album_photos', () => {
  const src = fs.readFileSync(path.join(root, 'src/routes/messages.ts'), 'utf8');
  assert.ok(src.includes("router.post('/media/from-album'"), 'POST /media/from-album exists');
  assert.ok(src.includes('getOwnedPhotoForAttach'), 'uses owner-only attach read');
  assert.ok(src.includes('copyFileSync'), 'copies into message storage');
  assert.ok(src.includes('never deletes, moves'), 'documents non-destructive attach');

  const routeStart = src.indexOf("router.post('/media/from-album'");
  assert.ok(routeStart > 0);
  const slice = src.slice(routeStart, routeStart + 3500);
  assert.ok(!/DELETE\s+FROM\s+album_photos/i.test(slice), 'must not DELETE album_photos');
  assert.ok(!/UPDATE\s+album_photos/i.test(slice), 'must not UPDATE album_photos');
  assert.ok(!/UPDATE\s+users\b/i.test(slice), 'must not UPDATE users');
  assert.ok(!/album_grants/i.test(slice), 'must not touch grants on attach');
});

test('getOwnedPhotoForAttach is read-only', () => {
  const src = fs.readFileSync(path.join(root, 'src/services/album.service.ts'), 'utf8');
  const start = src.indexOf('async getOwnedPhotoForAttach');
  assert.ok(start > 0, 'getOwnedPhotoForAttach must exist');
  const slice = src.slice(start, start + 900);
  assert.ok(/SELECT\s+p\.id/i.test(slice), 'must SELECT owned photo');
  assert.ok(!/UPDATE|DELETE|INSERT|unlink|rmSync|copyFile/i.test(slice), 'must not mutate');
});

test('revokeAllAccess remains viewers-only', () => {
  const src = fs.readFileSync(path.join(root, 'src/services/album.service.ts'), 'utf8');
  const fnStart = src.indexOf('async revokeAllAccess');
  assert.ok(fnStart > 0);
  const slice = src.slice(fnStart, fnStart + 1200);
  assert.ok(slice.includes('DELETE FROM album_grants'), 'must delete grants');
  assert.ok(!/DELETE FROM album_photos/.test(slice), 'must not delete photos');
  assert.ok(!/unlink|rmSync|rmdir/.test(slice), 'must not wipe storage');
  assert.ok(slice.includes('revoke_must_not_wipe_media'), 'must guard photo_count');
});

test('AlbumMediaMessageSchema exists in validation', () => {
  const src = fs.readFileSync(path.join(root, 'src/types/validation.ts'), 'utf8');
  assert.ok(src.includes('AlbumMediaMessageSchema'), 'schema exported');
  assert.ok(src.includes('photo_id'), 'requires photo_id');
});

if (process.exitCode) {
  console.error('chat-attach-my-photos checks failed');
  process.exit(1);
} else {
  console.log('All chat-attach-my-photos checks passed.');
}
