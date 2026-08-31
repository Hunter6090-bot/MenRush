/**
 * My Photos — revoke is VIEWERS ONLY (never a media wipe).
 * Pure policy + shape checks (no DB). DISCREET_MEDIA_BLUR stays default-off.
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

test('DISCREET_MEDIA_BLUR stays default-off (no production hard-lock)', () => {
  const prev = process.env.DISCREET_MEDIA_BLUR;
  delete process.env.DISCREET_MEDIA_BLUR;
  assert.equal(isDiscreetMediaBlurEnabled(), false);
  if (prev === undefined) delete process.env.DISCREET_MEDIA_BLUR;
  else process.env.DISCREET_MEDIA_BLUR = prev;
});

test('revokeAllAccess source never deletes album_photos', () => {
  const src = fs.readFileSync(path.join(root, 'src/services/album.service.ts'), 'utf8');
  const fnStart = src.indexOf('async revokeAllAccess');
  assert.ok(fnStart > 0, 'revokeAllAccess must exist');
  const slice = src.slice(fnStart, fnStart + 1200);
  assert.ok(slice.includes('DELETE FROM album_grants'), 'must delete grants');
  assert.ok(!/DELETE FROM album_photos/.test(slice), 'must not delete photos');
  assert.ok(!/unlink|rmSync|rmdir/.test(slice), 'must not wipe storage');
  assert.ok(slice.includes('revoke_must_not_wipe_media'), 'must guard photo_count');
});

test('migration documents viewers-only revoke', () => {
  const mig = fs.readFileSync(
    path.join(root, 'database/migrations/041_my_photos_visibility.sql'),
    'utf8',
  );
  assert.ok(mig.includes('view_once'), 'visibility includes view_once');
  assert.ok(mig.includes('album_photo_views'), 'view-once opens table');
  assert.ok(/never wipe media|viewers-only|VIEWERS ONLY/i.test(mig), 'docs viewers-only');
});

test('albums route revoke-all returns photo_count', () => {
  const src = fs.readFileSync(path.join(root, 'src/routes/albums.ts'), 'utf8');
  assert.ok(src.includes("router.delete('/:albumId/grants'"), 'DELETE /grants route');
  assert.ok(src.includes('viewers_removed'), 'returns viewers_removed');
  assert.ok(src.includes('photo_count'), 'returns photo_count after revoke');
  assert.ok(src.includes('VIEWERS ONLY'), 'documents viewers-only');
});

if (process.exitCode) {
  console.error('my-photos checks failed');
  process.exit(1);
} else {
  console.log('All my-photos checks passed.');
}
